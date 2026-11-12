import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type MetaChipProps = {
  label: string;
  icon?: IoniconName;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
};

const CONFIG = {
  neutral: {
    background: Colors.light.glassFill,
    border: Colors.light.hairline,
    color: Colors.light.textSecondary,
  },
  danger: {
    background: Colors.light.dangerSurface,
    border: Colors.light.danger,
    color: Colors.light.danger,
  },
  warning: {
    background: Colors.light.warningSurface,
    border: Colors.light.warning,
    color: Colors.light.text,
  },
  success: {
    background: Colors.light.successSurface,
    border: Colors.light.success,
    color: Colors.light.success,
  },
} as const;

/** Chip kecil untuk KEV, EPSS, dan tag paket. */
export function MetaChip({ label, icon, tone = 'neutral' }: MetaChipProps) {
  const config = CONFIG[tone];

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="text"
      style={[styles.chip, { backgroundColor: config.background, borderColor: config.border }]}>
      {icon ? <Ionicons color={config.color} name={icon} size={12} /> : null}
      <Text style={[styles.text, { color: config.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  text: {
    ...Typography.meta,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
});
