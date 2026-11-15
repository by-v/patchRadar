/**
 * Katalog teks error PatchRadar (PRD §12).
 *
 * Semua teks yang tampil ke pengguna berada di satu tempat agar matriks error
 * 23 kondisi mudah diaudit. Teks memakai sapuan bahasa T-W2-07 ("repo" menjadi
 * "repositori"); kode dan identifier tetap berbahasa Inggris.
 */

import type { ScanErrorCode } from '@/types/scan';

/** Teks PRD §12 baris 1–4. */
export const REPO_LINK_MESSAGES = {
  empty: 'Tempel tautan repositori GitHub terlebih dahulu.',
  format: 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repositori.',
  host: 'Hanya tautan github.com yang didukung.',
  path: 'Gunakan tautan halaman utama repositori, tanpa /tree, /blob, atau parameter.',
} as const;

/** Teks PRD §12 baris 18 dan 19. */
export const AUTH_MESSAGES = {
  SESSION_UNAVAILABLE: 'Sesi belum siap. Periksa koneksi lalu coba lagi.',
  SESSION_REFRESH_FAILED: 'Sesi diperbarui. Silakan coba lagi.',
} as const;

/** Teks PRD §12 baris 17; tautan Riwayat ditambahkan pada T-W3-07c. */
export const OFFLINE_MESSAGE = 'Tidak ada koneksi. Periksa jaringan lalu coba lagi.';

/** Teks PRD §12 baris 21. */
export const SQLITE_SAVE_FAILED_MESSAGE =
  'Hasil berhasil dipindai, tetapi gagal disimpan di perangkat.';

/** Teks PRD §12 baris 22; `requestId` ditambahkan oleh `invalidResponseMessage`. */
export const INVALID_RESPONSE_MESSAGE = 'Terjadi kesalahan saat membaca hasil. Coba lagi.';

/** Teks PRD §12 baris 23; server juga mengirim teks ini sebagai warning. */
export const CLOUD_PERSIST_FAILED_MESSAGE =
  'Riwayat cloud gagal disimpan; hasil tetap tersedia di perangkat.';

/** Pesan untuk setiap kode error yang dikenal klien. */
export const SCAN_ERROR_MESSAGES: Readonly<Record<ScanErrorCode, string>> = {
  INVALID_URL: REPO_LINK_MESSAGES.format,
  UNAUTHENTICATED: AUTH_MESSAGES.SESSION_UNAVAILABLE,
  REPO_PRIVATE_OR_FORBIDDEN:
    'Repositori ini privat atau tidak dapat diakses. PatchRadar hanya memindai repositori publik.',
  REPO_NOT_FOUND: 'Repositori tidak ditemukan. Periksa ejaan pemilik dan nama repositori.',
  REPO_NOT_FOUND_OR_PRIVATE:
    'Repositori tidak ditemukan atau bersifat privat. PatchRadar hanya bisa memindai repositori publik.',
  NO_PACKAGE_JSON:
    'package.json tidak ditemukan di folder utama repositori. PatchRadar hanya memindai berkas dependensi di folder utama.',
  MANIFEST_TOO_LARGE:
    'Repositori melebihi batas ukuran sementara (5 MB atau 1.500 paket). Coba repositori yang lebih kecil.',
  RATE_LIMITED: 'Terlalu banyak pemindaian. Coba lagi sebentar lagi.',
  UPSTREAM_UNAVAILABLE: 'Layanan kerentanan sedang sibuk. Coba lagi sebentar lagi.',
  SCAN_TIMEOUT:
    'Pemindaian melebihi batas waktu. Coba lagi atau pindai repositori yang lebih kecil.',
  INTERNAL: 'Terjadi kesalahan pada server. Coba lagi.',
  METHOD_NOT_ALLOWED: 'Metode permintaan tidak didukung.',
  INVALID_RESPONSE: INVALID_RESPONSE_MESSAGE,
  NETWORK: OFFLINE_MESSAGE,
  TIMEOUT: 'Pemindaian melebihi batas waktu. Coba lagi atau pindai repositori yang lebih kecil.',
  CONFIG: 'Konfigurasi aplikasi belum lengkap. Hubungi pengembang.',
  UNKNOWN: 'Terjadi kesalahan saat memindai. Coba lagi.',
};

/** Cakupan batas laju pada kontrak error (PRD §12 baris 11 dan 20). */
export type RateLimitScope = 'app' | 'github';

function retryAfterMinutes(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Pesan 429 dengan hitung mundur menit. GitHub dan batas aplikasi memakai teks
 * berbeda (PRD §12 baris 11 dan 20) walau kode kontraknya sama-sama
 * `RATE_LIMITED`.
 */
export function rateLimitMessage(
  retryAfterSeconds: number | null,
  scope: RateLimitScope | null = null,
): string {
  const prefix =
    scope === 'github'
      ? 'Batas permintaan GitHub tercapai.'
      : 'Terlalu banyak pemindaian.';

  if (retryAfterSeconds === null) {
    return `${prefix} Coba lagi sebentar lagi.`;
  }

  return `${prefix} Coba lagi dalam ${retryAfterMinutes(retryAfterSeconds)} menit.`;
}

/** Akhiran kode pelacakan untuk error umum. */
export function requestIdSuffix(requestId: string | null): string {
  return requestId === null ? '' : ` Kode: ${requestId}.`;
}

/** Teks PRD §12 baris 22 beserta `requestId` bila tersedia. */
export function invalidResponseMessage(requestId: string | null): string {
  return `${INVALID_RESPONSE_MESSAGE}${requestIdSuffix(requestId)}`;
}

/**
 * Cara menampilkan error menurut prinsip PRD §12: error yang dapat diperbaiki
 * pengguna tampil inline; error yang menghentikan scan tampil sebagai layar
 * dengan tindakan.
 */
export type ScanErrorPresentation = 'INLINE' | 'SCREEN';

const SCREEN_ERROR_CODES: ReadonlySet<ScanErrorCode> = new Set<ScanErrorCode>([
  'REPO_PRIVATE_OR_FORBIDDEN',
  'REPO_NOT_FOUND',
  'REPO_NOT_FOUND_OR_PRIVATE',
  'NO_PACKAGE_JSON',
  'MANIFEST_TOO_LARGE',
  'UPSTREAM_UNAVAILABLE',
  'SCAN_TIMEOUT',
  'INTERNAL',
  'INVALID_RESPONSE',
  'TIMEOUT',
  'UNKNOWN',
]);

/** Error penghenti ditampilkan sebagai layar, bukan banner inline. */
export function scanErrorPresentation(code: ScanErrorCode): ScanErrorPresentation {
  return SCREEN_ERROR_CODES.has(code) ? 'SCREEN' : 'INLINE';
}

export function isBlockingScanError(code: ScanErrorCode): boolean {
  return scanErrorPresentation(code) === 'SCREEN';
}

const HISTORY_ERROR_CODES: ReadonlySet<ScanErrorCode> = new Set<ScanErrorCode>([
  'UPSTREAM_UNAVAILABLE',
  'SCAN_TIMEOUT',
  'TIMEOUT',
  'NETWORK',
]);

/** Kondisi yang menawarkan hasil cache terakhir dari Riwayat (PRD §12 baris 12, 16, 17). */
export function offersHistory(code: ScanErrorCode): boolean {
  return HISTORY_ERROR_CODES.has(code);
}
