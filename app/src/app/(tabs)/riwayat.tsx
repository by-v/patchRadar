import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { GlassSurface } from '@/components/glass-surface';
import { LabelBadge } from '@/components/label-badge';
import { MetaChip } from '@/components/meta-chip';
import { Screen } from '@/components/screen';
import { ScreenHeader } from '@/components/screen-header';
import { Spacing, Typography } from '@/constants/theme';
import { loadScansForHistory, openDatabaseSafely } from '@/db/access';
import { useTheme, type Theme } from '@/hooks/use-theme';
import { PRIORITY_LABELS } from '@/lib/labels';
import { listRememberedScans } from '@/lib/scan-session';
import { highestPriorityLabel } from '@/lib/scan-summary';
import { formatLocalDateTime } from '@/lib/time';
import type { ScanResult } from '@/types/scan';

function findingsText(count: number): string {
  return `${count} temuan`;
}

export default function HistoryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [scans, setScans] = useState<ScanResult[]>(listRememberedScans);

  // SQLite adalah sumber utama; hasil sesi dipakai sementara/ketika database
  // tidak tersedia. Daftar disegarkan setiap kali tab Riwayat dibuka kembali.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setScans(listRememberedScans());

      void (async () => {
        const db = await openDatabaseSafely();
        const stored = await loadScansForHistory(db);
        if (active) setScans(stored);
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <Screen>
      <ScreenHeader subtitle="Hasil pemindaian tersimpan di perangkat ini." title="Riwayat" />

      {scans.length === 0 ? (
        <EmptyState
          actionLabel="Mulai pindai"
          icon="time-outline"
          message="Hasil pemindaian akan muncul di sini setelah kamu memindai sebuah repositori. Riwayat tersimpan di perangkat dan tetap bisa dibuka tanpa koneksi."
          onAction={() => router.navigate('/')}
          title="Belum ada pemindaian"
        />
      ) : (
        <View style={styles.list}>
          <Text style={styles.note}>
            Tersimpan di perangkat ini dan dapat dibuka tanpa koneksi internet.
          </Text>
          {scans.map((scan) => (
            <HistoryCard
              key={scan.scanId}
              onPress={() =>
                router.push({
                  pathname: '/scan/[scanId]',
                  params: { scanId: scan.scanId },
                })
              }
              scan={scan}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function HistoryCard({ scan, onPress }: { scan: ScanResult; onPress: () => void }) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const highest = highestPriorityLabel(scan.findings);
  const time = formatLocalDateTime(scan.scannedAt);
  const findings = findingsText(scan.summary.findingCount);
  const labelText = highest
    ? `Label tertinggi ${PRIORITY_LABELS[highest]}`
    : 'Tidak ada temuan pada data yang diperiksa';

  return (
    <Pressable
      accessibilityHint="Membuka hasil pemindaian"
      accessibilityLabel={`${scan.repo.owner}/${scan.repo.name}. ${time}. ${findings}. ${labelText}.`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <GlassSurface style={styles.card}>
        <View style={styles.cardTop}>
          <Text numberOfLines={2} style={styles.repo}>
            {scan.repo.owner}/{scan.repo.name}
          </Text>
          <Ionicons
            color={theme.textSecondary}
            name="chevron-forward"
            size={18}
            style={styles.chevron}
          />
        </View>
        <Text style={styles.meta}>{time}</Text>
        <View style={styles.chips}>
          <MetaChip icon="bug-outline" label={findings} />
          {highest ? <LabelBadge label={highest} /> : null}
        </View>
      </GlassSurface>
    </Pressable>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    list: {
      gap: Spacing.gap,
    },
    note: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    card: {
      padding: Spacing.three,
      gap: Spacing.two,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.two,
    },
    repo: {
      ...Typography.sectionTitle,
      flex: 1,
      color: theme.text,
    },
    chevron: {
      marginTop: Spacing.half,
    },
    meta: {
      ...Typography.meta,
      color: theme.textSecondary,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: Spacing.one,
    },
    pressed: {
      opacity: 0.7,
    },
  });
}
