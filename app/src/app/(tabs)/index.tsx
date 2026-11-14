import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { requestScan } from '@/api/scan';
import { AUTH_MESSAGES, ensureSession, refreshSession } from '@/auth/session';
import { Banner } from '@/components/banner';
import { DarkCallToAction } from '@/components/dark-cta';
import { PillInput } from '@/components/pill-input';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { openDatabaseSafely, saveScanResultSafely } from '@/db/access';
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
  const inputRef = useRef<TextInputInstance>(null);

  const validation = parseRepoLink(url);
  const error = showError && !validation.ok ? validation.error.message : undefined;
  const canScan = validation.ok && !loading && sessionStatus === 'ready';

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
        setScanError(result.error);
        return;
      }

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
            setScanError(null);
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
          <Pressable
            accessibilityLabel="Coba siapkan sesi"
            accessibilityRole="button"
            onPress={retrySession}
            style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Coba lagi</Text>
          </Pressable>
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

      {scanError ? (
        <Banner message={scanError.message} title="Pemindaian gagal" variant="error" />
      ) : null}

      {loading && slowHint ? (
        <Text style={styles.note}>Repositori besar bisa memakan waktu lebih lama.</Text>
      ) : null}

      <Text style={styles.note}>
        Maksimal 1.500 paket unik per pemindaian. Repositori besar dapat memakan waktu hingga 25
        detik.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    gap: Spacing.two,
  },
  title: {
    ...Typography.screenTitle,
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  form: {
    gap: Spacing.two,
  },
  preview: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
    paddingHorizontal: Spacing.three,
  },
  scope: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.light.inputFill,
    borderWidth: 1,
    borderColor: Colors.light.inputBorder,
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
    backgroundColor: Colors.light.darkAccent,
  },
  scopeLabel: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  scopeLabelActive: {
    color: Colors.light.textOnDark,
    fontWeight: '600',
  },
  note: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  sessionBlock: {
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.light.hairline,
  },
  retryText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
