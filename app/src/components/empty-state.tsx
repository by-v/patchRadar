import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

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
  return (
    <GlassSurface style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons color={Colors.light.textSecondary} name={icon} size={24} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons color={Colors.light.text} name="arrow-forward" size={16} />
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
    backgroundColor: Colors.light.glassFill,
    borderWidth: 1,
    borderColor: Colors.light.glassBorder,
  },
  title: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
  message: {
    ...Typography.body,
    color: Colors.light.textSecondary,
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
    borderColor: Colors.light.hairline,
  },
  actionText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pressed: {
    opacity: 0.7,
  },
});
