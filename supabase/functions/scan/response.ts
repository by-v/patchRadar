/**
 * Penyusun respons final endpoint `scan` (PRD §9/§11).
 *
 * Skor hanya dipakai sebagai alat urut; respons tidak pernah menyebut
 * "x dari 100". `persisted` selalu ada dan bernilai `false` sampai penyimpanan
 * cloud dibangun pada Minggu 3.
 *
 * Fungsi ini murni kecuali pembuatan `findingId` (disuntikkan agar unit test
 * deterministik). Tidak memakai API Node; aman untuk Deno.
 */

import type { ParseSuccess } from './lib/lockfile.ts';
import type { ParseWarning, ParsedPackage } from './lib/dedupe.ts';
import { assignLabel } from './lib/label.ts';
import { buildReason } from './lib/reason.ts';
import { computeScore } from './lib/score.ts';
import { compareVersions } from './lib/semver.ts';
import { normalizeSeverity, type Severity } from './lib/severity.ts';
import { sortFindings, type SortableFinding } from './lib/sort.ts';
import type { StageTimings } from './lib/timing.ts';
import type { BaseFinding } from './findings.ts';
import type { EpssResult, EpssScore } from './epss.ts';
import type { KevCatalogResult } from './kev.ts';
import type { OsvAdvisoryDetail, OsvEnrichmentResult } from './osv.ts';

export type ScanLifecycleStatus = 'COMPLETED' | 'PARTIAL';
export type SourceState = 'OK' | 'CACHE' | 'PARTIAL' | 'STALE' | 'EMPTY' | 'FAILED';

export interface ScanWarning {
  code: string;
  message: string;
}

export interface ScanRepository {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
}

export interface ScanManifestSummary {
  source: 'LOCKFILE' | 'PACKAGE_JSON';
  lockfileFormat: 'v2' | 'v3' | null;
  estimated: boolean;
}

export interface ScanResponseFinding {
  findingId: string;
  osvId: string;
  cveIds: string[];
  package: {
    name: string;
    installedVersion: string;
    direct: boolean;
    devOnly: boolean;
    parentPackage: string | null;
  };
  severity: {
    level: Severity;
    cvss: number | null;
    source: 'OSV';
  };
  exploitation: {
    kev: boolean;
    epss: number | null;
    epssPercentile: number | null;
    epssAvailable: boolean;
  };
  priority: {
    label: 'FIX_NOW' | 'SCHEDULE' | 'MONITOR';
    score: number;
    reason: string;
  };
  fix: {
    safeVersion: string | null;
    command: string | null;
    suggestion: string | null;
  };
  summary: string;
  references: Array<{ label: string; url: string }>;
}

export interface ScanSuccessResponse {
  scanId: string;
  repo: ScanRepository;
  scannedAt: string;
  status: ScanLifecycleStatus;
  manifest: ScanManifestSummary;
  summary: {
    totalPackages: number;
    affectedPackages: number;
    findingCount: number;
  };
  findings: ScanResponseFinding[];
  partial: boolean;
  persisted: boolean;
  warnings: ScanWarning[];
  sourceStatus: {
    github: SourceState;
    osv: SourceState;
    kev: SourceState;
    epss: SourceState;
  };
  timings: {
    githubMs: number;
    osvMs: number;
    enrichmentMs: number;
    totalMs: number;
  };
  requestId: string;
}

export interface BuildScanResponseInput {
  scanId: string;
  requestId: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  scannedAt: string;
  parsed: ParseSuccess;
  githubMs: number;
  totalMs: number;
  osv: OsvEnrichmentResult;
  kev: KevCatalogResult;
  epss: EpssResult;
  findings: Array<BaseFinding & { kev: boolean }>;
  timings: StageTimings;
  newFindingId?: () => string;
}

const TRANSITIVE_SUGGESTION =
  'Perbarui paket induk yang menarik dependensi ini, atau jalankan npm audit fix di proyek Anda.';
const NO_SAFE_VERSION_SUGGESTION =
  'Belum ada versi aman yang diketahui; periksa referensi advisory sebelum memperbarui.';
const MISSING_SUMMARY = 'Ringkasan dampak belum tersedia dari advisory.';

function lockfileFormat(version: number | null): 'v2' | 'v3' | null {
  if (version === 2) return 'v2';
  if (version === 3) return 'v3';
  return null;
}

function roundMs(value: number): number {
  return Math.round(value);
}

function sumTimings(bucket: Readonly<Record<string, number>>, prefixes: readonly string[]): number {
  let total = 0;
  for (const [name, value] of Object.entries(bucket)) {
    if (prefixes.some((prefix) => name.startsWith(prefix))) total += value;
  }
  return total;
}

/**
 * Kode warning yang menandakan sumber data gagal/tidak lengkap (PRD §9/§12,
 * FR-23). Fallback lockfile, hasil `estimated`, kegagalan cache, dan kegagalan
 * registry hanya bersifat informatif; statusnya dibawa `manifest.estimated`
 * atau `sourceStatus`, bukan `partial`.
 */
const PARTIAL_WARNING_CODES: ReadonlySet<string> = new Set([
  'OSV_PARTIAL',
  'OSV_DETAIL_PARTIAL',
  'KEV_STALE',
  'KEV_UNAVAILABLE',
  'EPSS_UNAVAILABLE',
  'LOCKFILE_PARTIAL',
]);

/**
 * Satukan warning pipeline. Hanya entri lockfile yang dilewati
 * (`LOCKFILE_ENTRY_SKIPPED`) dipetakan ke kode publik `LOCKFILE_PARTIAL`;
 * warning fallback seperti `LOCKFILE_MISSING` tetap informatif dengan kode
 * aslinya.
 */
export function buildWarnings(
  parseWarnings: readonly ParseWarning[],
  sources: readonly ScanWarning[],
): ScanWarning[] {
  const warnings: ScanWarning[] = [];
  const seen = new Set<string>();

  const add = (warning: ScanWarning): void => {
    const key = `${warning.code}\u0000${warning.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    warnings.push(warning);
  };

  const skipped = parseWarnings.filter((warning) => warning.code === 'LOCKFILE_ENTRY_SKIPPED');
  if (skipped.length > 0) {
    add({
      code: 'LOCKFILE_PARTIAL',
      message: skipped.map((warning) => warning.message).join(' '),
    });
  }

  for (const warning of parseWarnings) {
    if (warning.code === 'LOCKFILE_ENTRY_SKIPPED') continue;
    add({ code: warning.code, message: warning.message });
  }

  for (const warning of sources) add(warning);
  return warnings;
}

/** Apakah daftar warning memuat sumber data gagal/tidak lengkap. */
export function isPartialWarning(code: string): boolean {
  return PARTIAL_WARNING_CODES.has(code);
}

function advisoryFor(
  finding: BaseFinding,
  advisories: Readonly<Record<string, OsvAdvisoryDetail>>,
): OsvAdvisoryDetail | null {
  return advisories[finding.osvId] ?? null;
}

interface AffectedRangeEvent {
  fixed?: unknown;
}

interface AffectedEntry {
  package?: { name?: unknown; ecosystem?: unknown } | null;
  ranges?: unknown;
}

function fixedVersionsForPackage(detail: OsvAdvisoryDetail | null, packageName: string): string[] {
  if (!detail || !Array.isArray(detail.affected)) return [];

  const affected = detail.affected as AffectedEntry[];
  const matching = affected.filter((entry) => {
    const name = entry?.package?.name;
    return typeof name !== 'string' || name.length === 0 || name === packageName;
  });

  const fixed: string[] = [];
  for (const entry of matching) {
    if (!Array.isArray(entry?.ranges)) continue;
    for (const range of entry.ranges) {
      if (!range || typeof range !== 'object') continue;
      const events = (range as { events?: unknown }).events;
      if (!Array.isArray(events)) continue;
      for (const event of events as AffectedRangeEvent[]) {
        const value = event?.fixed;
        if (typeof value === 'string' && value.trim().length > 0) fixed.push(value.trim());
      }
    }
  }
  return fixed;
}

/** Versi `fixed` terendah yang lebih tinggi dari versi terpasang (FR-19). */
export function findSafeVersion(
  detail: OsvAdvisoryDetail | null,
  packageName: string,
  installedVersion: string,
): string | null {
  let best: string | null = null;
  for (const candidate of fixedVersionsForPackage(detail, packageName)) {
    try {
      if (compareVersions(candidate, installedVersion) <= 0) continue;
      if (best === null || compareVersions(candidate, best) < 0) best = candidate;
    } catch {
      // Versi non-semver tidak dapat dibandingkan; lewati tanpa mengarang.
    }
  }
  return best;
}

function shortSummary(detail: OsvAdvisoryDetail | null): string {
  if (!detail) return MISSING_SUMMARY;
  if (typeof detail.summary === 'string' && detail.summary.trim()) return detail.summary.trim();
  if (typeof detail.details === 'string' && detail.details.trim()) {
    const text = detail.details.trim().replace(/\s+/g, ' ');
    const firstSentence = text.split(/(?<=\.)\s/)[0] ?? text;
    return firstSentence.length > 280 ? `${firstSentence.slice(0, 277)}...` : firstSentence;
  }
  return MISSING_SUMMARY;
}

const REFERENCE_LABELS: Readonly<Record<string, string>> = {
  ADVISORY: 'Advisory',
  ARTICLE: 'Artikel',
  FIX: 'Perbaikan',
  REPORT: 'Laporan',
  WEB: 'Referensi',
};

function referenceLabel(type: unknown): string {
  if (typeof type !== 'string') return 'Referensi';
  return REFERENCE_LABELS[type.trim().toUpperCase()] ?? 'Referensi';
}

function buildReferences(
  detail: OsvAdvisoryDetail | null,
  osvId: string,
): Array<{ label: string; url: string }> {
  const references: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();

  const add = (label: string, url: string): void => {
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    references.push({ label, url });
  };

  add('Advisory OSV', `https://osv.dev/vulnerability/${encodeURIComponent(osvId)}`);

  if (detail && Array.isArray(detail.references)) {
    for (const reference of detail.references) {
      const url = reference?.url;
      if (typeof url !== 'string') continue;
      add(referenceLabel(reference?.type), url.trim());
    }
  }

  return references;
}

function epssForFinding(
  cveIds: readonly string[],
  scores: ReadonlyMap<string, EpssScore>,
): { epss: number | null; percentile: number | null; available: boolean } {
  let best: EpssScore | null = null;
  for (const cveId of cveIds) {
    const score = scores.get(cveId.trim().toUpperCase());
    if (!score || !score.available) continue;
    if (best === null || (score.epss ?? 0) > (best.epss ?? 0)) best = score;
  }
  if (!best) return { epss: null, percentile: null, available: false };
  return {
    epss: best.epss,
    percentile: best.percentile,
    available: best.epss !== null,
  };
}

type InternalFinding = SortableFinding & {
  base: BaseFinding;
  publicFinding: ScanResponseFinding;
};

function buildInternalFindings(
  input: BuildScanResponseInput,
  newFindingId: () => string,
): InternalFinding[] {
  const internal: InternalFinding[] = [];
  const seenIds = new Set<string>();

  for (const finding of input.findings) {
    const detail = advisoryFor(finding, input.osv.advisories);
    const normalized = normalizeSeverity(detail ?? { id: finding.osvId, aliases: [] });
    const epss = epssForFinding(finding.cveIds, input.epss.scores);
    const signals = {
      severity: normalized.level,
      epss: epss.epss,
      epssAvailable: epss.available,
      kev: finding.kev,
    };
    const label = assignLabel(signals);
    const score = computeScore(signals);
    const safeVersion = findSafeVersion(detail, finding.packageName, finding.installedVersion);
    const command =
      finding.direct && safeVersion !== null ? `npm install ${finding.packageName}@${safeVersion}` : null;
    const suggestion = finding.direct
      ? safeVersion === null
        ? NO_SAFE_VERSION_SUGGESTION
        : null
      : TRANSITIVE_SUGGESTION;

    let findingId = newFindingId();
    while (seenIds.has(findingId)) findingId = newFindingId();
    seenIds.add(findingId);

    const publicFinding: ScanResponseFinding = {
      findingId,
      osvId: finding.osvId,
      cveIds: [...finding.cveIds],
      package: {
        name: finding.packageName,
        installedVersion: finding.installedVersion,
        direct: finding.direct,
        devOnly: finding.devOnly,
        parentPackage: finding.parentPackage,
      },
      severity: {
        level: normalized.level,
        cvss: normalized.cvssV3Score,
        source: 'OSV',
      },
      exploitation: {
        kev: finding.kev,
        epss: epss.epss,
        epssPercentile: epss.percentile,
        epssAvailable: epss.available,
      },
      priority: {
        label,
        score,
        reason: buildReason(signals),
      },
      fix: {
        safeVersion,
        command,
        suggestion,
      },
      summary: shortSummary(detail),
      references: buildReferences(detail, finding.osvId),
    };

    internal.push({
      packageName: finding.packageName,
      packageVersion: finding.installedVersion,
      osvId: finding.osvId,
      label,
      score,
      severity: signals.severity,
      epss: signals.epss,
      epssAvailable: signals.epssAvailable,
      kev: signals.kev,
      base: finding,
      publicFinding,
    });
  }

  return internal;
}

/** Susun respons final dari seluruh hasil pipeline. */
export function buildScanResponse(input: BuildScanResponseInput): ScanSuccessResponse {
  const generator = input.newFindingId ?? (() => crypto.randomUUID());
  const internal = buildInternalFindings(input, generator);
  const sorted = sortFindings(internal);

  const sourceWarnings: ScanWarning[] = [
    ...input.osv.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
    ...input.kev.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
    ...input.epss.warnings.map((warning) => ({ code: warning.code, message: warning.message })),
  ];
  const warnings = buildWarnings(input.parsed.warnings, sourceWarnings);
  const partial = warnings.some((warning) => isPartialWarning(warning.code));

  const affectedPackages = new Set<string>();
  for (const finding of sorted) affectedPackages.add(finding.packageName);

  const osvMs = Math.round(sumTimings(input.timings.async, ['osv.']));
  const enrichmentMs = Math.round(
    sumTimings(input.timings.async, ['kev.', 'epss.']) +
      sumTimings(input.timings.sync, ['kev.', 'epss.']),
  );

  return {
    scanId: input.scanId,
    repo: {
      owner: input.owner,
      name: input.repo,
      url: `https://github.com/${input.owner}/${input.repo}`,
      defaultBranch: input.defaultBranch,
    },
    scannedAt: input.scannedAt,
    status: partial ? 'PARTIAL' : 'COMPLETED',
    manifest: {
      source: input.parsed.source,
      lockfileFormat: lockfileFormat(input.parsed.lockfileVersion),
      estimated: input.parsed.estimated,
    },
    summary: {
      totalPackages: input.parsed.totalPackages,
      affectedPackages: affectedPackages.size,
      findingCount: sorted.length,
    },
    findings: sorted.map((finding) => finding.publicFinding),
    partial,
    persisted: false,
    warnings,
    sourceStatus: {
      github: 'OK',
      osv: input.osv.sourceStatus,
      kev: input.kev.sourceStatus,
      epss: input.epss.sourceStatus,
    },
    timings: {
      githubMs: roundMs(input.githubMs),
      osvMs,
      enrichmentMs,
      totalMs: roundMs(input.totalMs),
    },
    requestId: input.requestId,
  };
}
