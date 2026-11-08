/**
 * Skor 0–100 sebagai alat urut, bukan penentu label (PRD §11.3).
 */

import { effectiveEpss } from './label.ts';
import type { FindingSignals } from './label.ts';
import {
  EPSS_SCORE_FACTOR,
  EPSS_SCORE_MAX,
  EPSS_SCORE_MULTIPLIER,
  SCORE_MAX,
  SEVERITY_SCORE,
} from './priority-config.ts';

function roundOneDecimal(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** Hitung skor: poin severity + poin EPSS, dibatasi 0–100. */
export function computeScore(signals: Pick<FindingSignals, 'severity' | 'epss' | 'epssAvailable'>): number {
  const severityPoints = SEVERITY_SCORE[signals.severity] ?? SEVERITY_SCORE.UNKNOWN;
  const epssPoints = Math.min(
    EPSS_SCORE_MAX,
    effectiveEpss(signals) * EPSS_SCORE_MULTIPLIER * EPSS_SCORE_FACTOR,
  );
  return Math.min(SCORE_MAX, roundOneDecimal(severityPoints + epssPoints));
}
