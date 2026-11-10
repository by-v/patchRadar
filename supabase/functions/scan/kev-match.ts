/**
 * Pencocokan findings dengan katalog KEV lewat semua alias CVE (PRD FR-09).
 *
 * Hanya CVE yang dipertimbangkan; temuan tanpa CVE tidak pernah `kev=true`.
 * Pencocokan tidak peka huruf besar/kecil.
 */

import { createStageTimings, timed, type StageTimings } from './lib/timing.ts';

export interface KevCveEntry {
  cveId: string;
}

export interface CveMatchable {
  cveIds: readonly string[];
}

export function buildKevCveSet(entries: readonly KevCveEntry[]): Set<string> {
  const set = new Set<string>();
  for (const entry of entries) {
    if (typeof entry?.cveId !== 'string') continue;
    const normalized = entry.cveId.trim().toUpperCase();
    if (normalized) set.add(normalized);
  }
  return set;
}

/** Fungsi murni: tandai `kev=true` bila salah satu CVE finding ada di katalog. */
export function matchKevFindings<T extends CveMatchable>(
  findings: readonly T[],
  entries: readonly KevCveEntry[],
): Array<T & { kev: boolean }> {
  const cveSet = buildKevCveSet(entries);

  return findings.map((finding) => {
    const matched =
      Array.isArray(finding.cveIds) &&
      finding.cveIds.some((cveId) => {
        if (typeof cveId !== 'string') return false;
        const normalized = cveId.trim().toUpperCase();
        return normalized.length > 0 && cveSet.has(normalized);
      });
    return { ...finding, kev: matched };
  });
}

/** Versi ber-timing; tahap pencocokan alias dicatat sebagai sinkron. */
export async function matchKevWithTiming<T extends CveMatchable>(
  findings: readonly T[],
  entries: readonly KevCveEntry[],
  timings: StageTimings = createStageTimings(),
): Promise<{ findings: Array<T & { kev: boolean }>; timings: StageTimings }> {
  const matched = await timed(timings, 'kev.match', () => matchKevFindings(findings, entries));
  return { findings: matched, timings };
}
