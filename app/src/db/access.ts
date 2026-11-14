/**
 * Lapisan akses data lokal untuk layar Riwayat, Hasil, dan Detail.
 *
 * SQLite adalah sumber utama (PRD FR-20/FR-21). Hasil di memori tetap dipakai
 * sebagai fallback ketika database gagal dibuka atau penyimpanan gagal, agar
 * layar Hasil tidak pernah menghilangkan hasil yang baru saja dipindai.
 */

import { getRememberedScan, listRememberedScans } from '@/lib/scan-session';
import type { ScanFinding, ScanResult } from '@/types/scan';

import { getLocalDatabase } from './migrations';
import {
  getScanFinding,
  getScanResult,
  listScanResults,
  saveScanResult,
} from './repository';
import type { SqliteDatabase } from './schema';

/** `CACHE` berarti dibaca dari SQLite; `MEMORY` hanya bertahan selama sesi. */
export type LocalDataSource = 'CACHE' | 'MEMORY';

export type LoadedScan = {
  result: ScanResult;
  source: LocalDataSource;
};

export type LoadedFinding = {
  scan: ScanResult;
  finding: ScanFinding;
  source: LocalDataSource;
};

/** Buka database aplikasi; `null` bila modul native atau migrasi gagal. */
export async function openDatabaseSafely(): Promise<SqliteDatabase | null> {
  try {
    return await getLocalDatabase();
  } catch {
    return null;
  }
}

/**
 * Simpan hasil scan secara lokal. `false` berarti gagal; pemanggil wajib tetap
 * menampilkan hasil dan memberi tahu pengguna (PRD §12 baris 21).
 */
export async function saveScanResultSafely(
  db: SqliteDatabase | null,
  result: ScanResult,
): Promise<boolean> {
  if (!db) return false;
  try {
    await saveScanResult(db, result);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gabungkan riwayat SQLite dengan hasil sesi yang mungkin gagal disimpan.
 * Hasil dari database menang bila `scanId` sama, lalu diurutkan terbaru dulu.
 */
export async function loadScansForHistory(
  db: SqliteDatabase | null,
): Promise<ScanResult[]> {
  let stored: ScanResult[] = [];
  if (db) {
    try {
      stored = await listScanResults(db);
    } catch {
      stored = [];
    }
  }

  const merged = new Map<string, ScanResult>();
  for (const result of stored) merged.set(result.scanId, result);
  for (const result of listRememberedScans()) {
    if (!merged.has(result.scanId)) merged.set(result.scanId, result);
  }

  return Array.from(merged.values()).sort((left, right) =>
    right.scannedAt.localeCompare(left.scannedAt),
  );
}

/** Baca satu hasil dari SQLite; fallback ke memori bila tidak tersedia. */
export async function loadScanForDisplay(
  db: SqliteDatabase | null,
  scanId: string,
): Promise<LoadedScan | null> {
  if (db) {
    try {
      const stored = await getScanResult(db, scanId);
      if (stored) return { result: stored, source: 'CACHE' };
    } catch {
      // Database rusak/tidak dapat dibaca: lanjut ke hasil sesi.
    }
  }

  const remembered = getRememberedScan(scanId);
  return remembered ? { result: remembered, source: 'MEMORY' } : null;
}

/** Baca satu temuan beserta konteks scan-nya dari SQLite, lalu memori. */
export async function loadFindingForDisplay(
  db: SqliteDatabase | null,
  scanId: string,
  findingId: string,
): Promise<LoadedFinding | null> {
  if (db) {
    try {
      const scan = await getScanResult(db, scanId);
      if (scan) {
        const finding = await getScanFinding(db, scanId, findingId);
        if (finding) return { scan, finding, source: 'CACHE' };
      }
    } catch {
      // Lanjut ke hasil sesi di bawah.
    }
  }

  const scan = getRememberedScan(scanId);
  const finding = scan?.findings.find((entry) => entry.findingId === findingId) ?? null;
  return scan && finding ? { scan, finding, source: 'MEMORY' } : null;
}
