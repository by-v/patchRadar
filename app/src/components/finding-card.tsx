import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { LabelBadge } from '@/components/label-badge';
import { MetaChip } from '@/components/meta-chip';
import { SeverityBadge } from '@/components/severity-badge';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { PRIORITY_LABELS, SEVERITY_LABELS } from '@/lib/labels';
import { formatEpss } from '@/lib/scan-summary';
import type { ScanFinding } from '@/types/scan';

type FindingCardProps = {
  finding: ScanFinding;
  onPress: () => void;
};

/** Kartu temuan pada layar Hasil (FR-17). */
export function FindingCard({ finding, onPress }: FindingCardProps) {
  const label = PRIORITY_LABELS[finding.priority.label];
  const severity = SEVERITY_LABELS[finding.severity.level];
  const packageText = `${finding.package.name}@${finding.package.installedVersion}`;

  return (
    <Pressable
      accessibilityHint="Membuka detail temuan"
      accessibilityLabel={`${packageText}. ${label}. Tingkat keparahan ${severity}. ${finding.priority.reason}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <GlassSurface style={styles.card}>
        <View style={styles.badges}>
          <SeverityBadge level={finding.severity.level} />
          <LabelBadge label={finding.priority.label} />
        </View>

        <View style={styles.packageRow}>
          <Text numberOfLines={2} style={styles.packageName}>
            {finding.package.name}
            <Text style={styles.version}>@{finding.package.installedVersion}</Text>
          </Text>
          <Ionicons color={Colors.light.textSecondary} name="chevron-forward" size={18} />
        </View>

        <View style={styles.chips}>
          <MetaChip
            icon="shield-checkmark-outline"
            label={finding.exploitation.kev ? 'CISA KEV' : 'Tidak di KEV'}
            tone={finding.exploitation.kev ? 'danger' : 'neutral'}
          />
          <MetaChip
            icon="pulse-outline"
            label={formatEpss(finding.exploitation.epss, finding.exploitation.epssAvailable)}
            tone={finding.exploitation.epssAvailable ? 'neutral' : 'warning'}
          />
          <MetaChip
            label={finding.package.direct ? 'Langsung' : 'Transitif'}
            tone="neutral"
          />
          {finding.package.devOnly ? (
            <MetaChip label="Pengembangan" tone="neutral" />
          ) : null}
        </View>

        <Text numberOfLines={3} style={styles.reason}>
          {finding.priority.reason}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: Radius.card,
  },
  pressed: {
    opacity: 0.75,
  },
  card: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  packageName: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: Colors.light.text,
  },
  version: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.light.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  reason: {
    ...Typography.body,
    color: Colors.light.textSecondary,
  },
});
