/**
 * Implementasi penyimpanan Supabase (PostgREST) untuk pipeline `scan`.
 *
 * Service role hanya dipakai server-side dan tidak pernah dicatat. Semua akses
 * melewati antarmuka `OsvCacheStore`/`KevStore` agar unit test memakai memori.
 *
 * Catatan: migrasi hanya ditulis sebagai file; implementasi ini tidak diuji ke
 * proyek remote sampai `T-W1-12d`.
 */

import type { FetchLike } from './github.ts';
import type {
  KevEntryRecord,
  KevStore,
  OsvCacheRecord,
  OsvCacheStore,
} from './store.ts';

export interface SupabaseStoreOptions {
  /** Contoh: `https://<project-ref>.supabase.co`. */
  url: string;
  /** Service role key; hanya dari environment/server, tidak pernah di-log. */
  serviceRoleKey: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /**
   * Jumlah kunci per permintaan GET `osv_cache`.
   *
   * URL `in.(...)` yang memuat ratusan kunci melewati batas header/URL runtime
   * dan gagal sebelum permintaan terkirim (terbukti di `T-W1-12d`). Batch kecil
   * menjaga panjang URL tetap jauh di bawah batas tersebut.
   */
  cacheReadBatchSize?: number;
}

/** Batas aman kunci per GET; 100 kunci ≈ 5,6 ribu karakter URL setelah encoding. */
export const OSV_CACHE_READ_BATCH_SIZE = 100;

interface PostgrestRow {
  [key: string]: unknown;
}

function headers(serviceRoleKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}/rest/v1/${path}`;
}

async function request(
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

function inList(values: readonly string[]): string {
  return values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(',');
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function createSupabaseOsvCacheStore(options: SupabaseStoreOptions): OsvCacheStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const batchSize = Math.max(1, options.cacheReadBatchSize ?? OSV_CACHE_READ_BATCH_SIZE);
  const auth = headers(options.serviceRoleKey);

  return {
    async getMany(keys) {
      if (keys.length === 0) return new Map();
      const found = new Map<string, OsvCacheRecord>();
      for (let index = 0; index < keys.length; index += batchSize) {
        const batch = keys.slice(index, index + batchSize);
        const query = `osv_cache?select=cache_key,payload,fetched_at&cache_key=in.(${inList(batch)})`;
        const response = await request(fetchImpl, endpoint(options.url, query), { method: 'GET', headers: auth }, timeoutMs);
        if (!response.ok) throw new Error(`Supabase osv_cache GET gagal (${response.status}).`);
        const rows = (await response.json()) as PostgrestRow[];
        for (const row of rows) {
          const cacheKey = asString(row.cache_key);
          if (!cacheKey) continue;
          found.set(cacheKey, {
            cacheKey,
            payload: row.payload,
            fetchedAt: asString(row.fetched_at),
          });
        }
      }
      return found;
    },

    async upsert(records) {
      if (records.length === 0) return;
      const rows = records.map((record) => ({
        cache_key: record.cacheKey,
        payload: record.payload,
        fetched_at: record.fetchedAt,
      }));
      const response = await request(
        fetchImpl,
        endpoint(options.url, 'osv_cache'),
        {
          method: 'POST',
          headers: headers(options.serviceRoleKey, {
            prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(rows),
        },
        timeoutMs,
      );
      if (!response.ok) throw new Error(`Supabase osv_cache upsert gagal (${response.status}).`);
    },
  };
}

export function createSupabaseKevStore(options: SupabaseStoreOptions): KevStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const auth = headers(options.serviceRoleKey);

  return {
    async count() {
      const response = await request(
        fetchImpl,
        endpoint(options.url, 'kev_entries?select=cve_id'),
        { method: 'GET', headers: headers(options.serviceRoleKey, { prefer: 'count=exact' }) },
        timeoutMs,
      );
      if (!response.ok) throw new Error(`Supabase kev_entries count gagal (${response.status}).`);
      const range = response.headers.get('content-range');
      const total = range?.split('/')[1];
      if (total && /^\d+$/.test(total)) return Number(total);
      const rows = (await response.json()) as unknown[];
      return rows.length;
    },

    async latestUpdatedAt() {
      const response = await request(
        fetchImpl,
        endpoint(options.url, 'kev_entries?select=updated_at&order=updated_at.desc&limit=1'),
        { method: 'GET', headers: auth },
        timeoutMs,
      );
      if (!response.ok) throw new Error(`Supabase kev_entries latest gagal (${response.status}).`);
      const rows = (await response.json()) as PostgrestRow[];
      const value = rows[0]?.updated_at;
      return typeof value === 'string' ? value : null;
    },

    async loadAll() {
      const response = await request(
        fetchImpl,
        endpoint(
          options.url,
          'kev_entries?select=cve_id,vendor,product,name,date_added,known_ransomware,raw,updated_at',
        ),
        { method: 'GET', headers: auth },
        timeoutMs,
      );
      if (!response.ok) throw new Error(`Supabase kev_entries GET gagal (${response.status}).`);
      const rows = (await response.json()) as PostgrestRow[];
      return rows.map((row) => ({
        cveId: asString(row.cve_id),
        vendor: asString(row.vendor),
        product: asString(row.product),
        name: asString(row.name),
        dateAdded: asString(row.date_added),
        knownRansomware: row.known_ransomware === true,
        raw: row.raw,
        updatedAt: asString(row.updated_at),
      }));
    },

    async replaceAll(entries, updatedAt) {
      const rows = entries.map((entry) => ({
        cve_id: entry.cveId,
        vendor: entry.vendor,
        product: entry.product,
        name: entry.name,
        date_added: entry.dateAdded,
        known_ransomware: entry.knownRansomware,
        raw: entry.raw,
        updated_at: updatedAt,
      }));
      if (rows.length > 0) {
        const response = await request(
          fetchImpl,
          endpoint(options.url, 'kev_entries'),
          {
            method: 'POST',
            headers: headers(options.serviceRoleKey, {
              prefer: 'resolution=merge-duplicates,return=minimal',
            }),
            body: JSON.stringify(rows),
          },
          timeoutMs,
        );
        if (!response.ok) throw new Error(`Supabase kev_entries upsert gagal (${response.status}).`);
      }
    },
  };
}
