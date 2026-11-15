import {
  AUTH_MESSAGES,
  CLOUD_PERSIST_FAILED_MESSAGE,
  INVALID_RESPONSE_MESSAGE,
  invalidResponseMessage,
  isBlockingScanError,
  OFFLINE_MESSAGE,
  offersHistory,
  rateLimitMessage,
  REPO_LINK_MESSAGES,
  SCAN_ERROR_MESSAGES,
  SQLITE_SAVE_FAILED_MESSAGE,
} from '@/errors/messages';
import { REPO_LINK_MESSAGES as URL_MESSAGES } from '@/lib/url';
import type { ScanErrorCode } from '@/types/scan';

const ALL_CODES: ScanErrorCode[] = [
  'INVALID_URL',
  'UNAUTHENTICATED',
  'REPO_PRIVATE_OR_FORBIDDEN',
  'REPO_NOT_FOUND',
  'REPO_NOT_FOUND_OR_PRIVATE',
  'NO_PACKAGE_JSON',
  'MANIFEST_TOO_LARGE',
  'RATE_LIMITED',
  'UPSTREAM_UNAVAILABLE',
  'SCAN_TIMEOUT',
  'INTERNAL',
  'METHOD_NOT_ALLOWED',
  'INVALID_RESPONSE',
  'NETWORK',
  'TIMEOUT',
  'CONFIG',
  'UNKNOWN',
];

describe('katalog pesan error PRD §12', () => {
  it('menyimpan teks kondisi 1–4 dan memakai sumber yang sama dengan parser tautan', () => {
    expect(REPO_LINK_MESSAGES).toEqual({
      empty: 'Tempel tautan repositori GitHub terlebih dahulu.',
      format:
        'Tautan tidak valid. Gunakan format https://github.com/pemilik/repositori.',
      host: 'Hanya tautan github.com yang didukung.',
      path:
        'Gunakan tautan halaman utama repositori, tanpa /tree, /blob, atau parameter.',
    });
    expect(URL_MESSAGES).toBe(REPO_LINK_MESSAGES);
  });

  it('menyediakan pesan untuk setiap kode yang dikenal klien', () => {
    for (const code of ALL_CODES) {
      expect(typeof SCAN_ERROR_MESSAGES[code]).toBe('string');
      expect(SCAN_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it('tidak memuat pesan Inggris, undefined, atau jejak tumpukan', () => {
    const messages = [
      ...Object.values(SCAN_ERROR_MESSAGES),
      ...Object.values(AUTH_MESSAGES),
      ...Object.values(REPO_LINK_MESSAGES),
      OFFLINE_MESSAGE,
      SQLITE_SAVE_FAILED_MESSAGE,
      CLOUD_PERSIST_FAILED_MESSAGE,
      INVALID_RESPONSE_MESSAGE,
    ];

    for (const message of messages) {
      expect(message).not.toMatch(/\bundefined\b|\bnull\b|\bError\b|\bException\b/);
      expect(message).not.toMatch(/\n\s*at\s/);
      expect(message).not.toMatch(/stack trace/i);
    }
  });

  it('memisahkan error inline dari layar error penghenti', () => {
    expect(isBlockingScanError('INVALID_URL')).toBe(false);
    expect(isBlockingScanError('REPO_NOT_FOUND')).toBe(true);
    expect(isBlockingScanError('REPO_PRIVATE_OR_FORBIDDEN')).toBe(true);
    expect(isBlockingScanError('REPO_NOT_FOUND_OR_PRIVATE')).toBe(true);
    expect(isBlockingScanError('NO_PACKAGE_JSON')).toBe(true);
    expect(isBlockingScanError('MANIFEST_TOO_LARGE')).toBe(true);
    expect(isBlockingScanError('RATE_LIMITED')).toBe(false);
    expect(isBlockingScanError('NETWORK')).toBe(false);
    expect(isBlockingScanError('UNAUTHENTICATED')).toBe(false);
  });

  it('menampilkan hitung mundur pada batas laju aplikasi dan GitHub', () => {
    expect(rateLimitMessage(600)).toBe(
      'Terlalu banyak pemindaian. Coba lagi dalam 10 menit.',
    );
    expect(rateLimitMessage(90)).toBe(
      'Terlalu banyak pemindaian. Coba lagi dalam 2 menit.',
    );
    expect(rateLimitMessage(30, 'github')).toBe(
      'Batas permintaan GitHub tercapai. Coba lagi dalam 1 menit.',
    );
    expect(rateLimitMessage(null, 'github')).toBe(
      'Batas permintaan GitHub tercapai. Coba lagi sebentar lagi.',
    );
  });

  it('memakai teks PRD untuk offline, simpan SQLite, dan simpan cloud', () => {
    expect(OFFLINE_MESSAGE).toBe(
      'Tidak ada koneksi. Hasil tersimpan tetap bisa dibuka dari Riwayat.',
    );
    expect(SQLITE_SAVE_FAILED_MESSAGE).toBe(
      'Hasil berhasil dipindai, tetapi gagal disimpan di perangkat.',
    );
    expect(CLOUD_PERSIST_FAILED_MESSAGE).toBe(
      'Riwayat cloud gagal disimpan; hasil tetap tersedia di perangkat.',
    );
    expect(SCAN_ERROR_MESSAGES.NETWORK).toBe(OFFLINE_MESSAGE);
  });

  it('menambahkan requestId pada respons server yang tidak valid', () => {
    expect(invalidResponseMessage('req_123')).toBe(
      'Terjadi kesalahan saat membaca hasil. Coba lagi. Kode: req_123.',
    );
    expect(invalidResponseMessage(null)).toBe(INVALID_RESPONSE_MESSAGE);
  });

  it('menawarkan Riwayat untuk kegagalan upstream, timeout, dan offline', () => {
    expect(offersHistory('UPSTREAM_UNAVAILABLE')).toBe(true);
    expect(offersHistory('SCAN_TIMEOUT')).toBe(true);
    expect(offersHistory('NETWORK')).toBe(true);
    expect(offersHistory('REPO_NOT_FOUND')).toBe(false);
  });
});
