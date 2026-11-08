/**
 * Normalisasi severity OSV dan alias advisory.
 *
 * Urutan sumber severity tegas (PRD FR-11):
 * 1. `severity` terstruktur CVSS v3 dari OSV (skor dasar dihitung dari vektor).
 * 2. `database_specific.severity` (label GitHub `MODERATE` -> `MEDIUM`). Ini
 *    juga jalur fallback saat advisory hanya menyediakan CVSS_V4.
 * 3. `UNKNOWN` bila tidak ada sumber yang dapat dipakai; tidak ditebak.
 *
 * Alias dinormalisasi ke huruf besar dan dideduplikasi agar pencocokan KEV/EPSS
 * memakai satu bentuk baku. Fungsi murni, tanpa API Node, aman untuk Deno.
 */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type SeveritySource =
  | 'CVSS_V3'
  | 'CVSS_V4_DATABASE_SPECIFIC'
  | 'DATABASE_SPECIFIC'
  | 'UNKNOWN';

export interface OsvSeverityEntry {
  type?: string | null;
  score?: string | null;
}

export interface OsvAdvisorySeverityInput {
  id?: string | null;
  aliases?: readonly string[] | null;
  severity?: readonly OsvSeverityEntry[] | null;
  database_specific?: { severity?: unknown } | null;
}

export interface NormalizedSeverity {
  level: Severity;
  source: SeveritySource;
  cvssV3Score: number | null;
  cvssV3Vector: string | null;
  databaseSpecificSeverity: string | null;
}

export interface NormalizedAliases {
  ghsaIds: string[];
  cveIds: string[];
  allIds: string[];
}

const SEVERITY_LEVELS: ReadonlySet<Severity> = new Set([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
]);

const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/i;
const GHSA_PATTERN = /^GHSA(?:-[0-9A-Z]{4}){3}$/i;

const AV: Readonly<Record<string, number>> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC: Readonly<Record<string, number>> = { L: 0.77, H: 0.44 };
const UI: Readonly<Record<string, number>> = { N: 0.85, R: 0.62 };
const CIA: Readonly<Record<string, number>> = { H: 0.56, L: 0.22, N: 0 };
const PR_UNCHANGED: Readonly<Record<string, number>> = { N: 0.85, L: 0.62, H: 0.27 };
const PR_CHANGED: Readonly<Record<string, number>> = { N: 0.85, L: 0.68, H: 0.5 };

function roundUp(value: number): number {
  const scaled = Math.round(value * 100000);
  if (scaled % 10000 === 0) return scaled / 100000;
  return (Math.floor(scaled / 10000) + 1) / 10;
}

function parseVector(vector: string): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const piece of vector.split('/')) {
    const [key, value] = piece.split(':');
    if (key && value) parts[key] = value;
  }
  return parts;
}

/**
 * Hitung skor dasar CVSS v3.x dari vektor. Mengembalikan null bila vektor
 * tidak lengkap atau tidak valid.
 */
export function cvssV3BaseScore(vector: string): number | null {
  if (typeof vector !== 'string' || !vector.trim()) return null;

  const p = parseVector(vector.trim());
  if (!p.AV || !p.AC || !p.PR || !p.UI || !p.S || !p.C || !p.I || !p.A) return null;

  const av = AV[p.AV];
  const ac = AC[p.AC];
  const ui = UI[p.UI];
  const c = CIA[p.C];
  const i = CIA[p.I];
  const a = CIA[p.A];
  if (av === undefined || ac === undefined || ui === undefined) return null;
  if (c === undefined || i === undefined || a === undefined) return null;

  const changed = p.S === 'C';
  const pr = changed ? PR_CHANGED[p.PR] : PR_UNCHANGED[p.PR];
  if (pr === undefined) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = changed
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  if (impact <= 0) return 0;

  const exploitability = 8.22 * av * ac * pr * ui;
  const raw = changed
    ? Math.min(1.08 * (impact + exploitability), 10)
    : Math.min(impact + exploitability, 10);

  return roundUp(raw);
}

/** Petakan skor CVSS 0–10 ke level PRD. */
export function severityFromScore(score: number | null | undefined): Severity {
  if (typeof score !== 'number' || !Number.isFinite(score)) return 'UNKNOWN';
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  if (score >= 0.1) return 'LOW';
  return 'UNKNOWN';
}

/** Normalisasi label severity teks; `MODERATE` dipetakan ke `MEDIUM`. */
export function normalizeSeverityLabel(value: unknown): Severity | null {
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'MODERATE') return 'MEDIUM';
  if (SEVERITY_LEVELS.has(upper as Severity)) return upper as Severity;
  return null;
}

function scoreFromStructured(entry: OsvSeverityEntry): number | null {
  const score = typeof entry.score === 'string' ? entry.score.trim() : '';
  if (!score) return null;

  if (score.startsWith('CVSS:')) return cvssV3BaseScore(score);

  // Sebagian sumber menaruh skor numerik langsung sebagai string.
  const numeric = Number(score);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Normalisasi severity satu advisory OSV.
 *
 * Hanya CVSS_V4 tanpa CVSS_V3 tidak dihitung sendiri; mengikuti temuan
 * T-W1-03, jalur itu memakai `database_specific.severity` agar label GitHub
 * `MODERATE` tetap menjadi `MEDIUM`.
 */
export function normalizeSeverity(advisory: OsvAdvisorySeverityInput): NormalizedSeverity {
  const structured = Array.isArray(advisory?.severity) ? advisory.severity : [];
  const cvssV3 = structured.find(
    (entry) => typeof entry?.type === 'string' && entry.type.toUpperCase().startsWith('CVSS_V3'),
  );
  const cvssV4Present = structured.some(
    (entry) => typeof entry?.type === 'string' && entry.type.toUpperCase() === 'CVSS_V4',
  );

  const databaseSpecificRaw = advisory?.database_specific?.severity;
  const databaseSpecificSeverity =
    typeof databaseSpecificRaw === 'string' ? databaseSpecificRaw : null;

  if (cvssV3) {
    const score = scoreFromStructured(cvssV3);
    if (score !== null) {
      return {
        level: severityFromScore(score),
        source: 'CVSS_V3',
        cvssV3Score: score,
        cvssV3Vector: typeof cvssV3.score === 'string' ? cvssV3.score : null,
        databaseSpecificSeverity,
      };
    }
  }

  const fromDatabase = normalizeSeverityLabel(databaseSpecificRaw);
  if (fromDatabase) {
    return {
      level: fromDatabase,
      source: cvssV4Present ? 'CVSS_V4_DATABASE_SPECIFIC' : 'DATABASE_SPECIFIC',
      cvssV3Score: null,
      cvssV3Vector: null,
      databaseSpecificSeverity,
    };
  }

  return {
    level: 'UNKNOWN',
    source: 'UNKNOWN',
    cvssV3Score: null,
    cvssV3Vector: null,
    databaseSpecificSeverity,
  };
}

/**
 * Normalisasi alias advisory GSHA/CVE: huruf besar, valid, tanpa duplikat.
 * `id` ikut dimasukkan bila berpola GHSA/CVE.
 */
export function normalizeAdvisoryAliases(advisory: OsvAdvisorySeverityInput): NormalizedAliases {
  const ghsa = new Set<string>();
  const cve = new Set<string>();
  const candidates = [advisory?.id, ...(advisory?.aliases ?? [])];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const id = candidate.trim().toUpperCase();
    if (GHSA_PATTERN.test(id)) ghsa.add(id);
    else if (CVE_PATTERN.test(id)) cve.add(id);
  }

  const ghsaIds = [...ghsa].sort();
  const cveIds = [...cve].sort();
  return { ghsaIds, cveIds, allIds: [...ghsaIds, ...cveIds].sort() };
}

/**
 * Cocokkan advisory dengan ID KEV/EPSS memakai alias yang sudah dinormalisasi.
 * Pencocokan tidak peka huruf besar/kecil.
 */
export function advisoryMatchesId(advisory: OsvAdvisorySeverityInput, candidateId: string): boolean {
  if (typeof candidateId !== 'string') return false;
  const normalized = candidateId.trim().toUpperCase();
  if (!normalized) return false;
  const { allIds } = normalizeAdvisoryAliases(advisory);
  return allIds.includes(normalized);
}
