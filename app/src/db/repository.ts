/**
 * Repository SQLite lokal untuk riwayat pemindaian (PRD FR-20/FR-21).
 *
 * `local_scans.payload_json` menyimpan respons final lengkap agar layar Hasil
 * dapat dirender ulang tanpa jaringan. `local_findings.payload_json`
 * menyimpan temuan individual untuk Detail. Semua nilai dinamis di-bind
 * sebagai parameter, bukan disisipkan ke SQL.
 */

import type { ScanFinding, ScanResult } from '@/types/scan';

import type { LocalFindingRow, LocalScanRow, SqliteDatabase } from './schema';

function parsePayload<T>(payloadJson: string): T | null {
  try {
    return JSON.parse(payloadJson) as T;
  } catch {
    return null;
  }
}

async function withTransaction(db: SqliteDatabase, work: () => Promise<void>): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    await work();
    await db.execAsync('COMMIT');
  } catch (error) {
    try {
      await db.execAsync('ROLLBACK');
    } catch {
      // Rollback gagal tidak boleh menutupi error asli.
    }
    throw error;
  }
}

/**
 * Simpan hasil scan beserta temuan-temuannya. Operasi idempoten: menyimpan
 * `scanId` yang sama akan mengganti baris lama dan seluruh temuan lamanya.
 */
export async function saveScanResult(db: SqliteDatabase, result: ScanResult): Promise<void> {
  const repoFullName = `${result.repo.owner}/${result.repo.name}`;
  const payloadJson = JSON.stringify(result);

  await withTransaction(db, async () => {
    await db.runAsync(
      `insert into local_scans (
         scan_id, repo_full_name, repo_url, scanned_at, status, manifest_source,
         estimated, partial, persisted, total_packages, affected_packages,
         finding_count, payload_json
       ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(scan_id) do update set
         repo_full_name = excluded.repo_full_name,
         repo_url = excluded.repo_url,
         scanned_at = excluded.scanned_at,
         status = excluded.status,
         manifest_source = excluded.manifest_source,
         estimated = excluded.estimated,
         partial = excluded.partial,
         persisted = excluded.persisted,
         total_packages = excluded.total_packages,
         affected_packages = excluded.affected_packages,
         finding_count = excluded.finding_count,
         payload_json = excluded.payload_json`,
      [
        result.scanId,
        repoFullName,
        result.repo.url,
        result.scannedAt,
        result.status,
        result.manifest.source,
        result.manifest.estimated ? 1 : 0,
        result.partial ? 1 : 0,
        result.persisted ? 1 : 0,
        result.summary.totalPackages,
        result.summary.affectedPackages,
        result.summary.findingCount,
        payloadJson,
      ],
    );

    // Ganti seluruh temuan scan agar temuan lama yang sudah tidak ada hilang.
    await db.runAsync('delete from local_findings where scan_id = ?', [result.scanId]);
    for (const finding of result.findings) {
      await db.runAsync(
        `insert into local_findings (
           finding_id, scan_id, package_name, installed_version, severity,
           label, osv_id, payload_json
         ) values (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          finding.findingId,
          result.scanId,
          finding.package.name,
          finding.package.installedVersion,
          finding.severity.level,
          finding.priority.label,
          finding.osvId,
          JSON.stringify(finding),
        ],
      );
    }
  });
}

/** Daftar hasil scan terbaru lebih dulu; payload yang rusak dilewati. */
export async function listScanResults(db: SqliteDatabase): Promise<ScanResult[]> {
  const rows = await db.getAllAsync<Pick<LocalScanRow, 'payload_json'>>(
    'select payload_json from local_scans order by scanned_at desc, rowid desc',
  );

  const results: ScanResult[] = [];
  for (const row of rows) {
    const result = parsePayload<ScanResult>(row.payload_json);
    if (result) results.push(result);
  }
  return results;
}

/** Baca satu hasil scan lengkap; `null` bila tidak ada atau payload rusak. */
export async function getScanResult(
  db: SqliteDatabase,
  scanId: string,
): Promise<ScanResult | null> {
  const row = await db.getFirstAsync<Pick<LocalScanRow, 'payload_json'>>(
    'select payload_json from local_scans where scan_id = ?',
    [scanId],
  );
  if (!row) return null;
  return parsePayload<ScanResult>(row.payload_json);
}

/** Daftar temuan tersimpan untuk satu scan, urut sesuai payload awal. */
export async function listScanFindings(
  db: SqliteDatabase,
  scanId: string,
): Promise<ScanFinding[]> {
  const rows = await db.getAllAsync<Pick<LocalFindingRow, 'payload_json'>>(
    'select payload_json from local_findings where scan_id = ? order by rowid asc',
    [scanId],
  );

  const findings: ScanFinding[] = [];
  for (const row of rows) {
    const finding = parsePayload<ScanFinding>(row.payload_json);
    if (finding) findings.push(finding);
  }
  return findings;
}

/** Baca satu temuan; `null` bila tidak ada atau bukan milik scan tersebut. */
export async function getScanFinding(
  db: SqliteDatabase,
  scanId: string,
  findingId: string,
): Promise<ScanFinding | null> {
  const row = await db.getFirstAsync<Pick<LocalFindingRow, 'payload_json'>>(
    'select payload_json from local_findings where scan_id = ? and finding_id = ?',
    [scanId, findingId],
  );
  if (!row) return null;
  return parsePayload<ScanFinding>(row.payload_json);
}

/** Hapus satu scan dan seluruh temuannya. */
export async function deleteScanResult(db: SqliteDatabase, scanId: string): Promise<void> {
  await withTransaction(db, async () => {
    await db.runAsync('delete from local_findings where scan_id = ?', [scanId]);
    await db.runAsync('delete from local_scans where scan_id = ?', [scanId]);
  });
}
