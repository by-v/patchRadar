import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type DarkCallToActionProps = {
  /** Label kecil di atas judul. */
  eyebrow: string;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  /** Label pembaca layar; bawaannya judul tombol. */
  accessibilityLabel?: string;
};

export function DarkCallToAction({
  eyebrow,
  title,
  onPress,
  disabled = false,
  loading = false,
  accessibilityHint,
  accessibilityLabel,
}: DarkCallToActionProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        Shadows.glass,
        { backgroundColor: theme.darkCard },
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <View style={styles.texts}>
        <Text style={[styles.eyebrow, { color: theme.textMutedOnDark }]}>{eyebrow}</Text>
        <Text style={[styles.title, { color: theme.textOnDark }]}>{title}</Text>
      </View>
      <View style={[styles.arrow, { backgroundColor: theme.textOnDark }]}>
        {loading ? (
          <ActivityIndicator color={theme.darkCard} size="small" />
        ) : (
          <Ionicons color={theme.darkCard} name="arrow-forward" size={20} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.card,
  },
  texts: {
    flex: 1,
    gap: Spacing.one,
  },
  eyebrow: {
    ...Typography.meta,
  },
  title: {
    ...Typography.darkCardTitle,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.85,
  },
});
