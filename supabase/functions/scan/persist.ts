/**
 * Penyimpanan cloud best-effort (FR-22, FR-23).
 *
 * Scan yang sudah berhasil dihitung tidak boleh gagal hanya karena penyimpanan
 * cloud bermasalah. Kegagalan apa pun ditangkap, `persisted` tetap `false`, dan
 * warning `CLOUD_PERSIST_FAILED` ditambahkan tanpa mengubah label/hasil.
 * Tidak ada retry dan tidak ada sinkronisasi ulang dari klien (MVP).
 */

import { ENGINE_VERSION } from './lib/priority-config.ts';
import type { ScanSuccessResponse } from './response.ts';
import type { FindingRecord, ScanRecord, ScanStore } from './store.ts';

export const CLOUD_PERSIST_WARNING = {
  code: 'CLOUD_PERSIST_FAILED',
  message: 'Riwayat cloud gagal disimpan; hasil tetap tersedia di perangkat.',
} as const;

export function buildScanRecord(response: ScanSuccessResponse, userId: string): ScanRecord {
  return {
    id: response.scanId,
    userId,
    repoOwner: response.repo.owner,
    repoName: response.repo.name,
    repoUrl: response.repo.url,
    status: response.status,
    manifestSource: response.manifest.source,
    lockfileFormat: response.manifest.lockfileFormat,
    estimated: response.manifest.estimated,
    totalPackages: response.summary.totalPackages,
    affectedPackages: response.summary.affectedPackages,
    findingCount: response.summary.findingCount,
    partial: response.partial,
    warnings: response.warnings,
    sourceStatus: response.sourceStatus,
    engineVersion: ENGINE_VERSION,
    durationMs: response.timings.totalMs,
    createdAt: response.scannedAt,
  };
}

export function buildFindingRecords(response: ScanSuccessResponse): FindingRecord[] {
  return response.findings.map((finding) => ({
    id: finding.findingId,
    scanId: response.scanId,
    osvId: finding.osvId,
    cveIds: [...finding.cveIds],
    packageName: finding.package.name,
    installedVersion: finding.package.installedVersion,
    direct: finding.package.direct,
    devOnly: finding.package.devOnly,
    parentPackage: finding.package.parentPackage,
    severity: finding.severity.level,
    cvssScore: finding.severity.cvss,
    epss: finding.exploitation.epss,
    epssPercentile: finding.exploitation.epssPercentile,
    kev: finding.exploitation.kev,
    label: finding.priority.label,
    score: finding.priority.score,
    reason: finding.priority.reason,
    fixVersion: finding.fix.safeVersion,
    fixCommand: finding.fix.command,
    summary: finding.summary,
    references: finding.references,
  }));
}

function appendCloudWarning(response: ScanSuccessResponse): void {
  if (response.warnings.some((warning) => warning.code === CLOUD_PERSIST_WARNING.code)) return;
  response.warnings.push({ ...CLOUD_PERSIST_WARNING });
}

/** Tandai hasil tetap tersedia tetapi riwayat cloud tidak tersimpan. */
export function markCloudPersistFailed(response: ScanSuccessResponse): void {
  response.persisted = false;
  appendCloudWarning(response);
}

/**
 * Simpan hasil scan; selalu mengembalikan apakah penyimpanan berhasil.
 * Tidak pernah melempar exception.
 */
export async function persistScanResult(
  response: ScanSuccessResponse,
  userId: string,
  store: ScanStore,
): Promise<boolean> {
  response.persisted = false;
  try {
    await store.save(buildScanRecord(response, userId), buildFindingRecords(response));
    response.persisted = true;
    return true;
  } catch {
    appendCloudWarning(response);
    return false;
  }
}
