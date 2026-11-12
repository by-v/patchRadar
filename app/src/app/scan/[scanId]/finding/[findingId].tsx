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
import { Colors, Fonts, Radius, Spacing, Typography } from '@/constants/theme';
import { getFixAdvice, NO_SAFE_VERSION_MESSAGE } from '@/lib/command';
import { PRIORITY_LABELS } from '@/lib/labels';
import { getRememberedScan } from '@/lib/scan-session';
import {
  formatCvss,
  formatEpssPercentile,
  formatEpssValue,
  formatScore,
} from '@/lib/scan-summary';

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
  return (
    <GlassSurface style={styles.dataCard}>
      <Text style={styles.dataLabel}>{label}</Text>
      {children}
    </GlassSurface>
  );
}

export default function FindingDetailScreen() {
  const router = useRouter();
  const { scanId, findingId } = useLocalSearchParams<{
    scanId?: string;
    findingId?: string;
  }>();
  const result = scanId ? getRememberedScan(scanId) : null;
  const finding = result?.findings.find((entry) => entry.findingId === findingId) ?? null;

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [failedLink, setFailedLink] = useState<string | null>(null);

  useEffect(() => {
    if (copyState === 'idle') return undefined;
    const timer = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  if (!result || !finding) {
    return (
      <Screen hasTabBar={false}>
        <ScreenHeader
          onBack={() => router.back()}
          subtitle="Data temuan tidak ditemukan pada sesi ini."
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
                  color={Colors.light.textOnDark}
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
          message="Lockfile tidak ditemukan atau tidak dapat dibaca; hanya dependensi langsung yang diperiksa."
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
          <DataCard label="Severity">
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
                accessibilityHint="Membuka katalog KEV CISA di browser"
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => handleOpenReference(KEV_CATALOG_URL)}
                style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}>
                <Text style={styles.inlineLinkText}>Buka katalog KEV</Text>
                <Ionicons color={Colors.light.text} name="open-outline" size={14} />
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
              <Ionicons color={Colors.light.textOnDark} name="copy-outline" size={16} />
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
        <Text style={styles.note}>Ringkasan dikutip dari advisory dan tidak diterjemahkan ulang.</Text>
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
          <Text style={styles.body}>Tidak ada tautan referensi pada advisory ini.</Text>
        ) : (
          finding.references.map((reference, index) => (
            <Pressable
              accessibilityHint="Membuka tautan di browser"
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
              <Ionicons color={Colors.light.textSecondary} name="open-outline" size={16} />
            </Pressable>
          ))
        )}
      </GlassSurface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    padding: Spacing.four,
    gap: Spacing.two,
    borderRadius: Radius.card,
    backgroundColor: Colors.light.darkCard,
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
    backgroundColor: Colors.light.darkAccent,
    borderWidth: 1,
    borderColor: Colors.light.textMutedOnDark,
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
    color: Colors.light.textOnDark,
  },
  identityScore: {
    ...Typography.meta,
    color: Colors.light.textMutedOnDark,
  },
  identityPackage: {
    ...Typography.darkCardTitle,
    color: Colors.light.textOnDark,
  },
  identityVersion: {
    fontSize: 20,
    lineHeight: 28,
    color: Colors.light.textMutedOnDark,
  },
  identityReason: {
    ...Typography.body,
    color: Colors.light.textMutedOnDark,
  },
  section: {
    gap: Spacing.gap,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
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
    color: Colors.light.textSecondary,
  },
  dataValue: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.text,
  },
  dataMeta: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
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
    color: Colors.light.text,
    textDecorationLine: 'underline',
  },
  body: {
    ...Typography.body,
    color: Colors.light.text,
  },
  note: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  fixCard: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  commandBox: {
    padding: Spacing.three,
    borderRadius: Radius.banner,
    backgroundColor: Colors.light.darkAccent,
  },
  commandText: {
    ...Typography.code,
    fontFamily: Fonts?.mono,
    color: Colors.light.textOnDark,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    backgroundColor: Colors.light.darkCard,
  },
  copyButtonText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.textOnDark,
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
    borderTopColor: Colors.light.hairline,
  },
  referenceTexts: {
    flex: 1,
    gap: Spacing.half,
  },
  referenceLabel: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.light.text,
  },
  referenceUrl: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
});
