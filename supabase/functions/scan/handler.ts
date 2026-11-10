/**
 * Orkestrasi penuh endpoint `scan`.
 *
 * Pipeline: manifest → resolusi registry (bila `estimated`) → OSV → KEV →
 * EPSS → klasifikasi/severity → label → respons final.
 *
 * Semua dependensi eksternal disuntikkan agar unit test memakai fetch/store
 * tiruan tanpa jaringan. Log hanya berisi requestId, owner/repo, status HTTP,
 * status sumber, dan durasi; token serta isi manifest tidak pernah dicatat.
 */

import { ScanError, scanErrorResponse } from './errors.ts';
import {
  fetchRepoFile,
  fetchRepoMetadata,
  type FetchLike,
} from './github.ts';
import { parseManifest, type ParseSuccess } from './lib/lockfile.ts';
import { parsePackageJson } from './lib/package-json.ts';
import { NpmRegistryClient, type ResolveManyResult } from './lib/npm-registry.ts';
import {
  createStageTimings,
  timed,
  totalSyncMs,
  type StageTimings,
} from './lib/timing.ts';
import { validateRepoUrl } from './validate.ts';
import { enrichWithOsv } from './osv.ts';
import { loadKevCatalog } from './kev.ts';
import { matchKevWithTiming } from './kev-match.ts';
import { assembleBaseFindings } from './findings.ts';
import { fetchEpssScores } from './epss.ts';
import { buildScanResponse, type ScanSuccessResponse, type SourceState } from './response.ts';
import type { OsvCacheStore, KevStore } from './store.ts';

export const MAX_REQUEST_BODY_BYTES = 16 * 1024;
export const MAX_PACKAGES = 2_000;

export interface ScanLogEntry {
  requestId: string;
  owner: string | null;
  repo: string | null;
  status: number;
  githubMs: number;
  parseMs: number;
  registryMs: number;
  osvMs: number;
  kevMs: number;
  epssMs: number;
  findingsMs: number;
  labelMs: number;
  syncMs: number;
  totalMs: number;
  sourceStatus: {
    osv: SourceState | null;
    kev: SourceState | null;
    epss: SourceState | null;
  };
  stages: Array<{ name: string; async: boolean; ms: number }>;
}

export type ScanLogger = (entry: ScanLogEntry) => void;

/** Antarmuka minimal resolver registry agar unit test mudah menyuntik tiruan. */
export interface RegistryResolver {
  resolveMany(
    specs: Readonly<Record<string, string>>,
    concurrency?: number,
  ): Promise<ResolveManyResult>;
}

export interface ScanHandlerDependencies {
  token?: string | null;
  /** Fetch GitHub (metadata + manifest). */
  fetchImpl?: FetchLike;
  /** Fetch khusus tiap sumber; bila kosong memakai `fetchImpl` utama. */
  osvFetchImpl?: FetchLike;
  kevFetchImpl?: FetchLike;
  epssFetchImpl?: FetchLike;
  registryFetchImpl?: FetchLike;
  osvStore?: OsvCacheStore;
  kevStore?: KevStore;
  registry?: RegistryResolver;
  logger?: ScanLogger;
  now?: () => number;
  randomUUID?: () => string;
  timeoutMs?: number;
  maxManifestBytes?: number;
  osvChunkSize?: number;
  /** Tidur antar-retry; unit test mengganti dengan no-op. */
  sleep?: (ms: number) => Promise<void>;
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

function directSpecs(packageJsonText: string): Record<string, string> {
  const parsed = parsePackageJson(packageJsonText);
  if (!parsed.ok) return {};

  const specs: Record<string, string> = {};
  for (const block of [parsed.packageJson.devDependencies, parsed.packageJson.dependencies]) {
    if (!block) continue;
    for (const [name, spec] of Object.entries(block)) {
      if (typeof spec === 'string') specs[name] = spec;
    }
  }
  return specs;
}

function sumByPrefix(timings: StageTimings, prefixes: readonly string[]): number {
  let total = 0;
  for (const [name, value] of Object.entries(timings.sync)) {
    if (prefixes.some((prefix) => name.startsWith(prefix))) total += value;
  }
  for (const [name, value] of Object.entries(timings.async)) {
    if (prefixes.some((prefix) => name.startsWith(prefix))) total += value;
  }
  return Math.round(total);
}

async function resolveEstimatedManifest(
  parsed: ParseSuccess,
  packageJsonText: string,
  dependencies: ScanHandlerDependencies,
  timings: StageTimings,
  timeoutMs: number | undefined,
): Promise<ParseSuccess> {
  if (!parsed.estimated) return parsed;

  const specs = directSpecs(packageJsonText);
  if (Object.keys(specs).length === 0) return parsed;

  const registry =
    dependencies.registry ??
    new NpmRegistryClient({
      fetchImpl: (dependencies.registryFetchImpl ?? dependencies.fetchImpl) as typeof fetch | undefined,
      timeoutMs,
    });
  const resolved = await timed(timings, 'registry.resolve', () => registry.resolveMany(specs));

  const reparsed = await timed(timings, 'manifest.parse.resolved', () =>
    parseManifest(
      { packageJsonText, lockfileText: null },
      { resolvedVersions: resolved.resolved },
    ),
  );

  if ('error' in reparsed) return parsed;

  // Pertahankan alasan fallback asli (lockfile rusak/v1/hilang), lalu tambahkan
  // warning yang hanya muncul setelah resolusi versi.
  reparsed.warnings = [
    ...parsed.warnings,
    ...reparsed.warnings.filter((warning) => warning.code !== 'LOCKFILE_MISSING'),
  ];

  // Kegagalan registry bukan kegagalan scan: versi jatuh ke batas bawah range
  // dan hasil tetap `estimated=true` dengan warning publik.
  if (resolved.failed.length > 0) {
    const failedNames = resolved.failed.map((warning) => warning.packageName).sort();
    reparsed.warnings.push({
      code: 'REGISTRY_PARTIAL',
      message: `Versi ${failedNames.slice(0, 5).join(', ')}${
        failedNames.length > 5 ? `, dan ${failedNames.length - 5} lainnya` : ''
      } memakai batas bawah range karena registry gagal dihubungi.`,
    });
  }

  return reparsed;
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
  const timings = createStageTimings();

  let status = 200;
  let owner: string | null = null;
  let repo: string | null = null;
  let githubMs = 0;
  let response: ScanSuccessResponse | null = null;

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

    const metadata = await timed(timings, 'github.metadata', () =>
      fetchRepoMetadata(owner as string, repo as string, clientOptions),
    );
    githubMs += metadata.durationMs;

    const packageJson = await timed(timings, 'github.packageJson', () =>
      fetchRepoFile(owner as string, repo as string, metadata.defaultBranch, 'package.json', clientOptions),
    );
    if (packageJson === null) {
      throw new ScanError('NO_PACKAGE_JSON');
    }
    githubMs += packageJson.durationMs;

    const lockfile = await timed(timings, 'github.lockfile', () =>
      fetchRepoFile(owner as string, repo as string, metadata.defaultBranch, 'package-lock.json', clientOptions),
    );
    if (lockfile !== null) githubMs += lockfile.durationMs;

    const initial = await timed(timings, 'manifest.parse', () =>
      parseManifest({
        packageJsonText: packageJson.text,
        lockfileText: lockfile?.text ?? null,
      }),
    );
    if ('error' in initial) throw manifestErrorToScanError(initial.error.code);
    if (initial.totalPackages > MAX_PACKAGES) throw new ScanError('MANIFEST_TOO_LARGE');

    const parsed = await resolveEstimatedManifest(
      initial,
      packageJson.text,
      dependencies,
      timings,
      dependencies.timeoutMs,
    );
    if (parsed.totalPackages > MAX_PACKAGES) throw new ScanError('MANIFEST_TOO_LARGE');

    const enrichment = await enrichWithOsv(
      parsed.packages.map((entry) => ({
        name: entry.name,
        version: entry.version,
        direct: entry.direct,
        devOnly: entry.devOnly,
        parentPackage: entry.parentPackage,
      })),
      {
        store: dependencies.osvStore,
        fetchImpl: dependencies.osvFetchImpl ?? dependencies.fetchImpl,
        now,
        chunkSize: dependencies.osvChunkSize,
        timeoutMs: dependencies.timeoutMs,
        sleep: dependencies.sleep,
        timings,
      },
    );

    const kev = await loadKevCatalog({
      store: dependencies.kevStore,
      fetchImpl: dependencies.kevFetchImpl ?? dependencies.fetchImpl,
      now,
      timeoutMs: dependencies.timeoutMs,
      sleep: dependencies.sleep,
      timings,
    });

    const base = await assembleBaseFindings({
      packages: parsed.packages,
      enrichment,
      timings,
    });

    const matched = await matchKevWithTiming(base.findings, kev.entries, timings);

    const cveIds = [
      ...new Set(matched.findings.flatMap((finding) => finding.cveIds.map((cve) => cve.toUpperCase()))),
    ].sort();
    const epss = await fetchEpssScores(cveIds, {
      fetchImpl: dependencies.epssFetchImpl ?? dependencies.fetchImpl,
      sleep: dependencies.sleep,
      timings,
    });

    const totalBeforeBuild = now() - started;
    response = await timed(timings, 'response.build', () =>
      buildScanResponse({
        scanId: randomUUID(),
        requestId,
        owner: owner as string,
        repo: repo as string,
        defaultBranch: metadata.defaultBranch,
        scannedAt: new Date(now()).toISOString(),
        parsed,
        githubMs,
        totalMs: totalBeforeBuild,
        osv: enrichment,
        kev,
        epss,
        findings: matched.findings,
        timings,
        newFindingId: randomUUID,
      }),
    );

    response.timings.totalMs = Math.round(now() - started);
    const serialized = await timed(timings, 'response.serialize', () => JSON.stringify(response));

    status = 200;
    return new Response(serialized, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-request-id': requestId,
      },
    });
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
        parseMs: sumByPrefix(timings, ['manifest.parse']),
        registryMs: sumByPrefix(timings, ['registry.']),
        osvMs: sumByPrefix(timings, ['osv.']),
        kevMs: sumByPrefix(timings, ['kev.']),
        epssMs: sumByPrefix(timings, ['epss.']),
        findingsMs: sumByPrefix(timings, ['findings.']),
        labelMs: sumByPrefix(timings, ['response.build']),
        syncMs: Math.round(totalSyncMs(timings)),
        totalMs: Math.round(totalMs),
        sourceStatus: {
          osv: response?.sourceStatus.osv ?? null,
          kev: response?.sourceStatus.kev ?? null,
          epss: response?.sourceStatus.epss ?? null,
        },
        stages: timings.stages,
      });
    } catch {
      // Kegagalan logger tidak boleh mengubah respons.
    }
  }
}
