/**
 * Retensi cloud NFR-14: hapus riwayat lebih lama dari 90 hari secara lazy
 * saat scan berikutnya, tanpa cron/scheduler.
 *
 * Pembersihan dibatasi jumlah baris per pemanggilan (`RETENTION_MAX_ROWS`) dan
 * paling sering sekali per jam per instance agar tidak memperlambat respons.
 * Kegagalan pembersihan tidak pernah menggagalkan scan.
 */

import type { RetentionPurgeResult, RetentionStore } from './store.ts';

export const RETENTION_DAYS = 90;
export const RETENTION_MAX_ROWS = 1_000;
export const RETENTION_INTERVAL_MS = 60 * 60 * 1000;

let lastAttemptAt: number | null = null;

/** Hanya untuk unit test agar throttle tidak bocor antar-kasus. */
export function resetRetentionThrottle(): void {
  lastAttemptAt = null;
}

export interface RetentionRun extends RetentionPurgeResult {
  days: number;
  cutoffIso: string;
  ms: number;
}

/**
 * Jalankan pembersihan bila jendela throttle sudah lewat. Mengembalikan `null`
 * bila dilewati (throttle) atau gagal; tidak pernah melempar.
 */
export async function runLazyRetention(options: {
  store: RetentionStore;
  now: () => number;
  days?: number;
  maxRows?: number;
  /** Abaikan throttle; dipakai unit test. */
  force?: boolean;
}): Promise<RetentionRun | null> {
  const nowMs = options.now();
  if (
    !options.force &&
    lastAttemptAt !== null &&
    nowMs - lastAttemptAt < RETENTION_INTERVAL_MS
  ) {
    return null;
  }
  lastAttemptAt = nowMs;

  const days = options.days ?? RETENTION_DAYS;
  const cutoffIso = new Date(nowMs - days * 24 * 60 * 60 * 1000).toISOString();
  const started = nowMs;

  try {
    const result = await options.store.purgeOlderThan(
      cutoffIso,
      options.maxRows ?? RETENTION_MAX_ROWS,
    );
    return { ...result, days, cutoffIso, ms: Math.max(0, options.now() - started) };
  } catch {
    return null;
  }
}
