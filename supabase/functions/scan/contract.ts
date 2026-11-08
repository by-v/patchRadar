/**
 * Bentuk respons `scan` tahap manifest-only (PRD §9.2).
 *
 * Tahap ini belum memanggil OSV/KEV/EPSS dan belum menyimpan cloud, sehingga
 * `findings` kosong, `sourceStatus` hanya memuat GitHub, dan `persisted=false`.
 * `affectedPackages`/`findingCount` bernilai 0 sampai pengayaan ditambahkan.
 */

import type { ParseSuccess } from './lib/lockfile.ts';
import type { ParseWarning } from './lib/dedupe.ts';

export interface ScanRepository {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
}

export interface ScanManifestSummary {
  source: 'LOCKFILE' | 'PACKAGE_JSON';
  lockfileFormat: 'v2' | 'v3' | null;
  estimated: boolean;
}

export interface ScanSuccessResponse {
  scanId: string;
  repo: ScanRepository;
  scannedAt: string;
  status: 'COMPLETED';
  manifest: ScanManifestSummary;
  summary: {
    totalPackages: number;
    affectedPackages: number;
    findingCount: number;
  };
  findings: [];
  partial: false;
  persisted: false;
  warnings: ParseWarning[];
  sourceStatus: {
    github: 'OK';
  };
  timings: {
    githubMs: number;
    totalMs: number;
  };
  requestId: string;
}

function lockfileFormat(version: number | null): 'v2' | 'v3' | null {
  if (version === 2) return 'v2';
  if (version === 3) return 'v3';
  return null;
}

export interface BuildManifestResponseInput {
  scanId: string;
  requestId: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  scannedAt: string;
  parsed: ParseSuccess;
  githubMs: number;
  totalMs: number;
}

export function buildManifestResponse(input: BuildManifestResponseInput): ScanSuccessResponse {
  return {
    scanId: input.scanId,
    repo: {
      owner: input.owner,
      name: input.repo,
      url: `https://github.com/${input.owner}/${input.repo}`,
      defaultBranch: input.defaultBranch,
    },
    scannedAt: input.scannedAt,
    status: 'COMPLETED',
    manifest: {
      source: input.parsed.source,
      lockfileFormat: lockfileFormat(input.parsed.lockfileVersion),
      estimated: input.parsed.estimated,
    },
    summary: {
      totalPackages: input.parsed.totalPackages,
      affectedPackages: 0,
      findingCount: 0,
    },
    findings: [],
    partial: false,
    persisted: false,
    warnings: input.parsed.warnings,
    sourceStatus: {
      github: 'OK',
    },
    timings: {
      githubMs: Math.round(input.githubMs),
      totalMs: Math.round(input.totalMs),
    },
    requestId: input.requestId,
  };
}
