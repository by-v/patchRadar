/**
 * Rate limit FR-25a: maksimum 5 scan per 10 menit per pengguna anonim.
 *
 * Pemeriksaan dilakukan di server berdasarkan klaim `sub` JWT, bukan di UI.
 * Jendela bergulir: setiap kejadian yang lebih tua dari 10 menit tidak lagi
 * dihitung, sehingga scan diterima kembali tanpa perlu reset manual.
 */

import { ScanError } from './errors.ts';
import type { RateLimitStore } from './store.ts';

export const RATE_LIMIT_MAX_SCANS = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_KIND = 'scan';

export interface RateLimitDecision {
  allowed: boolean;
  /** Detik sampai slot berikutnya tersedia; hanya saat ditolak. */
  retryAfter: number | null;
}

function rateLimitMessage(retryAfter: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return `Batas pemindaian tercapai. Coba lagi dalam ${minutes} menit.`;
}

/**
 * Periksa kuota lalu catat kejadian bila diizinkan.
 * Melempar `ScanError('RATE_LIMITED')` dengan `retryAfter` saat kuota habis.
 */
export async function enforceRateLimit(options: {
  store: RateLimitStore;
  userId: string;
  now: () => number;
}): Promise<RateLimitDecision> {
  const nowMs = options.now();
  const sinceIso = new Date(nowMs - RATE_LIMIT_WINDOW_MS).toISOString();
  const recent = await options.store.listRecent(options.userId, RATE_LIMIT_KIND, sinceIso);

  if (recent.length >= RATE_LIMIT_MAX_SCANS) {
    const oldestMs = Date.parse(recent[0]?.createdAt ?? sinceIso);
    const oldest = Number.isFinite(oldestMs) ? oldestMs : nowMs - RATE_LIMIT_WINDOW_MS;
    const retryAfter = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - nowMs) / 1000));

    throw new ScanError('RATE_LIMITED', {
      message: rateLimitMessage(retryAfter),
      retryAfter,
    });
  }

  await options.store.record({
    userId: options.userId,
    kind: RATE_LIMIT_KIND,
    createdAt: new Date(nowMs).toISOString(),
  });

  return { allowed: true, retryAfter: null };
}
