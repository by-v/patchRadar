/**
 * Perakitan dependensi produksi untuk Edge Function `scan`.
 *
 * Dipakai oleh `index.ts` dan oleh test penyambungan agar jalur komposisi sama.
 * Bila konfigurasi Supabase tidak lengkap, pemanggil harus mengembalikan error
 * terklasifikasi (tidak boleh menjalankan scan tanpa store cloud/rate-limit).
 */

import { ScanError } from './errors.ts';
import type { ScanHandlerDependencies } from './handler.ts';
import {
  createSupabaseEpssCacheStore,
  createSupabaseKevStore,
  createSupabaseOsvCacheStore,
  createSupabaseRateLimitStore,
  createSupabaseRetentionStore,
  createSupabaseScanStore,
  type SupabaseStoreOptions,
} from './supabase-store.ts';
import { RETENTION_DAYS } from './retention.ts';

export type EnvReader = (name: string) => string | undefined;

export interface CompositionStoreOptions {
  fetchImpl?: SupabaseStoreOptions['fetchImpl'];
  timeoutMs?: number;
  cacheReadBatchSize?: number;
}

export interface BuildScanDependenciesOptions {
  /** Opsi untuk semua store Supabase (mis. fetch tiruan PostgREST pada test). */
  storeOptions?: CompositionStoreOptions;
}

export interface ScanDependenciesOk {
  ok: true;
  dependencies: ScanHandlerDependencies;
  /** Nama variabel yang hilang; kosong bila konfigurasi lengkap. */
  missing: [];
}

export interface ScanDependenciesMisconfigured {
  ok: false;
  missing: string[];
}

export type BuildScanDependenciesResult = ScanDependenciesOk | ScanDependenciesMisconfigured;

const REQUIRED_STORE_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

/**
 * `RETENTION_DAYS`: angka hari (1–3650) atau `off`/`0` untuk mematikan.
 * Nilai tidak dikenal memakai default 90 agar data tetap dibersihkan.
 */
export function parseRetentionDays(value: string | undefined): number {
  if (value === undefined) return RETENTION_DAYS;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'off' || normalized === '0') return 0;
  if (!/^\d+$/.test(normalized)) return RETENTION_DAYS;
  const days = Number(normalized);
  return days >= 1 && days <= 3650 ? days : RETENTION_DAYS;
}

/**
 * Rakit dependensi handler. Tidak pernah mengembalikan/menyimpan nilai env.
 *
 * - `GITHUB_TOKEN` hilang: tidak dianggap misconfig di sini; handler tetap
 *   menolak dengan `UPSTREAM_UNAVAILABLE` seperti perilaku sebelumnya.
 * - `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` hilang: misconfig (tidak boleh
 *   berjalan tanpa store cloud dan rate limit).
 */
export function buildScanDependencies(
  getEnv: EnvReader,
  options: BuildScanDependenciesOptions = {},
): BuildScanDependenciesResult {
  const token = getEnv('GITHUB_TOKEN') ?? null;
  const supabaseUrl = getEnv('SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  const missing: string[] = [];
  for (const name of REQUIRED_STORE_ENV) {
    const value = getEnv(name);
    if (typeof value !== 'string' || value.trim().length === 0) {
      missing.push(name);
    }
  }

  if (missing.length > 0 || !supabaseUrl || !serviceRoleKey) {
    return { ok: false, missing };
  }

  const storeBase: SupabaseStoreOptions = {
    url: supabaseUrl,
    serviceRoleKey,
    ...options.storeOptions,
  };

  // FR-25b nonaktif bila garam tidak diset; FR-25a tetap berjalan.
  const ipHashSalt = getEnv('IP_HASH_SALT')?.trim() || null;

  return {
    ok: true,
    missing: [],
    dependencies: {
      token,
      osvStore: createSupabaseOsvCacheStore(storeBase),
      kevStore: createSupabaseKevStore(storeBase),
      epssStore: createSupabaseEpssCacheStore(storeBase),
      scanStore: createSupabaseScanStore(storeBase),
      rateLimitStore: createSupabaseRateLimitStore(storeBase),
      retentionStore: createSupabaseRetentionStore(storeBase),
      retentionDays: parseRetentionDays(getEnv('RETENTION_DAYS')),
      ipHashSalt,
    },
  };
}

/** Log server-side konfigurasi yang hilang tanpa menampilkan nilai. */
export function logScanMisconfiguration(missing: readonly string[]): void {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'scan.misconfigured',
      missing: [...missing],
    }),
  );
}

/** Error terklasifikasi untuk klien (tanpa nama variabel/nilai). */
export function scanMisconfiguredError(): ScanError {
  return new ScanError('SERVER_MISCONFIGURED');
}
