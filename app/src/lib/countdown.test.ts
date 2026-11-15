import { formatCountdown } from './countdown';

describe('formatCountdown', () => {
  it('menampilkan menit dan detik dua digit', () => {
    expect(formatCountdown(600)).toBe('10:00');
    expect(formatCountdown(59)).toBe('0:59');
    expect(formatCountdown(65)).toBe('1:05');
  });

  it('membulatkan ke atas dan tidak pernah negatif', () => {
    expect(formatCountdown(0.2)).toBe('0:01');
    expect(formatCountdown(-5)).toBe('0:00');
    expect(formatCountdown(Number.NaN)).toBe('0:00');
  });
});
