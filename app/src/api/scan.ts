import Constants from 'expo-constants';

import { readSupabaseConfig, type SupabaseConfig } from '@/config/env';
import type {
  LockfileFormat,
  ManifestSource,
  PriorityLabel,
  ScanErrorCode,
  ScanFailure,
  ScanFinding,
  ScanResponse,
  ScanResult,
  ScanSourceStatus,
  ScanStatus,
  ScanWarning,
  SeverityLevel,
  SourceState,
} from '@/types/scan';

/** Batas waktu klien PRD §10.3; backend memakai batas keras 25 detik. */
export const SCAN_TIMEOUT_MS = 30_000;
export const SCAN_PATH = '/scan';

export type RequestScanOptions = {
  repoUrl: string;
  /** JWT anonim; diaktifkan pada T-W3-03. Tanpa token, hanya `apikey` yang dikirim. */
  accessToken?: string | null;
  clientVersion?: string;
  timeoutMs?: number;
  /** Disuntikkan pada unit test. */
  fetchImpl?: typeof fetch;
  /** Disuntikkan pada unit test; default dibaca dari `app/.env`. */
  config?: SupabaseConfig;
};

const DEFAULT_CLIENT_VERSION = Constants.expoConfig?.version ?? '1.0.0';

const STATUS_VALUES: ReadonlySet<string> = new Set<ScanStatus>(['COMPLETED', 'PARTIAL']);
const SOURCE_VALUES: ReadonlySet<string> = new Set<ManifestSource>(['LOCKFILE', 'PACKAGE_JSON']);
const LOCKFILE_VALUES: ReadonlySet<string> = new Set(['v2', 'v3']);
const SEVERITY_VALUES: ReadonlySet<string> = new Set<SeverityLevel>([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'UNKNOWN',
]);
const LABEL_VALUES: ReadonlySet<string> = new Set<PriorityLabel>([
  'FIX_NOW',
  'SCHEDULE',
  'MONITOR',
]);
const SOURCE_STATE_VALUES: ReadonlySet<string> = new Set<SourceState>([
  'OK',
  'CACHE',
  'PARTIAL',
  'STALE',
  'EMPTY',
  'FAILED',
]);

const USER_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_URL: 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repo.',
  UNAUTHENTICATED: 'Sesi belum siap. Periksa koneksi lalu coba lagi.',
  REPO_PRIVATE_OR_FORBIDDEN:
    'Repo ini privat atau tidak dapat diakses. PatchRadar hanya memindai repo publik.',
  REPO_NOT_FOUND: 'Repo tidak ditemukan. Periksa ejaan pemilik dan nama repo.',
  REPO_NOT_FOUND_OR_PRIVATE:
    'Repo tidak ditemukan atau bersifat privat. PatchRadar hanya bisa memindai repo publik.',
  NO_PACKAGE_JSON:
    'package.json tidak ditemukan di root repo. PatchRadar hanya memindai manifest di root.',
  MANIFEST_TOO_LARGE:
    'Repo melebihi batas ukuran sementara (5 MB atau 1.500 paket). Coba repo yang lebih kecil.',
  RATE_LIMITED: 'Terlalu banyak pemindaian. Coba lagi sebentar lagi.',
  UPSTREAM_UNAVAILABLE: 'Layanan kerentanan sedang sibuk. Coba lagi sebentar lagi.',
  SCAN_TIMEOUT: 'Pemindaian melebihi batas waktu. Coba lagi atau pindai repo yang lebih kecil.',
  INTERNAL: 'Terjadi kesalahan pada server. Coba lagi.',
  METHOD_NOT_ALLOWED: 'Metode permintaan tidak didukung.',
  NETWORK: 'Tidak ada koneksi. Hasil tersimpan tetap bisa dibuka dari Riwayat.',
  TIMEOUT: 'Pemindaian melebihi batas waktu. Coba lagi atau pindai repo yang lebih kecil.',
  INVALID_RESPONSE: 'Terjadi kesalahan saat membaca hasil. Coba lagi.',
  CONFIG: 'Konfigurasi aplikasi belum lengkap. Hubungi pengembang.',
  UNKNOWN: 'Terjadi kesalahan saat memindai. Coba lagi.',
};

const RETRYABLE: Readonly<Record<string, boolean>> = {
  INVALID_URL: false,
  UNAUTHENTICATED: false,
  REPO_PRIVATE_OR_FORBIDDEN: false,
  REPO_NOT_FOUND: false,
  REPO_NOT_FOUND_OR_PRIVATE: false,
  NO_PACKAGE_JSON: false,
  MANIFEST_TOO_LARGE: false,
  RATE_LIMITED: true,
  UPSTREAM_UNAVAILABLE: true,
  SCAN_TIMEOUT: true,
  INTERNAL: true,
  METHOD_NOT_ALLOWED: false,
  INVALID_RESPONSE: true,
  NETWORK: true,
  TIMEOUT: true,
  CONFIG: false,
  UNKNOWN: true,
};

/** Cadangan bila body error tidak memuat kode yang dikenali. */
const STATUS_CODES: Readonly<Record<number, string>> = {
  400: 'INVALID_URL',
  401: 'UNAUTHENTICATED',
  403: 'REPO_PRIVATE_OR_FORBIDDEN',
  404: 'REPO_NOT_FOUND_OR_PRIVATE',
  405: 'METHOD_NOT_ALLOWED',
  413: 'MANIFEST_TOO_LARGE',
  422: 'NO_PACKAGE_JSON',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  502: 'UPSTREAM_UNAVAILABLE',
  504: 'SCAN_TIMEOUT',
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parseSourceStatus(value: unknown): ScanSourceStatus | null {
  if (!isObject(value)) return null;
  const github = value.github;
  if (typeof github !== 'string' || !SOURCE_STATE_VALUES.has(github)) return null;

  const status: ScanSourceStatus = { github: github as SourceState };
  for (const key of ['osv', 'kev', 'epss'] as const) {
    const entry = value[key];
    if (entry === undefined) continue;
    if (typeof entry !== 'string' || !SOURCE_STATE_VALUES.has(entry)) return null;
    status[key] = entry as SourceState;
  }
  return status;
}

function parseWarning(value: unknown): ScanWarning | null {
  if (!isObject(value)) return null;
  const code = asString(value.code);
  const message = asText(value.message);
  if (code === null || message === null) return null;
  return { code, message };
}

function parseReferences(value: unknown): { label: string; url: string }[] | null {
  if (!Array.isArray(value)) return null;
  const references: { label: string; url: string }[] = [];
  for (const entry of value) {
    if (!isObject(entry)) return null;
    const label = asString(entry.label);
    const url = asString(entry.url);
    if (label === null || url === null) return null;
    references.push({ label, url });
  }
  return references;
}

function parseFinding(value: unknown): ScanFinding | null {
  if (!isObject(value)) return null;

  const pkg = value.package;
  const severity = value.severity;
  const exploitation = value.exploitation;
  const priority = value.priority;
  const fix = value.fix;

  if (
    !isObject(pkg) ||
    !isObject(severity) ||
    !isObject(exploitation) ||
    !isObject(priority) ||
    !isObject(fix)
  ) {
    return null;
  }

  const findingId = asString(value.findingId);
  const osvId = asString(value.osvId);
  const cveIds =
    Array.isArray(value.cveIds) && value.cveIds.every((id) => typeof id === 'string')
      ? (value.cveIds as string[])
      : null;
  const packageName = asString(pkg.name);
  const installedVersion = asString(pkg.installedVersion);
  const direct = asBoolean(pkg.direct);
  const devOnly = asBoolean(pkg.devOnly);
  const parentPackage = asNullableString(pkg.parentPackage);
  const level = severity.level;
  const cvss = asNullableNumber(severity.cvss);
  const kev = asBoolean(exploitation.kev);
  const epss = asNullableNumber(exploitation.epss);
  const epssPercentile = asNullableNumber(exploitation.epssPercentile);
  const epssAvailable = asBoolean(exploitation.epssAvailable);
  const label = priority.label;
  const score = asNumber(priority.score);
  const reason = asText(priority.reason);
  const safeVersion = asNullableString(fix.safeVersion);
  const command = asNullableString(fix.command);
  const suggestion = asNullableString(fix.suggestion);
  const summary = asText(value.summary);
  const references = parseReferences(value.references);

  if (
    findingId === null ||
    osvId === null ||
    cveIds === null ||
    packageName === null ||
    installedVersion === null ||
    direct === null ||
    devOnly === null ||
    parentPackage === undefined ||
    typeof level !== 'string' ||
    !SEVERITY_VALUES.has(level) ||
    cvss === undefined ||
    severity.source !== 'OSV' ||
    kev === null ||
    epss === undefined ||
    epssPercentile === undefined ||
    epssAvailable === null ||
    typeof label !== 'string' ||
    !LABEL_VALUES.has(label) ||
    score === null ||
    reason === null ||
    safeVersion === undefined ||
    command === undefined ||
    suggestion === undefined ||
    summary === null ||
    references === null
  ) {
    return null;
  }

  return {
    findingId,
    osvId,
    cveIds,
    package: { name: packageName, installedVersion, direct, devOnly, parentPackage },
    severity: { level: level as SeverityLevel, cvss, source: 'OSV' },
    exploitation: { kev, epss, epssPercentile, epssAvailable },
    priority: { label: label as PriorityLabel, score, reason },
    fix: { safeVersion, command, suggestion },
    summary,
    references,
  };
}

/** Validasi ketat respons 200; mengembalikan `null` bila ada field wajib yang rusak. */
export function parseScanResult(value: unknown): ScanResult | null {
  if (!isObject(value)) return null;

  const repo = value.repo;
  const manifest = value.manifest;
  const summary = value.summary;
  const sourceStatus = parseSourceStatus(value.sourceStatus);
  const timings = value.timings;

  if (!isObject(repo) || !isObject(manifest) || !isObject(summary) || !isObject(timings)) {
    return null;
  }
  if (sourceStatus === null) return null;

  const scanId = asString(value.scanId);
  const owner = asString(repo.owner);
  const name = asString(repo.name);
  const repoUrl = asString(repo.url);
  const defaultBranch = asString(repo.defaultBranch);
  const scannedAt = asString(value.scannedAt);
  const status = value.status;
  const source = manifest.source;
  const estimated = asBoolean(manifest.estimated);
  const lockfileFormat = manifest.lockfileFormat;
  const totalPackages = asNumber(summary.totalPackages);
  const affectedPackages = asNumber(summary.affectedPackages);
  const findingCount = asNumber(summary.findingCount);
  const partial = asBoolean(value.partial);
  const persisted = asBoolean(value.persisted);
  const githubMs = asNumber(timings.githubMs);
  const totalMs = asNumber(timings.totalMs);
  const osvMs = asNullableNumber(timings.osvMs);
  const enrichmentMs = asNullableNumber(timings.enrichmentMs);
  const requestId = asString(value.requestId);

  if (
    scanId === null ||
    owner === null ||
    name === null ||
    repoUrl === null ||
    defaultBranch === null ||
    scannedAt === null ||
    typeof status !== 'string' ||
    !STATUS_VALUES.has(status) ||
    typeof source !== 'string' ||
    !SOURCE_VALUES.has(source) ||
    estimated === null ||
    !(
      lockfileFormat === null ||
      (typeof lockfileFormat === 'string' && LOCKFILE_VALUES.has(lockfileFormat))
    ) ||
    totalPackages === null ||
    affectedPackages === null ||
    findingCount === null ||
    partial === null ||
    persisted === null ||
    githubMs === null ||
    totalMs === null ||
    osvMs === undefined ||
    enrichmentMs === undefined ||
    requestId === null ||
    !Array.isArray(value.findings) ||
    !Array.isArray(value.warnings)
  ) {
    return null;
  }

  const findings: ScanFinding[] = [];
  for (const entry of value.findings) {
    const finding = parseFinding(entry);
    if (finding === null) return null;
    findings.push(finding);
  }

  const warnings: ScanWarning[] = [];
  for (const entry of value.warnings) {
    const warning = parseWarning(entry);
    if (warning === null) return null;
    warnings.push(warning);
  }

  const result: ScanResult = {
    scanId,
    repo: { owner, name, url: repoUrl, defaultBranch },
    scannedAt,
    status: status as ScanStatus,
    manifest: {
      source: source as ManifestSource,
      lockfileFormat: lockfileFormat as LockfileFormat,
      estimated,
    },
    summary: { totalPackages, affectedPackages, findingCount },
    findings,
    partial,
    persisted,
    warnings,
    sourceStatus,
    timings: {
      githubMs,
      ...(osvMs !== null ? { osvMs } : {}),
      ...(enrichmentMs !== null ? { enrichmentMs } : {}),
      totalMs,
    },
    requestId,
  };
  return result;
}

function readRetryAfterSeconds(error: JsonObject, retryAfterHeader: string | null): number | null {
  const value = asNumber(error.retryAfter);
  if (value !== null && value > 0) return Math.ceil(value);

  if (retryAfterHeader !== null) {
    const parsed = Number.parseInt(retryAfterHeader, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function rateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return 'Terlalu banyak pemindaian. Coba lagi sebentar lagi.';
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Terlalu banyak pemindaian. Coba lagi dalam ${minutes} menit.`;
}

function requestIdSuffix(requestId: string | null): string {
  return requestId === null ? '' : ` Kode: ${requestId}.`;
}

export function mapServerError(
  status: number,
  body: unknown,
  headerRequestId: string | null = null,
  retryAfterHeader: string | null = null,
): ScanFailure {
  const error = isObject(body) && isObject(body.error) ? body.error : null;
  const code = error === null ? null : asString(error.code);
  const serverMessage = error === null ? null : asString(error.message);
  const bodyRequestId = error === null ? null : asString(error.requestId);
  const requestId = bodyRequestId ?? headerRequestId;
  const serverRetryable = error === null ? null : asBoolean(error.retryable);
  const retryAfterSeconds =
    error === null ? null : readRetryAfterSeconds(error, retryAfterHeader);

  const knownCode = code !== null && code in USER_MESSAGES ? code : null;
  const resolvedCode = (knownCode ?? STATUS_CODES[status] ?? 'UNKNOWN') as ScanErrorCode;

  let message: string;
  if (resolvedCode === 'RATE_LIMITED') {
    message = rateLimitMessage(retryAfterSeconds);
  } else if (resolvedCode in USER_MESSAGES) {
    message = USER_MESSAGES[resolvedCode] ?? USER_MESSAGES.UNKNOWN ?? '';
  } else {
    message = serverMessage ?? USER_MESSAGES.UNKNOWN ?? '';
  }

  if (
    resolvedCode === 'INTERNAL' ||
    resolvedCode === 'INVALID_RESPONSE' ||
    resolvedCode === 'UNKNOWN'
  ) {
    if (!message.includes('Kode:')) message += requestIdSuffix(requestId);
  }

  return {
    code: resolvedCode,
    message,
    retryable:
      serverRetryable ?? RETRYABLE[resolvedCode] ?? (status >= 500 || status === 429),
    requestId,
    retryAfterSeconds,
    status,
  };
}

function failure(
  code: ScanErrorCode,
  options: {
    message?: string;
    requestId?: string | null;
    retryAfterSeconds?: number | null;
    status?: number | null;
  } = {},
): ScanResponse {
  const message = options.message ?? USER_MESSAGES[code] ?? USER_MESSAGES.UNKNOWN ?? '';
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: RETRYABLE[code] ?? true,
      requestId: options.requestId ?? null,
      retryAfterSeconds: options.retryAfterSeconds ?? null,
      status: options.status ?? null,
    },
  };
}

function invalidResponse(requestId: string | null): ScanResponse {
  return failure('INVALID_RESPONSE', {
    message: `${USER_MESSAGES.INVALID_RESPONSE ?? ''}${requestIdSuffix(requestId)}`,
    requestId,
    status: 200,
  });
}

/**
 * Kirim satu permintaan pemindaian (FR-02).
 *
 * Tidak melakukan retry otomatis. `persisted=false` dan `partial=true` tetap
 * dianggap berhasil dan diteruskan apa adanya.
 */
export async function requestScan(options: RequestScanOptions): Promise<ScanResponse> {
  let config: SupabaseConfig;
  try {
    config = options.config ?? readSupabaseConfig();
  } catch {
    return failure('CONFIG');
  }

  const clientVersion = options.clientVersion ?? DEFAULT_CLIENT_VERSION;
  const timeoutMs = options.timeoutMs ?? SCAN_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  const headers: Record<string, string> = {
    apikey: config.anonKey,
    'Content-Type': 'application/json',
    'X-Client-Version': clientVersion,
  };
  const accessToken = options.accessToken?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(`${config.functionsUrl}${SCAN_PATH}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repoUrl: options.repoUrl, clientVersion }),
      signal: controller.signal,
    });

    const headerRequestId = response.headers.get('x-request-id');
    const text = await response.text();
    let body: unknown = null;
    if (text.trim().length > 0) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      return {
        ok: false,
        error: mapServerError(
          response.status,
          body,
          headerRequestId,
          response.headers.get('retry-after'),
        ),
      };
    }

    if (body === null) {
      return invalidResponse(headerRequestId);
    }

    const parsed = parseScanResult(body);
    if (parsed === null) {
      const bodyRequestId = isObject(body) ? asString(body.requestId) : null;
      return invalidResponse(bodyRequestId ?? headerRequestId);
    }

    return { ok: true, data: parsed };
  } catch (error) {
    if (timedOut) {
      return failure('TIMEOUT');
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return failure('TIMEOUT');
    }
    return failure('NETWORK');
  } finally {
    clearTimeout(timer);
  }
}
