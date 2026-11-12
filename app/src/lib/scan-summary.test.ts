import {
  countFindingsByLabel,
  formatEpss,
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
