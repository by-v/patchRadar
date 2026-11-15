/**
 * Format hitung mundur untuk pesan batas laju (FR-25a).
 * Selalu menampilkan menit:detik agar angka berubah tiap detik.
 */
export function formatCountdown(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : 0;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
