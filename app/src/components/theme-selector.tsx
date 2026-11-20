import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ThemeMode } from '@/lib/theme-preference';
import { useThemeMode } from '@/providers/theme-mode-provider';

type Option = {
  mode: ThemeMode;
  label: string;
  description: string;
  icon: 'moon-outline' | 'sunny-outline';
};

const OPTIONS: Option[] = [
  {
    mode: 'dark',
    label: 'Gelap',
    description: 'Latar gelap dengan teks terang.',
    icon: 'moon-outline',
  },
  {
    mode: 'light',
    label: 'Terang',
    description: 'Latar terang dengan teks gelap.',
    icon: 'sunny-outline',
  },
];

/** Dua pilihan tema manual; sengaja tidak ada opsi "Ikuti sistem". */
export function ThemeSelector() {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();

  return (
    <GlassSurface style={styles.card}>
      <View style={styles.options}>
        {OPTIONS.map((option) => {
          const active = mode === option.mode;

          return (
            <Pressable
              accessibilityLabel={`Tema ${option.label}`}
              accessibilityRole="radio"
              aria-checked={active}
              key={option.mode}
              onPress={() => setMode(option.mode)}
              style={({ pressed }) => [
                styles.option,
                active && { backgroundColor: theme.darkAccent },
                pressed && styles.pressed,
              ]}>
              <Ionicons
                color={active ? theme.textOnDark : theme.textSecondary}
                name={option.icon}
                size={22}
              />
              <View style={styles.texts}>
                <Text
                  style={[styles.label, { color: active ? theme.textOnDark : theme.text }]}>
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.description,
                    { color: active ? theme.textMutedOnDark : theme.textSecondary },
                  ]}>
                  {option.description}
                </Text>
              </View>
              {active ? <Ionicons color={theme.textOnDark} name="checkmark-circle" size={20} /> : null}
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.two,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 64,
    padding: Spacing.two,
    borderRadius: Radius.banner,
  },
  texts: {
    flex: 1,
    gap: Spacing.half,
  },
  label: {
    ...Typography.sectionTitle,
  },
  description: {
    ...Typography.meta,
  },
  pressed: {
    opacity: 0.7,
  },
});
