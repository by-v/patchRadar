import {
  countFindingsByLabel,
  formatCvss,
  formatEpss,
  formatEpssPercentile,
  formatEpssValue,
  formatScore,
  nonEmptyLabelCounts,
} from '@/lib/scan-summary';
import type { ScanFinding } from '@/types/scan';

function findingWithLabel(label: ScanFinding['priority']['label']): Pick<ScanFinding, 'priority'> {
  return { priority: { label, score: 1, reason: 'uji' } };
}

describe('countFindingsByLabel', () => {
  it('menghitung temuan per label', () => {
    const counts = countFindingsByLabel([
      findingWithLabel('FIX_NOW'),
      findingWithLabel('FIX_NOW'),
      findingWithLabel('SCHEDULE'),
      findingWithLabel('MONITOR'),
    ]);

    expect(counts).toEqual({ FIX_NOW: 2, SCHEDULE: 1, MONITOR: 1 });
  });

  it('mengembalikan nol untuk daftar kosong', () => {
    expect(countFindingsByLabel([])).toEqual({ FIX_NOW: 0, SCHEDULE: 0, MONITOR: 0 });
  });
});

describe('nonEmptyLabelCounts', () => {
  it('mempertahankan urutan label dan membuang yang nol', () => {
    expect(
      nonEmptyLabelCounts({ FIX_NOW: 0, SCHEDULE: 3, MONITOR: 0 }),
    ).toEqual([{ label: 'SCHEDULE', count: 3 }]);
  });
});

describe('formatEpss', () => {
  it('memakai satu desimal dan koma Indonesia', () => {
    expect(formatEpss(0.842, true)).toBe('EPSS 84,2%');
    expect(formatEpss(0.021, true)).toBe('EPSS 2,1%');
  });

  it('menandai EPSS yang tidak tersedia', () => {
    expect(formatEpss(null, false)).toBe('EPSS tidak tersedia');
    expect(formatEpss(0.5, false)).toBe('EPSS tidak tersedia');
    expect(formatEpss(null, true)).toBe('EPSS tidak tersedia');
  });
});

describe('formatEpssValue', () => {
  it('menampilkan persentase tanpa awalan', () => {
    expect(formatEpssValue(0.842, true)).toBe('84,2%');
    expect(formatEpssValue(0.00982, true)).toBe('1,0%');
  });

  it('menandai nilai yang tidak tersedia', () => {
    expect(formatEpssValue(null, true)).toBe('Tidak tersedia');
    expect(formatEpssValue(0.5, false)).toBe('Tidak tersedia');
  });
});

describe('formatEpssPercentile', () => {
  it('membulatkan persentil ke bilangan bulat', () => {
    expect(formatEpssPercentile(0.62772, true)).toBe('Persentil 63');
    expect(formatEpssPercentile(0.004, true)).toBe('Persentil 0');
  });

  it('menandai persentil yang tidak tersedia', () => {
    expect(formatEpssPercentile(null, true)).toBe('Persentil tidak tersedia');
    expect(formatEpssPercentile(0.5, false)).toBe('Persentil tidak tersedia');
  });
});

describe('formatCvss', () => {
  it('memakai satu desimal dan koma Indonesia', () => {
    expect(formatCvss(4)).toBe('CVSS 4,0');
    expect(formatCvss(9.8)).toBe('CVSS 9,8');
  });

  it('menandai CVSS yang tidak tersedia', () => {
    expect(formatCvss(null)).toBe('CVSS tidak tersedia');
  });
});

describe('formatScore', () => {
  it('memakai satu desimal dan koma Indonesia', () => {
    expect(formatScore(25.3)).toBe('25,3');
    expect(formatScore(100)).toBe('100,0');
  });
});
