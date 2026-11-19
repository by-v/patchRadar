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
  EpssCacheRecord,
  EpssCacheStore,
  FindingRecord,
  KevEntryRecord,
  KevStore,
  OsvCacheRecord,
  OsvCacheStore,
  RateLimitEventRecord,
  RateLimitStore,
  RetentionPurgeResult,
  RetentionStore,
  ScanRecord,
  ScanStore,
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

/** Batas kunci per GET `epss_cache`; alasan sama dengan cache OSV. */
export const EPSS_CACHE_READ_BATCH_SIZE = 100;

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

function asNumeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

export function createSupabaseEpssCacheStore(options: SupabaseStoreOptions): EpssCacheStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const batchSize = Math.max(1, options.cacheReadBatchSize ?? EPSS_CACHE_READ_BATCH_SIZE);
  const auth = headers(options.serviceRoleKey);

  return {
    async getMany(cveIds) {
      if (cveIds.length === 0) return new Map();
      const found = new Map<string, EpssCacheRecord>();
      for (let index = 0; index < cveIds.length; index += batchSize) {
        const batch = cveIds.slice(index, index + batchSize);
        const query = `epss_cache?select=cve_id,epss,percentile,fetched_at&cve_id=in.(${inList(batch)})`;
        const response = await request(
          fetchImpl,
          endpoint(options.url, query),
          { method: 'GET', headers: auth },
          timeoutMs,
        );
        if (!response.ok) throw new Error(`Supabase epss_cache GET gagal (${response.status}).`);
        const rows = (await response.json()) as PostgrestRow[];
        for (const row of rows) {
          const cveId = asString(row.cve_id);
          if (!cveId) continue;
          found.set(cveId, {
            cveId,
            epss: asNumeric(row.epss),
            percentile: asNumeric(row.percentile),
            fetchedAt: asString(row.fetched_at),
          });
        }
      }
      return found;
    },

    async upsert(records) {
      if (records.length === 0) return;
      const rows = records.map((record) => ({
        cve_id: record.cveId,
        epss: record.epss,
        percentile: record.percentile,
        fetched_at: record.fetchedAt,
      }));
      const response = await request(
        fetchImpl,
        endpoint(options.url, 'epss_cache'),
        {
          method: 'POST',
          headers: headers(options.serviceRoleKey, {
            prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(rows),
        },
        timeoutMs,
      );
      if (!response.ok) throw new Error(`Supabase epss_cache upsert gagal (${response.status}).`);
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

function scanRow(scan: ScanRecord): PostgrestRow {
  return {
    id: scan.id,
    user_id: scan.userId,
    repo_owner: scan.repoOwner,
    repo_name: scan.repoName,
    repo_url: scan.repoUrl,
    status: scan.status,
    manifest_source: scan.manifestSource,
    lockfile_format: scan.lockfileFormat,
    estimated: scan.estimated,
    total_packages: scan.totalPackages,
    affected_packages: scan.affectedPackages,
    finding_count: scan.findingCount,
    partial: scan.partial,
    warnings: scan.warnings,
    source_status: scan.sourceStatus,
    engine_version: scan.engineVersion,
    duration_ms: scan.durationMs,
    created_at: scan.createdAt,
  };
}

function findingRow(finding: FindingRecord): PostgrestRow {
  return {
    id: finding.id,
    scan_id: finding.scanId,
    osv_id: finding.osvId,
    cve_ids: finding.cveIds,
    package_name: finding.packageName,
    installed_version: finding.installedVersion,
    direct: finding.direct,
    dev_only: finding.devOnly,
    parent_package: finding.parentPackage,
    severity: finding.severity,
    cvss_score: finding.cvssScore,
    epss: finding.epss,
    epss_percentile: finding.epssPercentile,
    kev: finding.kev,
    label: finding.label,
    score: finding.score,
    reason: finding.reason,
    fix_version: finding.fixVersion,
    fix_command: finding.fixCommand,
    summary: finding.summary,
    references: finding.references,
  };
}

export function createSupabaseScanStore(options: SupabaseStoreOptions): ScanStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const auth = headers(options.serviceRoleKey);

  return {
    async save(scan, findings) {
      const scanResponse = await request(
        fetchImpl,
        endpoint(options.url, 'scans'),
        {
          method: 'POST',
          headers: headers(options.serviceRoleKey, { prefer: 'return=minimal' }),
          body: JSON.stringify([scanRow(scan)]),
        },
        timeoutMs,
      );
      if (!scanResponse.ok) throw new Error(`Supabase scans insert gagal (${scanResponse.status}).`);

      if (findings.length === 0) return;

      let findingsResponse: Response;
      try {
        findingsResponse = await request(
          fetchImpl,
          endpoint(options.url, 'findings'),
          {
            method: 'POST',
            headers: headers(options.serviceRoleKey, { prefer: 'return=minimal' }),
            body: JSON.stringify(findings.map(findingRow)),
          },
          timeoutMs,
        );
      } catch (error) {
        await deleteScan(fetchImpl, options, auth, scan.id, timeoutMs);
        throw error;
      }

      if (!findingsResponse.ok) {
        // Hindari baris `scans` tanpa findings; kegagalan hapus tetap dilaporkan
        // sebagai kegagalan simpan dan tidak mengubah hasil scan.
        await deleteScan(fetchImpl, options, auth, scan.id, timeoutMs);
        throw new Error(`Supabase findings insert gagal (${findingsResponse.status}).`);
      }
    },
  };
}

async function deleteScan(
  fetchImpl: FetchLike,
  options: SupabaseStoreOptions,
  auth: Record<string, string>,
  scanId: string,
  timeoutMs: number,
): Promise<void> {
  try {
    await request(
      fetchImpl,
      endpoint(options.url, `scans?id=eq.${encodeURIComponent(scanId)}`),
      { method: 'DELETE', headers: auth },
      timeoutMs,
    );
  } catch {
    // Pembersihan best-effort; pemanggil tetap melaporkan kegagalan simpan.
  }
}

export function createSupabaseRateLimitStore(options: SupabaseStoreOptions): RateLimitStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const auth = headers(options.serviceRoleKey);

  async function listWhere(filter: string): Promise<RateLimitEventRecord[]> {
    const query =
      'rate_limit_events?select=user_id,kind,created_at,ip_hash' +
      filter +
      '&order=created_at.asc';
    const response = await request(
      fetchImpl,
      endpoint(options.url, query),
      { method: 'GET', headers: auth },
      timeoutMs,
    );
    if (!response.ok) {
      throw new Error(`Supabase rate_limit_events GET gagal (${response.status}).`);
    }

    const rows = (await response.json()) as PostgrestRow[];
    const events: RateLimitEventRecord[] = [];
    for (const row of rows) {
      const eventUserId = asString(row.user_id);
      const createdAt = asString(row.created_at);
      if (!eventUserId || !createdAt) continue;
      events.push({
        userId: eventUserId,
        kind: asString(row.kind),
        createdAt,
        ipHash: typeof row.ip_hash === 'string' ? row.ip_hash : null,
      });
    }
    return events;
  }

  return {
    async listRecent(userId, kind, sinceIso) {
      return listWhere(
        `&user_id=eq.${encodeURIComponent(userId)}` +
          `&kind=eq.${encodeURIComponent(kind)}` +
          `&created_at=gte.${encodeURIComponent(sinceIso)}`,
      );
    },

    async listRecentByIpHash(ipHash, kind, sinceIso) {
      return listWhere(
        `&ip_hash=eq.${encodeURIComponent(ipHash)}` +
          `&kind=eq.${encodeURIComponent(kind)}` +
          `&created_at=gte.${encodeURIComponent(sinceIso)}`,
      );
    },

    async record(event) {
      const response = await request(
        fetchImpl,
        endpoint(options.url, 'rate_limit_events'),
        {
          method: 'POST',
          headers: headers(options.serviceRoleKey, { prefer: 'return=minimal' }),
          body: JSON.stringify([
            {
              user_id: event.userId,
              kind: event.kind,
              created_at: event.createdAt,
              ip_hash: event.ipHash ?? null,
            },
          ]),
        },
        timeoutMs,
      );
      if (!response.ok) {
        throw new Error(`Supabase rate_limit_events insert gagal (${response.status}).`);
      }
    },
  };
}

/**
 * Retensi cloud (NFR-14): pembersihan lazy lewat RPC `purge_old_scans` dan
 * statistik `scan_storage_stats`. Keduanya hanya dapat dipanggil service role.
 */
export function createSupabaseRetentionStore(options: SupabaseStoreOptions): RetentionStore {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const auth = headers(options.serviceRoleKey);

  async function rpc<T>(name: string, body: unknown): Promise<T> {
    const response = await request(
      fetchImpl,
      endpoint(options.url, `rpc/${name}`),
      { method: 'POST', headers: auth, body: JSON.stringify(body) },
      timeoutMs,
    );
    if (!response.ok) {
      throw new Error(`Supabase rpc ${name} gagal (${response.status}).`);
    }
    return (await response.json()) as T;
  }

  async function dbSizeBytes(): Promise<number | null> {
    const rows = await rpc<PostgrestRow[]>('scan_storage_stats', {});
    const value = Array.isArray(rows) ? rows[0]?.db_size_bytes : undefined;
    return typeof value === 'number' ? value : asNumeric(value ?? null);
  }

  return {
    async purgeOlderThan(cutoffIso, limit) {
      const before = await dbSizeBytes();
      const rows = await rpc<PostgrestRow[]>('purge_old_scans', {
        cutoff: cutoffIso,
        max_rows: limit,
      });
      const row = Array.isArray(rows) ? rows[0] : undefined;
      const result: RetentionPurgeResult = {
        deletedScans: asNumeric(row?.deleted_scans ?? null) ?? 0,
        deletedFindings: asNumeric(row?.deleted_findings ?? null) ?? 0,
        dbSizeBeforeBytes: before,
        dbSizeAfterBytes: await dbSizeBytes(),
      };
      return result;
    },
  };
}
