import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();

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
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.glassFill, borderColor: theme.glassBorder },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={theme.text} name="chevron-back" size={20} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          ) : null}
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
  },
  subtitle: {
    ...Typography.body,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
});
