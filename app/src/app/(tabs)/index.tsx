import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { requestScan } from '@/api/scan';
import { Banner } from '@/components/banner';
import { DarkCallToAction } from '@/components/dark-cta';
import { PillInput } from '@/components/pill-input';
import { Screen } from '@/components/screen';
import { Wordmark } from '@/components/wordmark';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
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
  const inputRef = useRef<TextInputInstance>(null);

  const validation = parseRepoLink(url);
  const error = showError && !validation.ok ? validation.error.message : undefined;
  const canScan = validation.ok && !loading;

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = setTimeout(() => setSlowHint(true), SLOW_HINT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [loading]);

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
      const result = await requestScan({ repoUrl: validation.value.url });
      if (!result.ok) {
        setScanError(result.error);
        return;
      }

      rememberScanResult(result.data);
      router.push({
        pathname: '/scan/[scanId]',
        params: { scanId: result.data.scanId },
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

      <DarkCallToAction
        accessibilityHint="Memulai pemindaian dependensi repositori"
        disabled={!canScan}
        eyebrow={loading ? 'Memeriksa dependensi…' : 'Siap dipindai'}
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
});
