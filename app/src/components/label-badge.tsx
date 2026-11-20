import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { PRIORITY_LABELS } from '@/lib/labels';
import type { PriorityLabel } from '@/types/scan';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type LabelBadgeProps = {
  label: PriorityLabel;
  /** Angka jumlah temuan; dipakai pada chip ringkasan. */
  count?: number;
};

type LabelConfig = {
  background: string;
  color: string;
  icon: IoniconName;
  iconColor: string;
};

export function LabelBadge({ label, count }: LabelBadgeProps) {
  const theme = useTheme();
  const config = labelConfig(theme)[label];
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

function labelConfig(theme: Theme): Record<PriorityLabel, LabelConfig> {
  return {
    FIX_NOW: {
      background: theme.darkCard,
      color: theme.textOnDark,
      icon: 'flame',
      iconColor: theme.textOnDark,
    },
    SCHEDULE: {
      background: theme.warningSurface,
      color: theme.text,
      icon: 'calendar-outline',
      iconColor: theme.warning,
    },
    MONITOR: {
      background: theme.infoSurface,
      color: theme.text,
      icon: 'eye-outline',
      iconColor: theme.textSecondary,
    },
  };
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
