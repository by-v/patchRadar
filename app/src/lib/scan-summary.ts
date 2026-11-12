import type { PriorityLabel, ScanFinding } from '@/types/scan';
import { PRIORITY_ORDER } from '@/lib/labels';

export type LabelCounts = Record<PriorityLabel, number>;

/** Hitung temuan per label; dasar chip ringkasan di layar Hasil. */
export function countFindingsByLabel(
  findings: readonly Pick<ScanFinding, 'priority'>[],
): LabelCounts {
  const counts: LabelCounts = { FIX_NOW: 0, SCHEDULE: 0, MONITOR: 0 };
  for (const finding of findings) {
    counts[finding.priority.label] += 1;
  }
  return counts;
}

/** Chip label yang perlu ditampilkan, hanya yang jumlahnya > 0. */
export function nonEmptyLabelCounts(
  counts: LabelCounts,
): { label: PriorityLabel; count: number }[] {
  return PRIORITY_ORDER.filter((label) => counts[label] > 0).map((label) => ({
    label,
    count: counts[label],
  }));
}

/** Persentase EPSS dengan satu desimal dan koma Indonesia. */
export function formatEpss(epss: number | null, available: boolean): string {
  if (!available || epss === null) return 'EPSS tidak tersedia';
  const percent = (epss * 100).toFixed(1).replace('.', ',');
  return `EPSS ${percent}%`;
}
