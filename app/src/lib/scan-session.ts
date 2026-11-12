import type { ScanResult } from '@/types/scan';

/**
 * Penyimpanan hasil sementara di memori untuk navigasi Hasil → Detail.
 *
 * SQLite baru dibangun pada Minggu 3; sebelum itu hasil hanya perlu bertahan
 * selama sesi aplikasi. Muat ulang web atau restart aplikasi menghapus isi
 * penyimpanan, dan layar Hasil menampilkan state "hasil tidak tersedia".
 */
const MAX_REMEMBERED_SCANS = 10;
const scans = new Map<string, ScanResult>();

export function rememberScanResult(result: ScanResult): void {
  scans.delete(result.scanId);
  scans.set(result.scanId, result);

  while (scans.size > MAX_REMEMBERED_SCANS) {
    const oldest = scans.keys().next();
    if (oldest.done) break;
    scans.delete(oldest.value);
  }
}

export function getRememberedScan(scanId: string): ScanResult | null {
  return scans.get(scanId) ?? null;
}

export function getLatestRememberedScan(): ScanResult | null {
  let latest: ScanResult | null = null;
  for (const result of scans.values()) latest = result;
  return latest;
}

/** Hanya untuk unit test. */
export function clearRememberedScans(): void {
  scans.clear();
}
