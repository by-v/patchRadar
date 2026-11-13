import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Banner } from '@/components/banner';
import { EmptyState } from '@/components/empty-state';
import { FindingCard } from '@/components/finding-card';
import { GlassSurface } from '@/components/glass-surface';
import { LabelBadge } from '@/components/label-badge';
import { MetaChip } from '@/components/meta-chip';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { getRememberedScan } from '@/lib/scan-session';
import {
  countFindingsByLabel,
  nonEmptyLabelCounts,
} from '@/lib/scan-summary';
import { formatRelativeTime } from '@/lib/time';

/** PRD FR-17: di atas target 500 paket, tampilkan penjelasan repo besar. */
const LARGE_REPO_THRESHOLD = 500;

export default function ScanResultScreen() {
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();
  const result = scanId ? getRememberedScan(scanId) : null;
  const goToScan = () => router.navigate('/');

  if (!result) {
    return (
      <Screen hasTabBar={false}>
        <ScreenHeader
          onBack={() => router.back()}
          subtitle="Data hasil tidak ditemukan pada sesi ini."
          title="Hasil pemindaian"
        />
        <EmptyState
          actionLabel="Kembali ke Pindai"
          icon="alert-circle-outline"
          message="Hasil hanya tersimpan selama sesi aplikasi. Pindai ulang repositori untuk melihat hasil terbaru."
          onAction={goToScan}
          title="Hasil tidak tersedia"
        />
      </Screen>
    );
  }

  const labelCounts = nonEmptyLabelCounts(countFindingsByLabel(result.findings));
  const warningMessage = result.warnings.map((warning) => `• ${warning.message}`).join('\n');
  const otherWarnings = result.partial
    ? []
    : result.warnings.filter(
        (warning) => !(result.manifest.estimated && warning.code === 'LOCKFILE_MISSING'),
      );
  const otherWarningMessage = otherWarnings
    .map((warning) => `• ${warning.message}`)
    .join('\n');
  const isLargeRepo = result.summary.totalPackages > LARGE_REPO_THRESHOLD;

  return (
    <Screen hasTabBar={false}>
      <ScreenHeader
        onBack={() => router.back()}
        right={
          <Pressable
            accessibilityHint="Membuka tab Pindai"
            accessibilityLabel="Pindai repositori lain"
            accessibilityRole="button"
            hitSlop={8}
            onPress={goToScan}
            style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
            <Ionicons color={Colors.light.text} name="refresh" size={18} />
          </Pressable>
        }
        subtitle={`Dipindai ${formatRelativeTime(result.scannedAt)}`}
        title={`${result.repo.owner}/${result.repo.name}`}
      />

      <GlassSurface style={styles.summary} variant="strong">
        <View style={styles.summaryTop}>
          <View style={styles.summaryNumberBlock}>
            <Text style={styles.summaryEyebrow}>Total temuan</Text>
            <Text style={styles.summaryNumber}>{result.summary.findingCount}</Text>
          </View>
          <View style={styles.summaryChips}>
            {result.manifest.estimated ? (
              <MetaChip icon="calculator-outline" label="Perkiraan" tone="warning" />
            ) : null}
            {labelCounts.map(({ label, count }) => (
              <LabelBadge count={count} key={label} label={label} />
            ))}
          </View>
        </View>
        <Text style={styles.summaryText}>
          {result.summary.totalPackages} paket diperiksa, {result.summary.affectedPackages} punya
          temuan
        </Text>
      </GlassSurface>

      {isLargeRepo ? (
        <Banner
          message="Repositori besar; pemindaian bisa lebih lama dari biasanya."
          title="Repositori besar"
        />
      ) : null}

      {result.manifest.estimated ? (
        <Banner
          message="Berkas package-lock.json tidak ditemukan atau tidak dapat dibaca; hanya dependensi langsung yang diperiksa."
          title="Hasil perkiraan"
          variant="warning"
        />
      ) : null}

      {result.partial ? (
        <Banner
          message={warningMessage || 'Sebagian data mungkin tidak lengkap.'}
          title="Hasil parsial"
          variant="warning"
        />
      ) : null}

      {otherWarningMessage ? (
        <Banner message={otherWarningMessage} title="Catatan pemindaian" variant="info" />
      ) : null}

      {result.findings.length === 0 ? (
        <EmptyState
          actionLabel="Pindai repositori lain"
          icon="shield-outline"
          message="Hasil ini potensial dan tidak menjamin proyek bebas risiko."
          onAction={goToScan}
          title="Tidak ada temuan pada data yang diperiksa"
        />
      ) : (
        <View style={styles.list}>
          <Text style={styles.listTitle}>Daftar temuan</Text>
          {result.findings.map((finding) => (
            <FindingCard
              finding={finding}
              key={finding.findingId}
              onPress={() =>
                router.push({
                  pathname: '/scan/[scanId]/finding/[findingId]',
                  params: { scanId: result.scanId, findingId: finding.findingId },
                })
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
    backgroundColor: Colors.light.glassFill,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  summary: {
    padding: Spacing.four,
    gap: Spacing.three,
    borderRadius: Radius.card,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  summaryNumberBlock: {
    gap: Spacing.half,
  },
  summaryEyebrow: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  summaryNumber: {
    ...Typography.displayNumber,
    color: Colors.light.text,
  },
  summaryChips: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  summaryText: {
    ...Typography.body,
    color: Colors.light.text,
    fontWeight: '500',
  },
  list: {
    gap: Spacing.gap,
  },
  listTitle: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
});
