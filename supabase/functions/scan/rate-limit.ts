/**
 * Rate limit FR-25a (per pengguna anonim) dan FR-25b (per hash IP).
 *
 * FR-25a: maksimum 5 scan per 10 menit per pengguna anonim, berdasarkan klaim
 * `sub` JWT. FR-25b: maksimum 20 scan per jam per hash IP sebagai lapisan
 * tambahan; hanya aktif bila `IP_HASH_SALT` tersedia sehingga alamat IP tidak
 * pernah disimpan mentah.
 *
 * Jendela bergulir: setiap kejadian yang lebih tua dari jendela tidak lagi
 * dihitung, sehingga scan diterima kembali tanpa perlu reset manual.
 */

import { ScanError } from './errors.ts';
import type { RateLimitStore } from './store.ts';

export const RATE_LIMIT_MAX_SCANS = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const RATE_LIMIT_IP_MAX_SCANS = 20;
export const RATE_LIMIT_IP_WINDOW_MS = 60 * 60 * 1000;
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

function ipRateLimitMessage(retryAfter: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfter / 60));
  return `Batas pemindaian dari jaringan ini tercapai. Coba lagi dalam ${minutes} menit.`;
}

/** Detik menunggu berdasarkan kejadian tertua yang masih di jendela. */
function retryAfterSeconds(
  oldestIso: string | undefined,
  sinceIso: string,
  windowMs: number,
  nowMs: number,
): number {
  const oldestMs = Date.parse(oldestIso ?? sinceIso);
  const oldest = Number.isFinite(oldestMs) ? oldestMs : nowMs - windowMs;
  return Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
}

/**
 * Alamat IP klien dari header proxy. Edge Function Supabase menerima
 * `x-forwarded-for`; header alternatif dipakai bila yang pertama tidak ada.
 */
export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  const cfIp = request.headers.get('cf-connecting-ip')?.trim();
  return cfIp && cfIp.length > 0 ? cfIp : null;
}

/**
 * Hash IP dengan garam rahasia (SHA-256). IP mentah tidak pernah disimpan atau
 * dicatat. Garam kosong berarti FR-25b tidak aktif.
 */
export async function hashIp(ip: string, salt: string): Promise<string | null> {
  if (!salt || !ip) return null;
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Periksa kuota FR-25a lalu catat kejadian bila diizinkan.
 * Melempar `ScanError('RATE_LIMITED')` dengan `retryAfter` saat kuota habis.
 */
export async function enforceRateLimit(options: {
  store: RateLimitStore;
  userId: string;
  /** Disertakan pada catatan kejadian bila FR-25b aktif; `null` bila tidak. */
  ipHash?: string | null;
  now: () => number;
}): Promise<RateLimitDecision> {
  const nowMs = options.now();
  const sinceIso = new Date(nowMs - RATE_LIMIT_WINDOW_MS).toISOString();
  const recent = await options.store.listRecent(options.userId, RATE_LIMIT_KIND, sinceIso);

  if (recent.length >= RATE_LIMIT_MAX_SCANS) {
    const retryAfter = retryAfterSeconds(
      recent[0]?.createdAt,
      sinceIso,
      RATE_LIMIT_WINDOW_MS,
      nowMs,
    );

    throw new ScanError('RATE_LIMITED', {
      message: rateLimitMessage(retryAfter),
      retryAfter,
      scope: 'app',
    });
  }

  await options.store.record({
    userId: options.userId,
    kind: RATE_LIMIT_KIND,
    createdAt: new Date(nowMs).toISOString(),
    ipHash: options.ipHash ?? null,
  });

  return { allowed: true, retryAfter: null };
}

/**
 * Periksa kuota FR-25b per hash IP. Tidak mencatat kejadian sendiri; kejadian
 * dicatat oleh `enforceRateLimit` agar satu baris mewakili satu scan.
 */
export async function enforceIpRateLimit(options: {
  store: RateLimitStore;
  ipHash: string;
  now: () => number;
}): Promise<RateLimitDecision> {
  const nowMs = options.now();
  const sinceIso = new Date(nowMs - RATE_LIMIT_IP_WINDOW_MS).toISOString();
  const recent = await options.store.listRecentByIpHash(
    options.ipHash,
    RATE_LIMIT_KIND,
    sinceIso,
  );

  if (recent.length >= RATE_LIMIT_IP_MAX_SCANS) {
    const retryAfter = retryAfterSeconds(
      recent[0]?.createdAt,
      sinceIso,
      RATE_LIMIT_IP_WINDOW_MS,
      nowMs,
    );

    throw new ScanError('RATE_LIMITED', {
      message: ipRateLimitMessage(retryAfter),
      retryAfter,
      scope: 'app',
    });
  }

  return { allowed: true, retryAfter: null };
}
