import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { requestScan } from '@/api/scan';
import { AUTH_MESSAGES, ensureSession, refreshSession } from '@/auth/session';
import { Banner } from '@/components/banner';
import { DarkCallToAction } from '@/components/dark-cta';
import { PillInput } from '@/components/pill-input';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Wordmark } from '@/components/wordmark';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { openDatabaseSafely, saveScanResultSafely } from '@/db/access';
import { useTheme, type Theme } from '@/hooks/use-theme';
import {
  isBlockingScanError,
  offersHistory,
} from '@/errors/messages';
import { formatCountdown } from '@/lib/countdown';
import { takePendingRepoUrl } from '@/lib/repo-picker';
import { rememberScanResult } from '@/lib/scan-session';
import { parseRepoLink } from '@/lib/url';
import type { ScanFailure } from '@/types/scan';

type ScanScope = 'production' | 'all';

const SCOPES: { value: ScanScope; label: string }[] = [
  { value: 'production', label: 'Hanya produksi' },
  { value: 'all', label: 'Termasuk pengembangan' },
];

/** Setelah 5 detik, tampilkan penjelasan tambahan. */
const SLOW_HINT_DELAY_MS = 5_000;

export default function ScanScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [url, setUrl] = useState('');
  const [scope, setScope] = useState<ScanScope>('production');
  const [showError, setShowError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slowHint, setSlowHint] = useState(false);
  const [scanError, setScanError] = useState<ScanFailure | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'ready' | 'error'>(
    'checking',
  );
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [retryDeadline, setRetryDeadline] = useState<number | null>(null);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const inputRef = useRef<TextInputInstance>(null);

  // Repo tersimpan menitipkan tautan di memori; konsumsi sekali setiap layar
  // kembali fokus agar kolom langsung terisi tanpa efek render berantai.
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingRepoUrl();
      if (!pending) return;

      const parsed = parseRepoLink(pending);
      if (!parsed.ok) return;

      setUrl(parsed.value.url);
      setShowError(false);
      // Hitung mundur 429 tetap berjalan; hanya error lain yang dibersihkan.
      setScanError((current) => (current?.code === 'RATE_LIMITED' ? current : null));
    }, []),
  );

  const validation = parseRepoLink(url);
  const error = showError && !validation.ok ? validation.error.message : undefined;
  const retryRemaining =
    retryDeadline === null ? 0 : Math.max(0, Math.ceil((retryDeadline - clockNow) / 1000));
  const canScan =
    validation.ok && !loading && sessionStatus === 'ready' && retryRemaining === 0;
  const rateLimitPrefix =
    scanError?.rateLimitScope === 'github'
      ? 'Batas permintaan GitHub tercapai.'
      : 'Batas pemindaian tercapai.';
  const scanErrorMessage = scanError
    ? scanError.code === 'RATE_LIMITED' && retryRemaining > 0
      ? `${rateLimitPrefix} Tunggu ${formatCountdown(retryRemaining)} sebelum mencoba lagi.`
      : scanError.message
    : null;
  // PRD §12: error penghenti tampil sebagai layar dengan tindakan, bukan banner.
  const blockingError =
    scanError !== null && isBlockingScanError(scanError.code) ? scanError : null;
  const canOpenHistory = blockingError !== null && offersHistory(blockingError.code);

  // Hitung mundur 429 FR-25a. Backend tetap menolak walau UI ini dilewati.
  useEffect(() => {
    if (retryDeadline === null) return;

    const timer = setInterval(() => {
      const nowMs = Date.now();
      setClockNow(nowMs);
      if (nowMs >= retryDeadline) setRetryDeadline(null);
    }, 1_000);

    return () => clearInterval(timer);
  }, [retryDeadline]);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = setTimeout(() => setSlowHint(true), SLOW_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  // Sesi anonim disiapkan sekali saat layar dibuka; bila gagal, Pindai
  // dinonaktifkan tetapi tab Riwayat tetap bisa dipakai (PRD §12 baris 18).
  useEffect(() => {
    let active = true;

    void (async () => {
      const auth = await ensureSession();
      if (!active) return;
      setSessionStatus(auth.ok ? 'ready' : 'error');
      setSessionError(auth.ok ? null : auth.error.message);
    })();

    return () => {
      active = false;
    };
  }, [sessionAttempt]);

  function retrySession() {
    setSessionStatus('checking');
    setSessionError(null);
    setSessionAttempt((attempt) => attempt + 1);
  }

  function dismissScanError() {
    setScanError(null);
  }

  function openHistory() {
    router.navigate('/riwayat');
  }

  async function handleScan() {
    if (loading) {
      return;
    }

    if (!validation.ok) {
      setShowError(true);
      inputRef.current?.focus();
      return;
    }

    setSlowHint(false);
    setScanError(null);
    setLoading(true);
    try {
      const auth = await ensureSession();
      if (!auth.ok) {
        setSessionStatus('error');
        setSessionError(auth.error.message);
        return;
      }

      let result = await requestScan({
        repoUrl: validation.value.url,
        accessToken: auth.session.accessToken,
      });

      // Token bisa kedaluwarsa di tengah jalan: refresh sekali lalu ulangi.
      if (!result.ok && result.error.code === 'UNAUTHENTICATED') {
        const refreshed = await refreshSession();
        if (!refreshed.ok) {
          setSessionStatus('error');
          setSessionError(refreshed.error.message);
          return;
        }

        result = await requestScan({
          repoUrl: validation.value.url,
          accessToken: refreshed.session.accessToken,
        });

        if (!result.ok && result.error.code === 'UNAUTHENTICATED') {
          setSessionStatus('error');
          setSessionError(AUTH_MESSAGES.SESSION_REFRESH_FAILED);
          return;
        }
      }

      if (!result.ok) {
        if (result.error.code === 'RATE_LIMITED' && result.error.retryAfterSeconds) {
          const nowMs = Date.now();
          setClockNow(nowMs);
          setRetryDeadline(nowMs + result.error.retryAfterSeconds * 1000);
        } else {
          setRetryDeadline(null);
        }
        setScanError(result.error);
        return;
      }
      setRetryDeadline(null);

      // Simpan lokal sebelum navigasi (FR-20). Simpanan memori tetap ada agar
      // layar Hasil tidak kehilangan hasil ketika SQLite gagal.
      rememberScanResult(result.data);
      const db = await openDatabaseSafely();
      const saved = await saveScanResultSafely(db, result.data);

      router.push({
        pathname: '/scan/[scanId]',
        params: { saveFailed: saved ? '0' : '1', scanId: result.data.scanId },
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen avoidKeyboard>
      <Wordmark />

      {blockingError ? (
        <View style={styles.errorBlock}>
          <ScreenHeader
            onBack={dismissScanError}
            subtitle={
              blockingError.requestId ? `Kode: ${blockingError.requestId}` : undefined
            }
            title="Pemindaian gagal"
          />
          <Banner message={blockingError.message} variant="error" />
          <View style={styles.errorActions}>
            <Pressable
              accessibilityLabel="Coba lagi"
              accessibilityRole="button"
              onPress={handleScan}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryText}>Coba lagi</Text>
            </Pressable>
            {canOpenHistory ? (
              <Pressable
                accessibilityLabel="Buka Riwayat"
                accessibilityRole="button"
                onPress={openHistory}
                style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                <Text style={styles.retryText}>Buka Riwayat</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityLabel="Kembali ke input"
              accessibilityRole="button"
              onPress={dismissScanError}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Kembali</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
      <View style={styles.heading}>
        <Text style={styles.title}>Pindai repositori</Text>
        <Text style={styles.subtitle}>
          Tempel tautan repositori GitHub untuk memeriksa kerentanan dependensi.
        </Text>
      </View>

      <View style={styles.form}>
        <PillInput
          accessibilityLabel="Tautan repositori GitHub"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
          error={error}
          icon="logo-github"
          inputRef={inputRef}
          keyboardType="url"
          onBlur={() => {
            if (url.trim().length > 0) {
              setShowError(true);
            }
          }}
          onChangeText={(value) => {
            setUrl(value);
            // Pertahankan hitung mundur 429 agar pengguna tidak mengira kuota
            // sudah pulih hanya karena tautan diubah.
            if (scanError?.code !== 'RATE_LIMITED') {
              setScanError(null);
            }
          }}
          onSubmitEditing={handleScan}
          placeholder="https://github.com/pemilik/repo"
          returnKeyType="go"
          value={url}
        />

        {validation.ok && !loading ? (
          <Text style={styles.preview}>Akan memindai {validation.value.url}</Text>
        ) : null}
      </View>

      <View accessibilityRole="radiogroup" style={styles.scope}>
        {SCOPES.map((option) => {
          const selected = scope === option.value;
          return (
            <Pressable
              accessibilityLabel={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: loading }}
              disabled={loading}
              key={option.value}
              onPress={() => setScope(option.value)}
              style={[styles.scopeItem, selected && styles.scopeItemActive]}>
              <Text style={[styles.scopeLabel, selected && styles.scopeLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sessionStatus === 'error' && sessionError ? (
        <View style={styles.sessionBlock}>
          <Banner message={sessionError} title="Sesi belum siap" variant="error" />
          <View style={styles.errorActions}>
            <Pressable
              accessibilityLabel="Coba siapkan sesi"
              accessibilityRole="button"
              onPress={retrySession}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Coba lagi</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Buka Riwayat"
              accessibilityRole="button"
              onPress={openHistory}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Buka Riwayat</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <DarkCallToAction
        accessibilityHint="Memulai pemindaian dependensi repositori"
        disabled={!canScan}
        eyebrow={
          loading
            ? 'Memeriksa dependensi…'
            : sessionStatus === 'checking'
              ? 'Menyiapkan sesi…'
              : sessionStatus === 'error'
                ? 'Sesi belum siap'
                : 'Siap dipindai'
        }
        loading={loading}
        onPress={handleScan}
        title={loading ? 'Memindai…' : 'Mulai pemindaian'}
      />

      {scanError && scanErrorMessage ? (
        <View style={styles.inlineError}>
          <Banner message={scanErrorMessage} title="Pemindaian gagal" variant="error" />
          {scanError.code === 'NETWORK' ? (
            <Pressable
              accessibilityLabel="Buka Riwayat"
              accessibilityRole="button"
              onPress={openHistory}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Buka Riwayat</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading && slowHint ? (
        <Text style={styles.note}>Repositori besar bisa memakan waktu lebih lama.</Text>
      ) : null}

      <Text style={styles.note}>
        Maksimal 1.500 paket unik per pemindaian. Repositori besar dapat memakan waktu hingga 25
        detik.
      </Text>
        </>
      )}
    </Screen>
  );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
    heading: {
      gap: Spacing.two,
    },
    title: {
      ...Typography.screenTitle,
      color: theme.text,
    },
    subtitle: {
      ...Typography.body,
      color: theme.textSecondary,
    },
    form: {
      gap: Spacing.two,
    },
    preview: {
      ...Typography.meta,
      color: theme.textSecondary,
      paddingHorizontal: Spacing.three,
    },
    scope: {
      flexDirection: 'row',
      gap: Spacing.one,
      padding: 4,
      borderRadius: Radius.pill,
      backgroundColor: theme.inputFill,
      borderWidth: 1,
      borderColor: theme.inputBorder,
    },
    scopeItem: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
    },
    scopeItemActive: {
      backgroundColor: theme.darkAccent,
    },
    scopeLabel: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    scopeLabelActive: {
      color: theme.textOnDark,
      fontWeight: '600',
    },
    note: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    sessionBlock: {
      gap: Spacing.two,
      alignItems: 'flex-start',
    },
    inlineError: {
      gap: Spacing.two,
      alignItems: 'flex-start',
    },
    errorBlock: {
      gap: Spacing.three,
    },
    errorActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.two,
    },
    primaryButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
      backgroundColor: theme.darkAccent,
    },
    primaryText: {
      ...Typography.body,
      fontWeight: '600',
      color: theme.textOnDark,
    },
    retryButton: {
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
      borderWidth: 1,
      borderColor: theme.hairline,
    },
    retryText: {
      ...Typography.body,
      fontWeight: '600',
      color: theme.text,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
