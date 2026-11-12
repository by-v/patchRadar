import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { SEVERITY_LABELS } from '@/lib/labels';
import type { SeverityLevel } from '@/types/scan';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type SeverityBadgeProps = {
  level: SeverityLevel;
};

const CONFIG: Readonly<Record<SeverityLevel, { background: string; icon: IoniconName }>> = {
  CRITICAL: { background: Colors.light.severityCritical, icon: 'alert' },
  HIGH: { background: Colors.light.severityHigh, icon: 'warning-outline' },
  MEDIUM: { background: Colors.light.severityMedium, icon: 'contrast-outline' },
  LOW: { background: Colors.light.severityLow, icon: 'ellipse-outline' },
  UNKNOWN: { background: Colors.light.severityUnknown, icon: 'help-circle-outline' },
};

/** Severity selalu ditampilkan dengan ikon + teks, bukan warna saja. */
export function SeverityBadge({ level }: SeverityBadgeProps) {
  const config = CONFIG[level];
  const label = SEVERITY_LABELS[level];

  return (
    <View
      accessibilityLabel={`Severity ${label}`}
      accessibilityRole="text"
      style={[styles.badge, { backgroundColor: config.background }]}>
      <Ionicons color={Colors.light.textOnDark} name={config.icon} size={13} />
      <Text style={styles.text}>{label}</Text>
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
    color: Colors.light.textOnDark,
  },
});
