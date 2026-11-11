import { StyleSheet, Text } from 'react-native';

import { Colors } from '@/constants/theme';

type WordmarkProps = {
  /** `light` untuk latar terang, `dark` untuk kartu gelap. */
  tone?: 'light' | 'dark';
};

/**
 * Wordmark tipografis: "Patch" berbobot tebal, "Radar" ringan.
 * Tidak memakai aset gambar agar tetap tajam di semua kerapatan layar.
 */
export function Wordmark({ tone = 'light' }: WordmarkProps) {
  const color = tone === 'dark' ? Colors.light.textOnDark : Colors.light.text;

  return (
    <Text accessible={false} maxFontSizeMultiplier={1.4} style={[styles.base, { color }]}>
      Patch<Text style={styles.accent}>Radar</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  accent: {
    fontWeight: '300',
  },
});
