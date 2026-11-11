import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Spacing, Typography } from '@/constants/theme';

export default function ScanResultScreen() {
  const router = useRouter();
  const { scanId } = useLocalSearchParams<{ scanId: string }>();

  return (
    <Screen hasTabBar={false}>
      <ScreenHeader
        onBack={() => router.back()}
        subtitle="Layar hasil akan diisi pada tugas berikutnya."
        title="Hasil pemindaian"
      />

      <GlassSurface style={styles.card}>
        <Text style={styles.label}>ID pemindaian</Text>
        <Text style={styles.value}>{scanId ?? 'tidak diketahui'}</Text>
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
