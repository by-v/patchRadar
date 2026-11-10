/**
 * Katalog CISA KEV: muat salinan lokal, refresh lazy > 24 jam, `STALE`.
 *
 * - Katalog dibaca dari `KevStore` (Supabase atau tiruan memori).
 * - Refresh hanya bila salinan tidak ada atau `updated_at` > 24 jam.
 * - Refresh gagal + salinan lama ada → pakai salinan lama + `STALE`.
 * - Belum ada salinan + refresh gagal → scan tetap berjalan (`EMPTY` + warning).
 * - Pemetaan feed memakai nama field asli feed CISA.
 *
 * Tidak memakai API Node; `fetch` disuntikkan agar unit test tanpa jaringan.
 */

import type { FetchLike } from './github.ts';
import { createStageTimings, timed, type StageTimings } from './lib/timing.ts';
import {
  createMemoryKevStore,
  type KevEntryRecord,
  type KevStore,
} from './store.ts';

export const KEV_FEED_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
export const KEV_REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
export const KEV_FETCH_TIMEOUT_MS = 15_000;
export const KEV_MAX_RETRIES = 2;

/** Bentuk minimum satu entri feed; nama field mengikuti feed asli. */
export interface KevFeedEntry {
  cveID?: unknown;
  vendorProject?: unknown;
  product?: unknown;
  vulnerabilityName?: unknown;
  dateAdded?: unknown;
  knownRansomwareCampaignUse?: unknown;
  [key: string]: unknown;
}

export interface KevFeed {
  catalogVersion?: unknown;
  dateReleased?: unknown;
  count?: unknown;
  vulnerabilities?: unknown;
}

export interface KevWarning {
  code:
    | 'KEV_STALE'
    | 'KEV_UNAVAILABLE'
    | 'KEV_CACHE_READ_FAILED'
    | 'KEV_REFRESH_FAILED';
  message: string;
}

export interface KevCatalogResult {
  entries: KevEntryRecord[];
  sourceStatus: 'OK' | 'CACHE' | 'STALE' | 'EMPTY';
  warnings: KevWarning[];
  refreshed: boolean;
  timings: StageTimings;
}

export interface KevCatalogOptions {
  store?: KevStore;
  fetchImpl?: FetchLike;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  ttlMs?: number;
  timeoutMs?: number;
  maxRetries?: number;
  timings?: StageTimings;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Petakan feed → baris `kev_entries` memakai nama field asli feed.
 * `knownRansomwareCampaignUse` hanya `Known` yang menjadi `true`.
 */
export function mapKevFeed(feed: KevFeed, updatedAt: string): KevEntryRecord[] {
  const rawEntries = Array.isArray(feed?.vulnerabilities) ? feed.vulnerabilities : [];
  const rows: KevEntryRecord[] = [];
  const seen = new Set<string>();

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as KevFeedEntry;
    const cveId = asString(entry.cveID).trim();
    if (!cveId || seen.has(cveId)) continue;
    seen.add(cveId);

    rows.push({
      cveId,
      vendor: asString(entry.vendorProject),
      product: asString(entry.product),
      name: asString(entry.vulnerabilityName),
      dateAdded: asString(entry.dateAdded),
      knownRansomware: entry.knownRansomwareCampaignUse === 'Known',
      raw: entry,
      updatedAt,
    });
  }

  return rows;
}

function isFresh(updatedAt: string | null, nowMs: number, ttlMs: number): boolean {
  if (!updatedAt) return false;
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) && nowMs - timestamp <= ttlMs;
}

class KevFetchError extends Error {}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FetchContext {
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

async function fetchKevFeed(context: FetchContext): Promise<KevFeed> {
  let lastError: KevFetchError | null = null;

  for (let attempt = 0; attempt <= context.maxRetries; attempt += 1) {
    if (attempt > 0) await context.sleep(250 * 2 ** (attempt - 1));

    let response: Response;
    try {
      response = await fetchWithTimeout(context.fetchImpl, KEV_FEED_URL, context.timeoutMs);
    } catch (error) {
      lastError = new KevFetchError(
        error instanceof Error ? error.message : 'Kesalahan jaringan KEV.',
      );
      continue;
    }

    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel().catch(() => undefined);
      lastError = new KevFetchError(`KEV membalas ${response.status}.`);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new KevFetchError(`KEV membalas ${response.status}.`);
    }

    try {
      return (await response.json()) as KevFeed;
    } catch {
      throw new KevFetchError('Respons KEV bukan JSON valid.');
    }
  }

  throw lastError ?? new KevFetchError('Feed KEV tidak dapat diunduh.');
}

/**
 * Muat katalog KEV, refresh lazy bila perlu.
 *
 * Tidak pernah melempar karena kegagalan sumber: kegagalan menjadi warning +
 * `STALE`/`EMPTY` agar scan tetap berjalan.
 */
export async function loadKevCatalog(options: KevCatalogOptions = {}): Promise<KevCatalogResult> {
  const store = options.store ?? createMemoryKevStore();
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? KEV_REFRESH_TTL_MS;
  const timings = options.timings ?? createStageTimings();
  const warnings: KevWarning[] = [];
  const nowMs = now();

  let count = 0;
  let updatedAt: string | null = null;
  try {
    count = await timed(timings, 'kev.catalog.count', () => store.count());
    updatedAt = await timed(timings, 'kev.catalog.latest', () => store.latestUpdatedAt());
  } catch {
    warnings.push({
      code: 'KEV_CACHE_READ_FAILED',
      message: 'Katalog KEV lokal tidak dapat dibaca; mencoba refresh dari feed.',
    });
  }

  const hasCopy = count > 0 && updatedAt !== null;
  if (hasCopy && isFresh(updatedAt, nowMs, ttlMs)) {
    try {
      const entries = await timed(timings, 'kev.catalog.load', () => store.loadAll());
      return {
        entries,
        sourceStatus: 'CACHE',
        warnings,
        refreshed: false,
        timings,
      };
    } catch {
      warnings.push({
        code: 'KEV_CACHE_READ_FAILED',
        message: 'Salinan KEV lokal gagal dimuat; mencoba refresh dari feed.',
      });
    }
  }

  const refreshedAt = new Date(nowMs).toISOString();
  const context: FetchContext = {
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? KEV_FETCH_TIMEOUT_MS,
    sleep: options.sleep ?? defaultSleep,
    maxRetries: options.maxRetries ?? KEV_MAX_RETRIES,
  };

  try {
    const feed = await timed(timings, 'kev.catalog.fetch', () => fetchKevFeed(context));
    const entries = await timed(timings, 'kev.parse', () => mapKevFeed(feed, refreshedAt));
    await timed(timings, 'kev.catalog.store', () => store.replaceAll(entries, refreshedAt));
    return {
      entries,
      sourceStatus: 'OK',
      warnings,
      refreshed: true,
      timings,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refresh KEV gagal.';

    if (hasCopy) {
      try {
        const entries = await timed(timings, 'kev.catalog.load', () => store.loadAll());
        warnings.push({
          code: 'KEV_STALE',
          message: `Refresh KEV gagal; memakai salinan lama (${message}).`,
        });
        return {
          entries,
          sourceStatus: 'STALE',
          warnings,
          refreshed: false,
          timings,
        };
      } catch {
        warnings.push({
          code: 'KEV_CACHE_READ_FAILED',
          message: 'Refresh KEV gagal dan salinan lama tidak dapat dibaca.',
        });
      }
    }

    warnings.push({
      code: 'KEV_UNAVAILABLE',
      message: 'Katalog KEV belum tersedia; pencocokan KEV dilewati untuk scan ini.',
    });
    return {
      entries: [],
      sourceStatus: 'EMPTY',
      warnings,
      refreshed: false,
      timings,
    };
  }
}
