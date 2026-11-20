import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme, type Theme } from '@/hooks/use-theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type MetaChipProps = {
  label: string;
  icon?: IoniconName;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
};

type ToneConfig = {
  background: string;
  border: string;
  color: string;
};

/** Chip kecil untuk KEV, EPSS, dan tag paket. */
export function MetaChip({ label, icon, tone = 'neutral' }: MetaChipProps) {
  const theme = useTheme();
  const config = toneConfig(theme)[tone];

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

function toneConfig(theme: Theme): Record<MetaChipProps['tone'] & {}, ToneConfig> {
  return {
    neutral: {
      background: theme.glassFill,
      border: theme.hairline,
      color: theme.text,
    },
    danger: {
      background: theme.dangerSurface,
      border: theme.danger,
      color: theme.text,
    },
    warning: {
      background: theme.warningSurface,
      border: theme.warning,
      color: theme.text,
    },
    success: {
      background: theme.successSurface,
      border: theme.success,
      color: theme.text,
    },
  };
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
