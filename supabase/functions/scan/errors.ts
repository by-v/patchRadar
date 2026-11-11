/**
 * Error terstandar endpoint `scan` (PRD §9.4/§12).
 *
 * Tidak pernah memuat token atau isi manifest. `requestId` selalu disertakan
 * pada body error dan header `X-Request-Id`.
 */

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
  | 'METHOD_NOT_ALLOWED';

const DEFAULT_STATUS: Readonly<Record<ScanErrorCode, number>> = {
  INVALID_URL: 400,
  UNAUTHENTICATED: 401,
  REPO_PRIVATE_OR_FORBIDDEN: 403,
  REPO_NOT_FOUND: 404,
  REPO_NOT_FOUND_OR_PRIVATE: 404,
  NO_PACKAGE_JSON: 422,
  MANIFEST_TOO_LARGE: 413,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  SCAN_TIMEOUT: 504,
  INTERNAL: 500,
  METHOD_NOT_ALLOWED: 405,
};

const DEFAULT_RETRYABLE: Readonly<Record<ScanErrorCode, boolean>> = {
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
};

const DEFAULT_MESSAGE: Readonly<Record<ScanErrorCode, string>> = {
  INVALID_URL: 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repo.',
  UNAUTHENTICATED: 'Sesi tidak valid. Silakan coba lagi.',
  REPO_PRIVATE_OR_FORBIDDEN: 'Repo ini privat atau tidak dapat diakses. PatchRadar hanya memindai repo publik.',
  REPO_NOT_FOUND: 'Repo tidak ditemukan. Periksa ejaan pemilik dan nama repo.',
  REPO_NOT_FOUND_OR_PRIVATE:
    'Repo tidak ditemukan atau bersifat privat. PatchRadar hanya bisa memindai repo publik.',
  NO_PACKAGE_JSON: 'package.json tidak ditemukan di root repo. PatchRadar hanya memindai manifest di root.',
  MANIFEST_TOO_LARGE:
    'Repo melebihi batas ukuran sementara (5 MB atau 1.500 paket). Coba repo yang lebih kecil.',
  RATE_LIMITED: 'Batas permintaan tercapai. Coba lagi sebentar lagi.',
  UPSTREAM_UNAVAILABLE: 'Layanan upstream sedang bermasalah. Coba lagi sebentar lagi.',
  SCAN_TIMEOUT: 'Pemindaian melebihi batas waktu. Coba lagi atau pindai repo yang lebih kecil.',
  INTERNAL: 'Terjadi kesalahan internal. Coba lagi dengan kode permintaan yang tertera.',
  METHOD_NOT_ALLOWED: 'Metode permintaan tidak didukung.',
};

export class ScanError extends Error {
  readonly code: ScanErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfter: number | null;

  constructor(
    code: ScanErrorCode,
    options: { message?: string; retryAfter?: number | null; cause?: unknown } = {},
  ) {
    super(options.message ?? DEFAULT_MESSAGE[code]);
    this.name = 'ScanError';
    this.code = code;
    this.status = DEFAULT_STATUS[code];
    this.retryable = DEFAULT_RETRYABLE[code];
    this.retryAfter = options.retryAfter ?? null;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export interface ScanErrorBody {
  error: {
    code: ScanErrorCode;
    message: string;
    retryable: boolean;
    requestId: string;
    retryAfter?: number;
  };
}

function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': requestId,
      ...extraHeaders,
    },
  });
}

/** Ubah error apa pun menjadi respons JSON sesuai kontrak tanpa membocorkan detail. */
export function scanErrorResponse(error: unknown, requestId: string): Response {
  const scanError =
    error instanceof ScanError
      ? error
      : new ScanError('INTERNAL', {
          message: DEFAULT_MESSAGE.INTERNAL,
          cause: error,
        });

  const body: ScanErrorBody = {
    error: {
      code: scanError.code,
      message: scanError.message,
      retryable: scanError.retryable,
      requestId,
    },
  };

  if (scanError.code === 'RATE_LIMITED' && scanError.retryAfter !== null) {
    body.error.retryAfter = scanError.retryAfter;
  }

  const headers: Record<string, string> = {};
  if (scanError.code === 'RATE_LIMITED' && scanError.retryAfter !== null) {
    headers['retry-after'] = String(scanError.retryAfter);
  }

  return jsonResponse(body, scanError.status, requestId, headers);
}

/** Respons sukses/JSON umum dengan header requestId. */
export function jsonScanResponse(body: unknown, status: number, requestId: string): Response {
  return jsonResponse(body, status, requestId);
}
