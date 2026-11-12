import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { PRIORITY_LABELS } from '@/lib/labels';
import type { PriorityLabel } from '@/types/scan';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type LabelBadgeProps = {
  label: PriorityLabel;
  /** Angka jumlah temuan; dipakai pada chip ringkasan. */
  count?: number;
};

const CONFIG: Readonly<
  Record<PriorityLabel, { background: string; color: string; icon: IoniconName; iconColor: string }>
> = {
  FIX_NOW: {
    background: Colors.light.darkCard,
    color: Colors.light.textOnDark,
    icon: 'flame',
    iconColor: Colors.light.textOnDark,
  },
  SCHEDULE: {
    background: Colors.light.warningSurface,
    color: Colors.light.text,
    icon: 'calendar-outline',
    iconColor: Colors.light.warning,
  },
  MONITOR: {
    background: Colors.light.infoSurface,
    color: Colors.light.text,
    icon: 'eye-outline',
    iconColor: Colors.light.textSecondary,
  },
};

export function LabelBadge({ label, count }: LabelBadgeProps) {
  const config = CONFIG[label];
  const text = PRIORITY_LABELS[label];

  return (
    <View
      accessibilityLabel={count === undefined ? `Label ${text}` : `${text}: ${count} temuan`}
      accessibilityRole="text"
      style={[styles.badge, { backgroundColor: config.background }]}>
      <Ionicons color={config.iconColor} name={config.icon} size={13} />
      <Text style={[styles.text, { color: config.color }]}>
        {text}
        {count === undefined ? '' : ` · ${count}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  text: {
    ...Typography.meta,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
