import { StyleSheet, Text } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Spacing, Typography } from '@/constants/theme';

export default function HistoryScreen() {
  return (
    <Screen>
      <ScreenHeader
        subtitle="Pemindaian tersimpan di perangkat ini."
        title="Riwayat"
      />

      <GlassSurface style={styles.empty}>
        <Text style={styles.emptyTitle}>Belum ada pemindaian</Text>
        <Text style={styles.emptyBody}>
          Hasil pemindaian akan muncul di sini setelah kamu memindai sebuah repositori.
        </Text>
      </GlassSurface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  emptyTitle: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
  emptyBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
});
