import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing, Typography } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Bila diisi, tombol kembali tampil di kiri. */
  onBack?: () => void;
  /** Elemen di kanan judul, mis. tombol pindai ulang. */
  right?: ReactNode;
  /** Konten kecil di atas judul, mis. wordmark. */
  eyebrow?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right, eyebrow }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      {eyebrow}
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            accessibilityLabel="Kembali"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Ionicons color={Colors.light.text} name="chevron-back" size={20} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  titles: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    ...Typography.screenTitle,
    color: Colors.light.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.glassFill,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
