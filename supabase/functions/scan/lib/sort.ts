/**
 * Pengurutan hasil (PRD §11.4):
 * label → KEV → skor turun → EPSS turun → nama paket A–Z.
 */

import { effectiveEpss } from './label.ts';
import type { FindingSignals, PriorityLabel } from './label.ts';
import { LABEL_RANK } from './priority-config.ts';

export interface SortableFinding extends FindingSignals {
  packageName: string;
  packageVersion?: string;
  osvId?: string;
  label: PriorityLabel;
  score: number;
}

function compareText(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Komparator deterministik; tie-break terakhir memakai nama/versi/OSV id. */
export function compareFindings(a: SortableFinding, b: SortableFinding): number {
  const labelDiff = LABEL_RANK[a.label] - LABEL_RANK[b.label];
  if (labelDiff !== 0) return labelDiff;

  const kevDiff = Number(b.kev === true) - Number(a.kev === true);
  if (kevDiff !== 0) return kevDiff;

  if (a.score !== b.score) return b.score - a.score;

  const epssDiff = effectiveEpss(b) - effectiveEpss(a);
  if (epssDiff !== 0) return epssDiff;

  const nameDiff = compareText(a.packageName, b.packageName);
  if (nameDiff !== 0) return nameDiff;

  const versionDiff = compareText(a.packageVersion ?? '', b.packageVersion ?? '');
  if (versionDiff !== 0) return versionDiff;

  return compareText(a.osvId ?? '', b.osvId ?? '');
}

/** Urutkan salinan daftar tanpa mengubah masukan. */
export function sortFindings<T extends SortableFinding>(findings: readonly T[]): T[] {
  return [...findings].sort(compareFindings);
}
