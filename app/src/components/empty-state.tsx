import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type EmptyStateProps = {
  title: string;
  message: string;
  icon?: IoniconName;
  actionLabel?: string;
  onAction?: () => void;
};

/** Empty state netral; tidak pernah mengklaim proyek aman. */
export function EmptyState({
  title,
  message,
  icon = 'information-circle-outline',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <GlassSurface style={styles.card}>
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: theme.glassFill, borderColor: theme.glassBorder },
        ]}>
        <Ionicons color={theme.textSecondary} name={icon} size={24} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        {title}
      </Text>
      <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [
            styles.action,
            { borderColor: theme.hairline },
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.actionText, { color: theme.text }]}>{actionLabel}</Text>
          <Ionicons color={theme.text} name="arrow-forward" size={16} />
        </Pressable>
      ) : null}
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  title: {
    ...Typography.sectionTitle,
  },
  message: {
    ...Typography.body,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  actionText: {
    ...Typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
