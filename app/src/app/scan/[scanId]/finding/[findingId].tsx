import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { GlassSurface } from '@/components/glass-surface';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getRememberedScan } from '@/lib/scan-session';

/** Placeholder; layar Detail lengkap diisi pada T-W2-05. */
export default function FindingDetailScreen() {
  const router = useRouter();
  const { scanId, findingId } = useLocalSearchParams<{
    scanId?: string;
    findingId?: string;
  }>();
  const result = scanId ? getRememberedScan(scanId) : null;
  const finding = result?.findings.find((entry) => entry.findingId === findingId) ?? null;

  if (!finding) {
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

  return (
    <Screen hasTabBar={false}>
      <ScreenHeader
        onBack={() => router.back()}
        subtitle="Detail lengkap akan diisi pada tugas berikutnya."
        title={`${finding.package.name}@${finding.package.installedVersion}`}
      />

      <GlassSurface style={styles.card}>
        <Text style={styles.label}>ID temuan</Text>
        <Text style={styles.value}>{finding.findingId}</Text>
      </GlassSurface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  label: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  value: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
});
