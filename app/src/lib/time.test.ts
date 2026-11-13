import { formatLocalDateTime, formatRelativeTime } from '@/lib/time';

const NOW = new Date('2026-11-13T12:00:00.000Z');

function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe('formatRelativeTime', () => {
  it('menampilkan "baru saja" di bawah satu menit', () => {
    expect(formatRelativeTime(minutesAgo(0), NOW)).toBe('baru saja');
    expect(formatRelativeTime(minutesAgo(0.5), NOW)).toBe('baru saja');
  });

  it('menampilkan menit', () => {
    expect(formatRelativeTime(minutesAgo(1), NOW)).toBe('1 menit lalu');
    expect(formatRelativeTime(minutesAgo(59), NOW)).toBe('59 menit lalu');
  });

  it('menampilkan jam', () => {
    expect(formatRelativeTime(minutesAgo(60), NOW)).toBe('1 jam lalu');
    expect(formatRelativeTime(minutesAgo(23 * 60), NOW)).toBe('23 jam lalu');
  });

  it('menampilkan hari', () => {
    expect(formatRelativeTime(minutesAgo(24 * 60), NOW)).toBe('1 hari lalu');
    expect(formatRelativeTime(minutesAgo(6 * 24 * 60), NOW)).toBe('6 hari lalu');
  });

  it('menampilkan tanggal absolut setelah tujuh hari', () => {
    const old = new Date(2026, 10, 1, 9, 30);
    expect(formatRelativeTime(old.toISOString(), new Date(2026, 10, 13, 9, 30))).toBe(
      '1 Nov 2026',
    );
  });

  it('menangani waktu di masa depan dan ISO tidak valid', () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 60_000).toISOString(), NOW)).toBe(
      'baru saja',
    );
    expect(formatRelativeTime('bukan tanggal', NOW)).toBe('waktu tidak diketahui');
  });
});

describe('formatLocalDateTime', () => {
  it('memakai tanggal, bulan Indonesia, dan jam dua digit', () => {
    expect(formatLocalDateTime(new Date(2026, 10, 13, 9, 5).toISOString())).toBe(
      '13 Nov 2026, 09.05',
    );
    expect(formatLocalDateTime(new Date(2026, 0, 2, 17, 30).toISOString())).toBe(
      '2 Jan 2026, 17.30',
    );
  });

  it('menandai ISO tidak valid', () => {
    expect(formatLocalDateTime('bukan tanggal')).toBe('waktu tidak diketahui');
  });
});
