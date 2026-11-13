/** Format waktu untuk layar Hasil tanpa bergantung pada locale perangkat. */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

/**
 * Waktu relatif berbahasa Indonesia. Tanggal lebih dari 7 hari memakai
 * bentuk absolut `1 Nov 2026` agar tetap informatif.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'waktu tidak diketahui';

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'baru saja';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;

  const month = MONTHS[date.getMonth()] ?? '';
  return `${date.getDate()} ${month} ${date.getFullYear()}`;
}

/** Tanggal dan jam lokal ringkas untuk kartu Riwayat, mis. `13 Nov 2026, 17.05`. */
export function formatLocalDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'waktu tidak diketahui';

  const month = MONTHS[date.getMonth()] ?? '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${month} ${date.getFullYear()}, ${hours}.${minutes}`;
}
