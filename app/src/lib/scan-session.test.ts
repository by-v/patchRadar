import {
  clearRememberedScans,
  getLatestRememberedScan,
  getRememberedScan,
  listRememberedScans,
  rememberScanResult,
} from '@/lib/scan-session';
import type { ScanResult } from '@/types/scan';

function scanWithId(scanId: string): ScanResult {
  return {
    scanId,
    repo: { owner: 'a', name: 'b', url: 'https://github.com/a/b', defaultBranch: 'main' },
    scannedAt: '2026-11-13T10:00:00.000Z',
    status: 'COMPLETED',
    manifest: { source: 'PACKAGE_JSON', lockfileFormat: null, estimated: true },
    summary: { totalPackages: 1, affectedPackages: 0, findingCount: 0 },
    findings: [],
    partial: false,
    persisted: false,
    warnings: [],
    sourceStatus: { github: 'OK' },
    timings: { githubMs: 1, totalMs: 2 },
    requestId: 'req_test',
  };
}

describe('scan-session', () => {
  beforeEach(() => clearRememberedScans());

  it('menyimpan dan mengambil hasil berdasarkan scanId', () => {
    const result = scanWithId('scan-1');
    rememberScanResult(result);

    expect(getRememberedScan('scan-1')).toBe(result);
    expect(getRememberedScan('tidak-ada')).toBeNull();
  });

  it('mengembalikan hasil terakhir', () => {
    rememberScanResult(scanWithId('scan-1'));
    rememberScanResult(scanWithId('scan-2'));

    expect(getLatestRememberedScan()?.scanId).toBe('scan-2');
  });

  it('menyegarkan urutan saat scanId yang sama disimpan ulang', () => {
    rememberScanResult(scanWithId('scan-1'));
    rememberScanResult(scanWithId('scan-2'));
    rememberScanResult(scanWithId('scan-1'));

    expect(getLatestRememberedScan()?.scanId).toBe('scan-1');
  });

  it('mendaftar hasil dari yang terbaru', () => {
    rememberScanResult(scanWithId('scan-1'));
    rememberScanResult(scanWithId('scan-2'));
    rememberScanResult(scanWithId('scan-3'));

    expect(listRememberedScans().map((result) => result.scanId)).toEqual([
      'scan-3',
      'scan-2',
      'scan-1',
    ]);
  });

  it('mendaftar hasil kosong saat belum ada pemindaian', () => {
    expect(listRememberedScans()).toEqual([]);
  });

  it('membatasi jumlah hasil yang disimpan', () => {
    for (let index = 0; index < 12; index += 1) {
      rememberScanResult(scanWithId(`scan-${index}`));
    }

    expect(getRememberedScan('scan-0')).toBeNull();
    expect(getRememberedScan('scan-1')).toBeNull();
    expect(getRememberedScan('scan-2')).not.toBeNull();
    expect(getRememberedScan('scan-11')).not.toBeNull();
  });
});
