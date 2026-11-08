/**
 * Aturan label prioritas PRD §11.2, diterapkan berurutan:
 * FIX_NOW → SCHEDULE → MONITOR.
 */

import {
  EPSS_FIX_NOW_THRESHOLD,
  EPSS_SCHEDULE_THRESHOLD,
  SCHEDULE_SEVERITIES,
} from './priority-config.ts';
import type { Severity } from './severity.ts';

export type PriorityLabel = 'FIX_NOW' | 'SCHEDULE' | 'MONITOR';

export interface FindingSignals {
  severity: Severity;
  /** Nilai EPSS 0–1, atau null bila tidak tersedia. */
  epss: number | null;
  /** false berarti EPSS tidak tersedia; nilai EPSS lalu diperlakukan 0. */
  epssAvailable?: boolean;
  kev: boolean;
}

/**
 * EPSS efektif untuk label/skor. Tidak tersedia atau tidak valid → 0, dan
 * nilai di luar 0–1 dijepit agar tidak menghasilkan skor mustahil.
 */
export function effectiveEpss(signals: Pick<FindingSignals, 'epss' | 'epssAvailable'>): number {
  if (signals.epssAvailable === false) return 0;
  const value = signals.epss;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, value);
}

/** Label prioritas final; skor tidak pernah ikut menentukan label. */
export function assignLabel(signals: FindingSignals): PriorityLabel {
  const epss = effectiveEpss(signals);

  if (signals.kev === true) return 'FIX_NOW';
  if (signals.severity === 'CRITICAL' && epss >= EPSS_FIX_NOW_THRESHOLD) return 'FIX_NOW';

  if (SCHEDULE_SEVERITIES.includes(signals.severity)) return 'SCHEDULE';
  if (epss >= EPSS_SCHEDULE_THRESHOLD) return 'SCHEDULE';

  return 'MONITOR';
}

/** Teks label berbahasa Indonesia untuk UI. */
export const PRIORITY_LABEL_TEXT: Readonly<Record<PriorityLabel, string>> = {
  FIX_NOW: 'Tambal sekarang',
  SCHEDULE: 'Jadwalkan',
  MONITOR: 'Pantau',
};
