/**
 * Klien EPSS FIRST (PRD FR-10).
 *
 * Mengikuti hasil probe `T-W1-05` dan pengamatan ulang 12 November 2026:
 * - Maksimum 100 CVE per request dan parameter `cve` SELALU dikirim.
 * - Beberapa CVE HARUS dipisah koma dalam SATU parameter `cve`
 *   (`?cve=A,B,C`). Mengulang parameter `cve` hanya mengembalikan CVE
 *   terakhir, sehingga skor CVE lain hilang tanpa error.
 * - `limit` eksplisit agar data tidak terpotong di default 100.
 * - `total=0`/`data=[]` untuk permintaan tidak kosong dianggap KEGAGALAN
 *   (warning + parsial), bukan "semua CVE tidak punya skor".
 * - CVE tanpa skor di dalam respons yang berisi data lain tetap `null`.
 *
 * 429/5xx EPSS belum pernah teramati nyata; retry di bawah ini adalah asumsi
 * **[PERLU DIVERIFIKASI]** dan tidak boleh diklaim sebagai perilaku terukur.
 *
 * Tidak memakai API Node; `fetch` disuntikkan agar unit test tanpa jaringan.
 */

import type { FetchLike } from './github.ts';
import { createStageTimings, timed, type StageTimings } from './lib/timing.ts';

export const EPSS_BASE_URL = 'https://api.first.org/data/v1/epss';
export const EPSS_MAX_CVES_PER_REQUEST = 100;
export const EPSS_LIMIT = 1_000;
export const EPSS_MAX_RETRIES = 2;
export const EPSS_TIMEOUT_MS = 8_000;

export interface EpssScore {
  cveId: string;
  epss: number | null;
  percentile: number | null;
  available: boolean;
}

export interface EpssWarning {
  code: 'EPSS_UNAVAILABLE';
  message: string;
}

export interface EpssResult {
  scores: Map<string, EpssScore>;
  warnings: EpssWarning[];
  partial: boolean;
  sourceStatus: 'OK' | 'PARTIAL' | 'FAILED';
  requests: number;
  timings: StageTimings;
}

export interface EpssOptions {
  fetchImpl?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxRetries?: number;
  timings?: StageTimings;
}

interface EpssDataRow {
  cve?: unknown;
  epss?: unknown;
  percentile?: unknown;
}

interface EpssResponseBody {
  total?: unknown;
  data?: unknown;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class EpssRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'EpssRequestError';
    this.retryable = retryable;
  }
}

interface RequestContext {
  fetchImpl: FetchLike;
  timeoutMs: number;
  sleep: (ms: number) => Promise<void>;
  maxRetries: number;
}

async function fetchWithTimeout(
  fetchImpl: FetchLike,
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { method: 'GET', signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchChunk(url: string, context: RequestContext): Promise<EpssResponseBody> {
  let lastError: EpssRequestError | null = null;

  for (let attempt = 0; attempt <= context.maxRetries; attempt += 1) {
    if (attempt > 0) await context.sleep(250 * 2 ** (attempt - 1));

    let response: Response;
    try {
      response = await fetchWithTimeout(context.fetchImpl, url, context.timeoutMs);
    } catch (error) {
      lastError = new EpssRequestError(
        error instanceof Error ? error.message : 'Kesalahan jaringan EPSS.',
        true,
      );
      continue;
    }

    // [PERLU DIVERIFIKASI] 429/5xx EPSS belum diamati nyata; retry ini asumsi.
    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel().catch(() => undefined);
      lastError = new EpssRequestError(`EPSS membalas ${response.status}.`, true);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new EpssRequestError(`EPSS membalas ${response.status}.`, false);
    }

    let parsed: EpssResponseBody;
    try {
      parsed = (await response.json()) as EpssResponseBody;
    } catch {
      throw new EpssRequestError('Respons EPSS bukan JSON valid.', false);
    }

    const data = Array.isArray(parsed.data) ? parsed.data : [];
    const total = parseNumber(parsed.total);
    if (data.length === 0 && total === 0) {
      // Permintaan selalu tidak kosong karena chunk hanya dibuat dari CVE.
      throw new EpssRequestError('EPSS mengembalikan total=0 untuk permintaan tidak kosong.', false);
    }

    return parsed;
  }

  throw lastError ?? new EpssRequestError('EPSS tidak dapat dihubungi.', true);
}

function buildUrl(cveIds: readonly string[]): string {
  const url = new URL(EPSS_BASE_URL);
  // Satu parameter `cve` berisi daftar dipisah koma (lihat komentar modul).
  url.searchParams.set('cve', cveIds.join(','));
  url.searchParams.set('limit', String(EPSS_LIMIT));
  return url.toString();
}

/**
 * Ambil skor EPSS untuk semua CVE unik. Kegagalan tidak pernah melempar;
 * hasilnya `partial=true` + warning `EPSS_UNAVAILABLE` agar scan tetap 200.
 */
export async function fetchEpssScores(
  cveIds: readonly string[],
  options: EpssOptions = {},
): Promise<EpssResult> {
  const timings = options.timings ?? createStageTimings();
  const warnings: EpssWarning[] = [];
  const scores = new Map<string, EpssScore>();

  const unique = [...new Set(cveIds.map((id) => id.trim().toUpperCase()).filter(Boolean))].sort();
  for (const cveId of unique) {
    scores.set(cveId, { cveId, epss: null, percentile: null, available: false });
  }

  if (unique.length === 0) {
    return { scores, warnings, partial: false, sourceStatus: 'OK', requests: 0, timings };
  }

  const context: RequestContext = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? EPSS_TIMEOUT_MS,
    sleep: options.sleep ?? defaultSleep,
    maxRetries: options.maxRetries ?? EPSS_MAX_RETRIES,
  };
  const chunks = chunk(unique, EPSS_MAX_CVES_PER_REQUEST);
  let requests = 0;
  let failures = 0;

  await timed(timings, 'epss.fetch', async () => {
    for (const batch of chunks) {
      requests += 1;
      try {
        const body = await fetchChunk(buildUrl(batch), context);
        const rows = Array.isArray(body.data) ? (body.data as EpssDataRow[]) : [];
        for (const row of rows) {
          const cveId = typeof row.cve === 'string' ? row.cve.trim().toUpperCase() : '';
          if (!cveId || !scores.has(cveId)) continue;
          const epss = parseNumber(row.epss);
          const percentile = parseNumber(row.percentile);
          scores.set(cveId, {
            cveId,
            epss,
            percentile,
            available: epss !== null,
          });
        }
      } catch {
        failures += 1;
      }
    }
  });

  if (failures === chunks.length) {
    warnings.push({
      code: 'EPSS_UNAVAILABLE',
      message: 'Data EPSS tidak tersedia; prioritas sementara memakai severity dan KEV.',
    });
  } else if (failures > 0) {
    warnings.push({
      code: 'EPSS_UNAVAILABLE',
      message: 'Sebagian data EPSS tidak tersedia; prioritas memakai severity, KEV, dan data yang ada.',
    });
  }

  const partial = failures > 0;
  return {
    scores,
    warnings,
    partial,
    sourceStatus: partial ? (failures === chunks.length ? 'FAILED' : 'PARTIAL') : 'OK',
    requests,
    timings,
  };
}

export interface FindingEpss {
  epss: number | null;
  epssPercentile: number | null;
  epssAvailable: boolean;
}

/** Ambil EPSS tertinggi dari seluruh CVE sebuah temuan (FR-10). */
export function epssForCves(
  cveIds: readonly string[],
  scores: ReadonlyMap<string, EpssScore>,
): FindingEpss {
  let best: EpssScore | null = null;

  for (const cveId of cveIds) {
    const normalized = typeof cveId === 'string' ? cveId.trim().toUpperCase() : '';
    const score = scores.get(normalized);
    if (!score || !score.available) continue;
    if (best === null || (score.epss ?? 0) > (best.epss ?? 0)) best = score;
  }

  if (!best) return { epss: null, epssPercentile: null, epssAvailable: false };
  return {
    epss: best.epss,
    epssPercentile: best.percentile,
    epssAvailable: true,
  };
}
