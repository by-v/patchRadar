/**
 * Orkestrasi endpoint `scan` tahap 1: validasi → fetch GitHub → parse manifest.
 *
 * Semua dependensi eksternal disuntikkan agar unit test memakai fetch tiruan
 * tanpa jaringan. Log hanya berisi requestId, owner/repo, status HTTP, dan
 * durasi; token serta isi manifest tidak pernah dicatat.
 */

import { buildManifestResponse } from './contract.ts';
import { ScanError, jsonScanResponse, scanErrorResponse } from './errors.ts';
import {
  fetchRepoFile,
  fetchRepoMetadata,
  type FetchLike,
} from './github.ts';
import { parseManifest } from './lib/lockfile.ts';
import { validateRepoUrl } from './validate.ts';

export const MAX_REQUEST_BODY_BYTES = 16 * 1024;
export const MAX_PACKAGES = 2_000;

export interface ScanLogEntry {
  requestId: string;
  owner: string | null;
  repo: string | null;
  status: number;
  githubMs: number;
  totalMs: number;
}

export type ScanLogger = (entry: ScanLogEntry) => void;

export interface ScanHandlerDependencies {
  token?: string | null;
  fetchImpl?: FetchLike;
  logger?: ScanLogger;
  now?: () => number;
  randomUUID?: () => string;
  timeoutMs?: number;
  maxManifestBytes?: number;
}

function defaultLogger(entry: ScanLogEntry): void {
  console.log(JSON.stringify(entry));
}

function newRequestId(randomUUID: () => string): string {
  return `req_${randomUUID().replace(/-/g, '')}`;
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declared = request.headers.get('content-length');
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > MAX_REQUEST_BODY_BYTES) {
    throw new ScanError('INVALID_URL', { message: 'Permintaan terlalu besar.' });
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BODY_BYTES) {
    throw new ScanError('INVALID_URL', { message: 'Permintaan terlalu besar.' });
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new ScanError('INVALID_URL', {
      message: 'Body permintaan harus JSON dengan field repoUrl.',
      cause: error,
    });
  }
}

function manifestErrorToScanError(code: 'NO_PACKAGE_JSON' | 'INVALID_PACKAGE_JSON' | 'INVALID_MANIFEST_INPUT'): ScanError {
  if (code === 'NO_PACKAGE_JSON') return new ScanError('NO_PACKAGE_JSON');
  if (code === 'INVALID_PACKAGE_JSON') {
    return new ScanError('UPSTREAM_UNAVAILABLE', {
      message: 'package.json dari repo tidak dapat dibaca.',
    });
  }
  return new ScanError('INTERNAL');
}

/** Handler murni terhadap Request; aman dipakai unit test dengan fetch tiruan. */
export async function handleScanRequest(
  request: Request,
  dependencies: ScanHandlerDependencies = {},
): Promise<Response> {
  const now = dependencies.now ?? Date.now;
  const randomUUID = dependencies.randomUUID ?? (() => crypto.randomUUID());
  const logger = dependencies.logger ?? defaultLogger;
  const requestId = newRequestId(randomUUID);
  const started = now();

  let status = 200;
  let owner: string | null = null;
  let repo: string | null = null;
  let githubMs = 0;

  try {
    if (request.method !== 'POST') {
      throw new ScanError('METHOD_NOT_ALLOWED');
    }

    const body = await readJsonBody(request);
    const repoUrl =
      body && typeof body === 'object' && 'repoUrl' in body
        ? (body as { repoUrl?: unknown }).repoUrl
        : undefined;

    const validation = validateRepoUrl(repoUrl);
    if (!validation.ok) {
      throw new ScanError('INVALID_URL', { message: validation.message });
    }

    owner = validation.owner;
    repo = validation.repo;

    if (typeof dependencies.token !== 'string' || dependencies.token.length === 0) {
      throw new ScanError('UPSTREAM_UNAVAILABLE', {
        message: 'Token GitHub server belum dikonfigurasi.',
      });
    }

    const clientOptions = {
      token: dependencies.token,
      fetchImpl: dependencies.fetchImpl,
      timeoutMs: dependencies.timeoutMs,
      maxBytes: dependencies.maxManifestBytes,
    };

    const metadata = await fetchRepoMetadata(owner, repo, clientOptions);
    githubMs += metadata.durationMs;

    const packageJson = await fetchRepoFile(
      owner,
      repo,
      metadata.defaultBranch,
      'package.json',
      clientOptions,
    );
    if (packageJson === null) {
      throw new ScanError('NO_PACKAGE_JSON');
    }
    githubMs += packageJson.durationMs;

    const lockfile = await fetchRepoFile(
      owner,
      repo,
      metadata.defaultBranch,
      'package-lock.json',
      clientOptions,
    );
    if (lockfile !== null) githubMs += lockfile.durationMs;

    const parsed = parseManifest({
      packageJsonText: packageJson.text,
      lockfileText: lockfile?.text ?? null,
    });

    if ('error' in parsed) {
      throw manifestErrorToScanError(parsed.error.code);
    }

    if (parsed.totalPackages > MAX_PACKAGES) {
      throw new ScanError('MANIFEST_TOO_LARGE');
    }

    const totalMs = now() - started;
    const response = buildManifestResponse({
      scanId: randomUUID(),
      requestId,
      owner,
      repo,
      defaultBranch: metadata.defaultBranch,
      scannedAt: new Date(now()).toISOString(),
      parsed,
      githubMs,
      totalMs,
    });

    status = 200;
    return jsonScanResponse(response, 200, requestId);
  } catch (error) {
    const scanError = error instanceof ScanError ? error : new ScanError('INTERNAL', { cause: error });
    status = scanError.status;
    return scanErrorResponse(scanError, requestId);
  } finally {
    const totalMs = now() - started;
    try {
      logger({
        requestId,
        owner,
        repo,
        status,
        githubMs: Math.round(githubMs),
        totalMs: Math.round(totalMs),
      });
    } catch {
      // Kegagalan logger tidak boleh mengubah respons.
    }
  }
}
