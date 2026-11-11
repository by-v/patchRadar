import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, Spacing, Typography } from '@/constants/theme';

const LABELS = [
  {
    title: 'Tambal sekarang',
    description: 'Ada eksploitasi nyata (KEV), atau severity Critical dengan peluang eksploitasi tinggi.',
  },
  {
    title: 'Jadwalkan',
    description: 'Risiko tinggi, tetapi belum ada bukti eksploitasi yang kuat.',
  },
  {
    title: 'Pantau',
    description: 'Belum ada indikasi eksploitasi dan severity relatif rendah.',
  },
];

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Screen>
      <ScreenHeader
        subtitle="Arti label, sumber data, dan batas penggunaan."
        title="Tentang PatchRadar"
      />

      <Text style={styles.intro}>
        PatchRadar memeriksa dependensi repositori GitHub dan mengurutkan temuan berdasarkan risiko
        yang dapat ditindaklanjuti.
      </Text>

      <View style={styles.cards}>
        {LABELS.map((label) => (
          <GlassSurface key={label.title} style={styles.card}>
            <Text style={styles.cardTitle}>{label.title}</Text>
            <Text style={styles.cardBody}>{label.description}</Text>
          </GlassSurface>
        ))}
      </View>

      <Text style={styles.note}>
        Severity berasal dari OSV, EPSS dari FIRST, dan KEV dari katalog CISA. PatchRadar bukan
        pengganti audit keamanan.
      </Text>
      <Text style={styles.version}>Versi {version}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  cards: {
    gap: Spacing.gap,
  },
  card: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardTitle: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
  cardBody: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  note: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
  version: {
    ...Typography.meta,
    color: Colors.light.textSecondary,
  },
});
