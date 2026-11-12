/**
 * Tipe kontrak endpoint `scan` (PRD §9.2–§9.4).
 *
 * Bentuk ini mengikuti respons backend yang sebenarnya. Field pengayaan
 * (`osv`, `kev`, `epss`) bersifat opsional karena tahap manifest-only hanya
 * mengirim `github` pada `sourceStatus` dan `githubMs`/`totalMs` pada `timings`.
 */

export type ScanStatus = 'COMPLETED' | 'PARTIAL';
export type ManifestSource = 'LOCKFILE' | 'PACKAGE_JSON';
export type LockfileFormat = 'v2' | 'v3' | null;
export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type PriorityLabel = 'FIX_NOW' | 'SCHEDULE' | 'MONITOR';
export type SourceState = 'OK' | 'CACHE' | 'PARTIAL' | 'STALE' | 'EMPTY' | 'FAILED';

export type ScanWarning = {
  code: string;
  message: string;
};

export type ScanRepository = {
  owner: string;
  name: string;
  url: string;
  defaultBranch: string;
};

export type ScanManifestSummary = {
  source: ManifestSource;
  lockfileFormat: LockfileFormat;
  estimated: boolean;
};

export type ScanSummary = {
  totalPackages: number;
  affectedPackages: number;
  findingCount: number;
};

export type ScanFinding = {
  findingId: string;
  osvId: string;
  cveIds: string[];
  package: {
    name: string;
    installedVersion: string;
    direct: boolean;
    devOnly: boolean;
    parentPackage: string | null;
  };
  severity: {
    level: SeverityLevel;
    cvss: number | null;
    source: 'OSV';
  };
  exploitation: {
    kev: boolean;
    epss: number | null;
    epssPercentile: number | null;
    epssAvailable: boolean;
  };
  priority: {
    label: PriorityLabel;
    score: number;
    reason: string;
  };
  fix: {
    safeVersion: string | null;
    command: string | null;
    suggestion: string | null;
  };
  summary: string;
  references: { label: string; url: string }[];
};

export type ScanSourceStatus = {
  github: SourceState;
  osv?: SourceState;
  kev?: SourceState;
  epss?: SourceState;
};

export type ScanTimings = {
  githubMs: number;
  osvMs?: number;
  enrichmentMs?: number;
  totalMs: number;
};

/** Respons sukses/parsial 200 yang sudah divalidasi. */
export type ScanResult = {
  scanId: string;
  repo: ScanRepository;
  scannedAt: string;
  status: ScanStatus;
  manifest: ScanManifestSummary;
  summary: ScanSummary;
  findings: ScanFinding[];
  /** `true` bila ada sumber data gagal/tidak lengkap; bukan kegagalan scan. */
  partial: boolean;
  /** `false` bila penyimpanan cloud gagal; hasil scan tetap sah. */
  persisted: boolean;
  warnings: ScanWarning[];
  sourceStatus: ScanSourceStatus;
  timings: ScanTimings;
  requestId: string;
};

export type ScanErrorCode =
  | 'INVALID_URL'
  | 'UNAUTHENTICATED'
  | 'REPO_PRIVATE_OR_FORBIDDEN'
  | 'REPO_NOT_FOUND'
  | 'REPO_NOT_FOUND_OR_PRIVATE'
  | 'NO_PACKAGE_JSON'
  | 'MANIFEST_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'SCAN_TIMEOUT'
  | 'INTERNAL'
  | 'METHOD_NOT_ALLOWED'
  | 'INVALID_RESPONSE'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'CONFIG'
  | 'UNKNOWN';

/** Kegagalan klien; `message` sudah berupa teks siap tampil. */
export type ScanFailure = {
  code: ScanErrorCode;
  message: string;
  retryable: boolean;
  requestId: string | null;
  retryAfterSeconds: number | null;
  status: number | null;
};

export type ScanResponse =
  | { ok: true; data: ScanResult }
  | { ok: false; error: ScanFailure };
