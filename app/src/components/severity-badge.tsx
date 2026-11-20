import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { SEVERITY_LABELS } from '@/lib/labels';
import type { SeverityLevel } from '@/types/scan';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type SeverityBadgeProps = {
  level: SeverityLevel;
};

const ICONS: Record<SeverityLevel, IoniconName> = {
  CRITICAL: 'alert',
  HIGH: 'warning-outline',
  MEDIUM: 'contrast-outline',
  LOW: 'ellipse-outline',
  UNKNOWN: 'help-circle-outline',
};

/** Severity selalu ditampilkan dengan ikon + teks, bukan warna saja. */
export function SeverityBadge({ level }: SeverityBadgeProps) {
  const theme = useTheme();
  const label = SEVERITY_LABELS[level];

  return (
    <View
      accessibilityLabel={`Tingkat keparahan ${label}`}
      accessibilityRole="text"
      style={[styles.badge, { backgroundColor: severityBackground(theme)[level] }]}>
      <Ionicons color={theme.textOnStatus} name={ICONS[level]} size={13} />
      <Text style={[styles.text, { color: theme.textOnStatus }]}>{label}</Text>
    </View>
  );
}

function severityBackground(theme: Theme): Record<SeverityLevel, string> {
  return {
    CRITICAL: theme.severityCritical,
    HIGH: theme.severityHigh,
    MEDIUM: theme.severityMedium,
    LOW: theme.severityLow,
    UNKNOWN: theme.severityUnknown,
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
