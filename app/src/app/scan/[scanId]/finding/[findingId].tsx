import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/banner';
import { EmptyState } from '@/components/empty-state';
import { GlassSurface } from '@/components/glass-surface';
import { MetaChip } from '@/components/meta-chip';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { SeverityBadge } from '@/components/severity-badge';
import { Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme, type Theme } from '@/hooks/use-theme';
import {
  loadFindingForDisplay,
  openDatabaseSafely,
  type LoadedFinding,
} from '@/db/access';
import { getFixAdvice, NO_SAFE_VERSION_MESSAGE } from '@/lib/command';
import { PRIORITY_LABELS } from '@/lib/labels';
import {
  formatCvss,
  formatEpssPercentile,
  formatEpssValue,
  formatScore,
} from '@/lib/scan-summary';
import { formatLocalDateTime } from '@/lib/time';

const KEV_CATALOG_URL = 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog';
const COPY_FEEDBACK_MS = 2_500;

/** Buka tautan referensi; hasil `false` dipakai untuk menampilkan pesan. */
async function openReference(url: string): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
    return true;
  } catch {
    return false;
  }
}

type DataCardProps = {
  label: string;
  children: ReactNode;
};

/** Sel kecil pada grid data temuan. */
function DataCard({ label, children }: DataCardProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <GlassSurface style={styles.dataCard}>
      <Text style={styles.dataLabel}>{label}</Text>
      {children}
    </GlassSurface>
  );
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; loaded: LoadedFinding }
  | { status: 'missing' };

export default function FindingDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const { scanId, findingId } = useLocalSearchParams<{
    scanId?: string;
    findingId?: string;
  }>();
  const [state, setState] = useState<LoadState>(() =>
    scanId && findingId ? { status: 'loading' } : { status: 'missing' },
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [failedLink, setFailedLink] = useState<string | null>(null);

  // Detail dibaca dari SQLite; fallback ke hasil sesi ketika database gagal.
  useEffect(() => {
    if (!scanId || !findingId) return undefined;
    let active = true;

    void (async () => {
      const db = await openDatabaseSafely();
      const loaded = await loadFindingForDisplay(db, scanId, findingId);
      if (!active) return;
      setState(loaded ? { status: 'ready', loaded } : { status: 'missing' });
    })();

    return () => {
      active = false;
    };
  }, [scanId, findingId]);

  useEffect(() => {
    if (copyState === 'idle') return undefined;
    const timer = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  if (state.status === 'loading') {
    return (
      <Screen hasTabBar={false}>
        <ScreenHeader onBack={() => router.back()} title="Detail temuan" />
        <Text style={styles.loading}>Memuat temuan…</Text>
      </Screen>
    );
  }

  if (state.status === 'missing') {
    return (
      <Screen hasTabBar={false}>
        <ScreenHeader
          onBack={() => router.back()}
          subtitle="Data temuan tidak ditemukan di perangkat ini."
          title="Detail temuan"
        />
        <EmptyState
          icon="alert-circle-outline"
          message="Kembali ke daftar hasil lalu pilih temuan kembali."
          title="Temuan tidak tersedia"
        />
      </Screen>
    );
  }

  const { scan: result, finding, source } = state.loaded;
  const advice = getFixAdvice(finding);
  const warningMessage = result.warnings.map((warning) => `• ${warning.message}`).join('\n');

  const handleCopy = async (text: string) => {
    try {
      const copied = await Clipboard.setStringAsync(text);
      setCopyState(copied ? 'copied' : 'error');
    } catch {
      setCopyState('error');
    }
  };

  const handleOpenReference = async (url: string) => {
    const opened = await openReference(url);
    setFailedLink(opened ? null : url);
  };

  return (
    <Screen hasTabBar={false}>
      <ScreenHeader
        onBack={() => router.back()}
        subtitle={`${result.repo.owner}/${result.repo.name}`}
        title="Detail temuan"
      />

      {source === 'CACHE' ? (
        <View style={styles.cacheRow}>
          <MetaChip icon="cloud-offline-outline" label="data dari cache" tone="warning" />
          <Text style={styles.cacheTime}>Dipindai {formatLocalDateTime(result.scannedAt)}</Text>
        </View>
      ) : null}

      <View style={styles.identity}>
        <View style={styles.identityTop}>
          <View style={styles.identityPills}>
            <View style={styles.identityPill}>
              <Text style={styles.identityPillText}>
                {PRIORITY_LABELS[finding.priority.label]}
              </Text>
            </View>
            {result.manifest.estimated ? (
              <View style={styles.identityPill}>
                <Ionicons
                  color={theme.textOnDark}
                  name="calculator-outline"
                  size={13}
                />
                <Text style={styles.identityPillText}>Perkiraan</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.identityScore}>
            Skor prioritas {formatScore(finding.priority.score)} / 100
          </Text>
        </View>
        <Text style={styles.identityPackage}>
          {finding.package.name}
          <Text style={styles.identityVersion}>@{finding.package.installedVersion}</Text>
        </Text>
        <Text style={styles.identityReason}>{finding.priority.reason}</Text>
      </View>

      {result.manifest.estimated ? (
        <Banner
          message="Berkas package-lock.json tidak ditemukan atau tidak dapat dibaca; hanya dependensi langsung yang diperiksa."
          title="Hasil perkiraan"
          variant="warning"
        />
      ) : null}

      {result.partial ? (
        <Banner
          message={warningMessage || 'Sebagian data pengayaan tidak tersedia; label dapat berubah setelah data lengkap.'}
          title="Hasil parsial"
          variant="warning"
        />
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data temuan</Text>
        <View style={styles.grid}>
          <DataCard label="Tingkat keparahan">
            <SeverityBadge level={finding.severity.level} />
            <Text style={styles.dataValue}>{formatCvss(finding.severity.cvss)}</Text>
          </DataCard>

          <DataCard label="EPSS">
            <Text style={styles.dataValue}>
              {formatEpssValue(finding.exploitation.epss, finding.exploitation.epssAvailable)}
            </Text>
            <Text style={styles.dataMeta}>
              {formatEpssPercentile(
                finding.exploitation.epssPercentile,
                finding.exploitation.epssAvailable,
              )}
            </Text>
          </DataCard>

          <DataCard label="CISA KEV">
            <Text style={styles.dataValue}>
              {finding.exploitation.kev ? 'Ada di katalog' : 'Tidak ada'}
            </Text>
            {finding.exploitation.kev ? (
              <Pressable
                accessibilityHint="Membuka katalog KEV CISA di peramban"
                accessibilityLabel="Buka katalog KEV CISA"
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => handleOpenReference(KEV_CATALOG_URL)}
                style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}>
                <Text style={styles.inlineLinkText}>Buka katalog KEV</Text>
                <Ionicons color={theme.text} name="open-outline" size={14} />
              </Pressable>
            ) : null}
          </DataCard>

          <DataCard label="Versi aman">
            <Text style={styles.dataValue}>
              {finding.fix.safeVersion ?? NO_SAFE_VERSION_MESSAGE}
            </Text>
          </DataCard>
        </View>
      </View>

      <GlassSurface style={styles.fixCard} variant="strong">
        <Text style={styles.sectionTitle}>Perbaikan</Text>

        {advice.kind === 'command' ? (
          <>
            <Text style={styles.body}>Jalankan perintah berikut di folder proyek:</Text>
            <View style={styles.commandBox}>
              <Text selectable style={styles.commandText}>
                {advice.command}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Salin perintah"
              accessibilityRole="button"
              onPress={() => handleCopy(advice.command)}
              style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}>
              <Ionicons color={theme.textOnDark} name="copy-outline" size={16} />
              <Text style={styles.copyButtonText}>Salin perintah</Text>
            </Pressable>
            {copyState === 'copied' ? (
              <Banner message="Perintah disalin" variant="success" />
            ) : null}
            {copyState === 'error' ? (
              <Banner
                message="Perintah tidak dapat disalin otomatis. Salin teks perintah secara manual."
                variant="error"
              />
            ) : null}
          </>
        ) : null}

        {advice.kind === 'transitive' ? (
          <>
            <Text style={styles.body}>{advice.message}</Text>
            <Text style={styles.note}>
              {finding.package.parentPackage
                ? `Paket induk: ${finding.package.parentPackage}.`
                : 'Paket ini masuk sebagai dependensi transitif.'}
            </Text>
          </>
        ) : null}

        {advice.kind === 'unavailable' ? (
          <>
            <Text style={styles.body}>{advice.message}</Text>
            {finding.fix.suggestion ? (
              <Text style={styles.note}>{finding.fix.suggestion}</Text>
            ) : null}
          </>
        ) : null}
      </GlassSurface>

      <GlassSurface style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Ringkasan dampak</Text>
        <Text style={styles.body}>{finding.summary}</Text>
        <Text style={styles.note}>Ringkasan dikutip dari laporan kerentanan dan tidak diterjemahkan ulang.</Text>
      </GlassSurface>

      <View style={styles.chips}>
        <MetaChip label={`OSV ${finding.osvId}`} />
        {finding.cveIds.length > 0 ? (
          finding.cveIds.map((cve) => <MetaChip key={cve} label={cve} />)
        ) : (
          <MetaChip label="CVE tidak tersedia" tone="warning" />
        )}
      </View>

      <GlassSurface style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Referensi</Text>
        {failedLink ? (
          <Banner
            message={`Tautan tidak dapat dibuka. Salin alamat berikut secara manual: ${failedLink}`}
            variant="error"
          />
        ) : null}
        {finding.references.length === 0 ? (
          <Text style={styles.body}>Tidak ada tautan referensi pada laporan kerentanan ini.</Text>
        ) : (
          finding.references.map((reference, index) => (
            <Pressable
              accessibilityHint="Membuka tautan di peramban"
              accessibilityLabel={`Buka referensi: ${reference.label}`}
              accessibilityRole="link"
              key={`${reference.url}-${index}`}
              onPress={() => handleOpenReference(reference.url)}
              style={({ pressed }) => [styles.reference, pressed && styles.pressed]}>
              <View style={styles.referenceTexts}>
                <Text style={styles.referenceLabel}>{reference.label}</Text>
                <Text selectable style={styles.referenceUrl}>
                  {reference.url}
                </Text>
              </View>
              <Ionicons color={theme.textSecondary} name="open-outline" size={16} />
            </Pressable>
          ))
        )}
      </GlassSurface>
    </Screen>
  );
}

function createStyles(theme: Theme) {
    return StyleSheet.create({
    loading: {
      ...Typography.body,
      color: theme.textSecondary,
    },
    cacheRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.two,
    },
    cacheTime: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    identity: {
      padding: Spacing.four,
      gap: Spacing.two,
      borderRadius: Radius.card,
      backgroundColor: theme.darkCard,
    },
    identityTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.two,
      flexWrap: 'wrap',
    },
    identityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
      backgroundColor: theme.darkAccent,
      borderWidth: 1,
      borderColor: theme.textMutedOnDark,
    },
    identityPills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.one,
    },
    identityPillText: {
      ...Typography.meta,
      fontWeight: '600',
      color: theme.textOnDark,
    },
    identityScore: {
      ...Typography.meta,
      color: theme.textMutedOnDark,
    },
    identityPackage: {
      ...Typography.darkCardTitle,
      color: theme.textOnDark,
    },
    identityVersion: {
      fontSize: 20,
      lineHeight: 28,
      color: theme.textMutedOnDark,
    },
    identityReason: {
      ...Typography.body,
      color: theme.textMutedOnDark,
    },
    section: {
      gap: Spacing.gap,
    },
    sectionTitle: {
      ...Typography.sectionTitle,
      color: theme.text,
    },
    sectionCard: {
      padding: Spacing.four,
      gap: Spacing.two,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.gap,
    },
    dataCard: {
      flexBasis: '46%',
      flexGrow: 1,
      padding: Spacing.three,
      gap: Spacing.one,
    },
    dataLabel: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    dataValue: {
      ...Typography.body,
      fontWeight: '600',
      color: theme.text,
    },
    dataMeta: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    inlineLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.one,
      minHeight: 24,
    },
    inlineLinkText: {
      ...Typography.meta,
      fontWeight: '600',
      color: theme.text,
      textDecorationLine: 'underline',
    },
    body: {
      ...Typography.body,
      color: theme.text,
    },
    note: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    fixCard: {
      padding: Spacing.four,
      gap: Spacing.two,
    },
    commandBox: {
      padding: Spacing.three,
      borderRadius: Radius.banner,
      backgroundColor: theme.darkAccent,
    },
    commandText: {
      ...Typography.code,
      fontFamily: Fonts?.mono,
      color: theme.textOnDark,
    },
    copyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.two,
      minHeight: 44,
      paddingHorizontal: Spacing.three,
      borderRadius: Radius.pill,
      backgroundColor: theme.darkCard,
    },
    copyButtonText: {
      ...Typography.body,
      fontWeight: '600',
      color: theme.textOnDark,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.one,
    },
    reference: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.two,
      minHeight: 44,
      paddingVertical: Spacing.two,
      borderTopWidth: 1,
      borderTopColor: theme.hairline,
    },
    referenceTexts: {
      flex: 1,
      gap: Spacing.half,
    },
    referenceLabel: {
      ...Typography.body,
      fontWeight: '500',
      color: theme.text,
    },
    referenceUrl: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
