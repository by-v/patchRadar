/**
 * Header CORS untuk Edge Function `scan`.
 *
 * Browser web mengirim preflight `OPTIONS` karena permintaan memakai
 * `content-type: application/json`, `apikey`, dan `x-client-version`.
 * Tanpa header ini `fetch` di web gagal dan klien menampilkan pesan
 * "Tidak ada koneksi". Native tidak memakai CORS, tetapi header yang sama
 * tidak mengubah perilakunya.
 *
 * Wildcard dipakai karena MVP tidak memakai cookie/credentials; autentikasi
 * tetap lewat `apikey` atau `Authorization: Bearer` yang dikirim eksplisit.
 */

export const CORS_HEADERS: Readonly<Record<string, string>> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-version',
  'access-control-max-age': '86400',
};

/** Balasan preflight; tidak menjalankan pipeline scan. */
export function corsPreflightResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: { ...CORS_HEADERS },
  });
}
