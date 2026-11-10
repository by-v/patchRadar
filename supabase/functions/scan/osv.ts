/**
 * Klien OSV batch + cache untuk pipeline `scan` (PRD FR-06/FR-07).
 *
 * - Query batch per chunk 50 (batas nyata 1.000/request; chunk 50 menjaga
 *   ukuran respons tetap kecil).
 * - Respons batch hanya berisi `id` + `modified`, jadi detail advisory diambil
 *   terpisah dengan konkurensi terbatas.
 * - Cache per (paket, versi) termasuk hasil negatif, dan cache detail advisory.
 *   TTL sementara 24 jam sesuai PRD.
 * - Retry terbatas (maksimum 2) dengan backoff hanya untuk 429/5xx/jaringan.
 * - Kegagalan total → `ScanError` 502; kegagalan sebagian → warning + parsial.
 *
 * Tidak memakai API Node; `fetch` selalu disuntikkan agar unit test tanpa
 * jaringan.
 */

import { ScanError } from './errors.ts';
import type { FetchLike } from './github.ts';
import { createStageTimings, timed, type StageTimings } from './lib/timing.ts';
import {
  createMemoryOsvCacheStore,
  type OsvCacheRecord,
  type OsvCacheStore,
} from './store.ts';

export const OSV_BATCH_URL = 'https://api.osv.dev/v1/querybatch';
export const OSV_VULN_BASE_URL = 'https://api.osv.dev/v1/vulns/';
export const OSV_CHUNK_SIZE = 50;
export const OSV_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const OSV_DETAIL_CONCURRENCY = 5;
export const OSV_MAX_RETRIES = 2;
export const OSV_TIMEOUT_MS = 8_000;

export interface OsvPackageInput {
  name: string;
  version: string;
  direct?: boolean;
  devOnly?: boolean;
  parentPackage?: string | null;
}

export interface OsvBatchVuln {
  id: string;
  modified: string;
}

export interface OsvPackageVulns {
  name: string;
  version: string;
  vulns: OsvBatchVuln[];
}

export interface OsvSeverityEntry {
  type?: string;
  score?: string;
}

export interface OsvAdvisoryDetail {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  severity?: OsvSeverityEntry[];
  database_specific?: { severity?: string };
  affected?: unknown[];
  references?: Array<{ type?: string; url?: string }>;
  modified?: string;
}

export interface OsvWarning {
  code:
    | 'OSV_PARTIAL'
    | 'OSV_DETAIL_PARTIAL'
    | 'OSV_CACHE_WRITE_FAILED'
    | 'OSV_CACHE_READ_FAILED';
  message: string;
}

export interface OsvEnrichmentResult {
  packageResults: OsvPackageVulns[];
  advisories: Record<string, OsvAdvisoryDetail>;
  warnings: OsvWarning[];
  partial: boolean;
  sourceStatus: 'OK' | 'CACHE' | 'PARTIAL';
  cacheHits: number;
  cacheMisses: number;
  detailCacheHits: number;
  batchRequests: number;
  detailRequests: number;
  timings: StageTimings;
}

export interface OsvEnrichmentOptions {
  store?: OsvCacheStore;
  fetchImpl?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  chunkSize?: number;
  detailConcurrency?: number;
  timeoutMs?: number;
  ttlMs?: number;
  maxRetries?: number;
  timings?: StageTimings;
}

export function osvPackageCacheKey(name: string, version: string): string {
  return `npm:${name}@${version}`;
}

export function osvAdvisoryCacheKey(id: string): string {
  return `osv:advisory:${id}`;
}

interface PackageCachePayload {
  vulns: OsvBatchVuln[];
}

function isFresh(fetchedAt: string, nowMs: number, ttlMs: number): boolean {
  const timestamp = Date.parse(fetchedAt);
  return Number.isFinite(timestamp) && nowMs - timestamp <= ttlMs;
}

function asPackagePayload(payload: unknown): PackageCachePayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const vulns = (payload as { vulns?: unknown }).vulns;
  if (!Array.isArray(vulns)) return null;

  const parsed: OsvBatchVuln[] = [];
  for (const entry of vulns) {
    if (!entry || typeof entry !== 'object') return null;
    const id = (entry as { id?: unknown }).id;
    if (typeof id !== 'string' || id.length === 0) return null;
    const modified = (entry as { modified?: unknown }).modified;
    parsed.push({ id, modified: typeof modified === 'string' ? modified : '' });
  }
  return { vulns: parsed };
}

function asAdvisoryDetail(payload: unknown): OsvAdvisoryDetail | null {
  if (!payload || typeof payload !== 'object') return null;
  const id = (payload as { id?: unknown }).id;
  if (typeof id !== 'string' || id.length === 0) return null;
  return payload as OsvAdvisoryDetail;
}

class OsvRequestError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'OsvRequestError';
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
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(
  url: string,
  init: RequestInit,
  context: RequestContext,
): Promise<Response> {
  let lastError: OsvRequestError | null = null;

  for (let attempt = 0; attempt <= context.maxRetries; attempt += 1) {
    if (attempt > 0) {
      await context.sleep(250 * 2 ** (attempt - 1));
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(context.fetchImpl, url, init, context.timeoutMs);
    } catch (error) {
      lastError = new OsvRequestError(
        error instanceof Error ? error.message : 'Kesalahan jaringan OSV.',
        true,
      );
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel().catch(() => undefined);
      lastError = new OsvRequestError(`OSV membalas ${response.status}.`, true);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new OsvRequestError(`OSV membalas ${response.status}.`, false);
    }

    return response;
  }

  throw lastError ?? new OsvRequestError('OSV tidak dapat dihubungi.', true);
}

function batchBody(packages: readonly OsvPackageInput[]): string {
  return JSON.stringify({
    queries: packages.map((entry) => ({
      package: { name: entry.name, ecosystem: 'npm' },
      version: entry.version,
    })),
  });
}

async function queryBatch(
  packages: readonly OsvPackageInput[],
  context: RequestContext,
): Promise<OsvPackageVulns[]> {
  const response = await requestWithRetry(
    OSV_BATCH_URL,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: batchBody(packages),
    },
    context,
  );

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new OsvRequestError('Respons batch OSV bukan JSON valid.', false);
  }

  const results = (parsed as { results?: unknown } | null)?.results;
  if (!Array.isArray(results) || results.length !== packages.length) {
    throw new OsvRequestError('Bentuk respons batch OSV tidak sesuai jumlah query.', false);
  }

  return packages.map((entry, index) => {
    const result = results[index] as { vulns?: unknown } | null;
    const rawVulns = result && Array.isArray(result.vulns) ? result.vulns : [];
    const vulns: OsvBatchVuln[] = [];
    for (const raw of rawVulns) {
      if (!raw || typeof raw !== 'object') continue;
      const id = (raw as { id?: unknown }).id;
      if (typeof id !== 'string' || id.length === 0) continue;
      const modified = (raw as { modified?: unknown }).modified;
      vulns.push({ id, modified: typeof modified === 'string' ? modified : '' });
    }
    return { name: entry.name, version: entry.version, vulns };
  });
}

async function fetchAdvisory(
  id: string,
  context: RequestContext,
): Promise<OsvAdvisoryDetail> {
  const response = await requestWithRetry(
    `${OSV_VULN_BASE_URL}${encodeURIComponent(id)}`,
    { method: 'GET' },
    context,
  );

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new OsvRequestError('Detail advisory OSV bukan JSON valid.', false);
  }

  const detail = asAdvisoryDetail(parsed);
  if (!detail) {
    throw new OsvRequestError('Detail advisory OSV tidak memiliki id.', false);
  }
  return detail;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<Array<{ ok: true; value: R } | { ok: false; error: unknown }>> {
  const results: Array<{ ok: true; value: R } | { ok: false; error: unknown }> = new Array(items.length);
  let next = 0;

  async function runner(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index] as T;
      try {
        results[index] = { ok: true, value: await worker(item) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }

  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, () => runner());
  await Promise.all(workers);
  return results;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ambil advisory OSV untuk daftar paket unik, memakai cache bila masih TTL.
 *
 * Melempar `ScanError('UPSTREAM_UNAVAILABLE')` (502) bila seluruh permintaan
 * OSV gagal, sehingga tidak ada hasil sukses yang menyamar sebagai lengkap.
 */
export async function enrichWithOsv(
  packages: readonly OsvPackageInput[],
  options: OsvEnrichmentOptions = {},
): Promise<OsvEnrichmentResult> {
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? OSV_CACHE_TTL_MS;
  const chunkSize = Math.max(1, options.chunkSize ?? OSV_CHUNK_SIZE);
  const store = options.store ?? createMemoryOsvCacheStore();
  const timings = options.timings ?? createStageTimings();
  const warnings: OsvWarning[] = [];

  const unique = new Map<string, OsvPackageInput>();
  for (const entry of packages) {
    if (!entry || typeof entry.name !== 'string' || typeof entry.version !== 'string') continue;
    unique.set(osvPackageCacheKey(entry.name, entry.version), entry);
  }
  const packageList = [...unique.values()];
  const packageKeys = [...unique.keys()];
  const nowMs = now();

  let cached = new Map<string, OsvCacheRecord>();
  try {
    cached = await timed(timings, 'osv.cache.read', () => store.getMany(packageKeys));
  } catch {
    warnings.push({
      code: 'OSV_CACHE_READ_FAILED',
      message: 'Cache OSV tidak dapat dibaca; seluruh paket akan diquery ulang.',
    });
  }

  const packageResults = new Map<string, OsvPackageVulns>();
  let cacheHits = 0;
  const misses: OsvPackageInput[] = [];

  for (const entry of packageList) {
    const key = osvPackageCacheKey(entry.name, entry.version);
    const record = cached.get(key);
    const payload = record ? asPackagePayload(record.payload) : null;
    if (record && payload && isFresh(record.fetchedAt, nowMs, ttlMs)) {
      cacheHits += 1;
      packageResults.set(key, { name: entry.name, version: entry.version, vulns: payload.vulns });
    } else {
      misses.push(entry);
    }
  }

  const chunks = chunk(misses, chunkSize);
  let batchRequests = 0;
  let batchFailures = 0;
  const cacheWrites: OsvCacheRecord[] = [];
  const fetchedAt = new Date(nowMs).toISOString();
  const requestContext: RequestContext = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? OSV_TIMEOUT_MS,
    sleep: options.sleep ?? defaultSleep,
    maxRetries: options.maxRetries ?? OSV_MAX_RETRIES,
  };

  if (chunks.length > 0) {
    await timed(timings, 'osv.batch', async () => {
      for (const batch of chunks) {
        batchRequests += 1;
        try {
          const results = await queryBatch(batch, requestContext);
          for (const result of results) {
            const key = osvPackageCacheKey(result.name, result.version);
            packageResults.set(key, result);
            cacheWrites.push({ cacheKey: key, payload: { vulns: result.vulns }, fetchedAt });
          }
        } catch {
          batchFailures += 1;
        }
      }
    });

    if (batchFailures === chunks.length) {
      if (packageResults.size === 0) {
        throw new ScanError('UPSTREAM_UNAVAILABLE', {
          message: 'Layanan OSV tidak dapat dihubungi. Coba lagi sebentar lagi.',
        });
      }
      warnings.push({
        code: 'OSV_PARTIAL',
        message: `Seluruh ${chunks.length} chunk OSV gagal; hasil memakai cache yang tersedia.`,
      });
    } else if (batchFailures > 0) {
      warnings.push({
        code: 'OSV_PARTIAL',
        message: `${batchFailures} dari ${chunks.length} chunk OSV gagal; sebagian paket belum diperiksa.`,
      });
    }
  }

  if (cacheWrites.length > 0) {
    try {
      await timed(timings, 'osv.cache.write', () => store.upsert(cacheWrites));
    } catch {
      warnings.push({
        code: 'OSV_CACHE_WRITE_FAILED',
        message: 'Hasil OSV tidak dapat disimpan ke cache; hasil scan tetap dipakai.',
      });
    }
  }

  const advisoryIds = new Set<string>();
  for (const result of packageResults.values()) {
    for (const vuln of result.vulns) advisoryIds.add(vuln.id);
  }
  const advisoryList = [...advisoryIds].sort();
  const advisoryKeys = advisoryList.map(osvAdvisoryCacheKey);

  let advisoryCache = new Map<string, OsvCacheRecord>();
  if (advisoryKeys.length > 0) {
    try {
      advisoryCache = await timed(timings, 'osv.advisory.cache.read', () =>
        store.getMany(advisoryKeys),
      );
    } catch {
      warnings.push({
        code: 'OSV_CACHE_READ_FAILED',
        message: 'Cache detail advisory OSV tidak dapat dibaca; detail akan diambil ulang.',
      });
    }
  }

  const advisories: Record<string, OsvAdvisoryDetail> = {};
  const detailMisses: string[] = [];
  let detailCacheHits = 0;

  for (const id of advisoryList) {
    const record = advisoryCache.get(osvAdvisoryCacheKey(id));
    const detail = record ? asAdvisoryDetail(record.payload) : null;
    if (record && detail && isFresh(record.fetchedAt, nowMs, ttlMs)) {
      detailCacheHits += 1;
      advisories[detail.id] = detail;
    } else {
      detailMisses.push(id);
    }
  }

  let detailRequests = 0;
  let detailFailures = 0;
  const detailWrites: OsvCacheRecord[] = [];

  if (detailMisses.length > 0) {
    const detailResults = await timed(timings, 'osv.advisory.fetch', () =>
      runWithConcurrency(detailMisses, options.detailConcurrency ?? OSV_DETAIL_CONCURRENCY, async (id) => {
        detailRequests += 1;
        return fetchAdvisory(id, requestContext);
      }),
    );

    for (const result of detailResults) {
      if (!result.ok) {
        detailFailures += 1;
        continue;
      }
      advisories[result.value.id] = result.value;
      detailWrites.push({
        cacheKey: osvAdvisoryCacheKey(result.value.id),
        payload: result.value,
        fetchedAt,
      });
    }

    if (detailFailures === detailMisses.length) {
      if (Object.keys(advisories).length === 0) {
        throw new ScanError('UPSTREAM_UNAVAILABLE', {
          message: 'Detail advisory OSV tidak dapat diambil. Coba lagi sebentar lagi.',
        });
      }
      warnings.push({
        code: 'OSV_DETAIL_PARTIAL',
        message: `Seluruh ${detailMisses.length} detail advisory OSV gagal diambil; sebagian temuan memakai cache.`,
      });
    } else if (detailFailures > 0) {
      warnings.push({
        code: 'OSV_DETAIL_PARTIAL',
        message: `${detailFailures} detail advisory OSV gagal diambil; sebagian temuan mungkin tidak lengkap.`,
      });
    }

    if (detailWrites.length > 0) {
      try {
        await timed(timings, 'osv.advisory.cache.write', () => store.upsert(detailWrites));
      } catch {
        warnings.push({
          code: 'OSV_CACHE_WRITE_FAILED',
          message: 'Detail advisory OSV tidak dapat disimpan ke cache; hasil scan tetap dipakai.',
        });
      }
    }
  }

  const partial = warnings.length > 0;
  return {
    packageResults: [...packageResults.values()],
    advisories,
    warnings,
    partial,
    sourceStatus: partial ? 'PARTIAL' : batchRequests === 0 ? 'CACHE' : 'OK',
    cacheHits,
    cacheMisses: misses.length,
    detailCacheHits,
    batchRequests,
    detailRequests,
    timings,
  };
}
