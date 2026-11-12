import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Shadows, Spacing, Typography } from '@/constants/theme';

type DarkCallToActionProps = {
  /** Label kecil di atas judul. */
  eyebrow: string;
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
};

export function DarkCallToAction({
  eyebrow,
  title,
  onPress,
  disabled = false,
  loading = false,
  accessibilityHint,
}: DarkCallToActionProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        Shadows.glass,
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
      ]}>
      <View style={styles.texts}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.arrow}>
        {loading ? (
          <ActivityIndicator color={Colors.light.text} size="small" />
        ) : (
          <Ionicons color={Colors.light.text} name="arrow-forward" size={20} />
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
    backgroundColor: Colors.light.darkCard,
  },
  texts: {
    flex: 1,
    gap: Spacing.one,
  },
  eyebrow: {
    ...Typography.meta,
    color: Colors.light.textMutedOnDark,
  },
  title: {
    ...Typography.darkCardTitle,
    color: Colors.light.textOnDark,
  },
  arrow: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.textOnDark,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.85,
  },
});
