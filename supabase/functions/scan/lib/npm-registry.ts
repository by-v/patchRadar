/**
 * Klien npm registry untuk resolver versi jalur fallback (FR-05).
 *
 * - Semua permintaan jaringan memakai timeout `AbortController`.
 * - Cache packument dan hasil resolusi disimpan per instance klien; satu
 *   klien dibuat per request scan sehingga cache bersifat per request.
 * - Tidak memakai API Node agar aman di Deno Edge Function.
 */

import { isNonRegistrySpec } from './package-json.ts';
import { maxSatisfying, parseRange, parseVersion } from './semver.ts';

export type RegistryErrorCode =
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP_ERROR'
  | 'INVALID_RESPONSE'
  | 'NON_REGISTRY_SPEC'
  | 'INVALID_RANGE'
  | 'NO_MATCHING_VERSION';

export interface RegistryError {
  code: RegistryErrorCode;
  message: string;
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;
}

export type RegistryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RegistryError };

export interface ResolvedVersion {
  name: string;
  version: string;
}

export interface Packument {
  versions: string[];
  distTags: Record<string, string>;
}

export interface NpmRegistryOptions {
  /** Basis URL registry, default `https://registry.npmjs.org`. */
  registryUrl?: string;
  /** Batas waktu satu permintaan, default 5.000 ms. */
  timeoutMs?: number;
  /** Implementasi fetch, dapat diganti di unit test. */
  fetchImpl?: typeof fetch;
}

export interface RegistryWarning {
  code: RegistryErrorCode | string;
  packageName: string;
  message: string;
  retryable: boolean;
}

export interface ResolveManyResult {
  resolved: Record<string, string>;
  warnings: RegistryWarning[];
  failed: RegistryWarning[];
  partial: boolean;
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const DEFAULT_TIMEOUT_MS = 5_000;
const ACCEPT_HEADER = 'application/vnd.npm.install-v1+json, application/json';

/** Nama paket scoped di-encode menjadi `@scope%2Fname` pada path URL. */
export function encodePackageName(name: string): string {
  return name.startsWith('@') ? name.replace('/', '%2F') : name;
}

function normalizeRegistryUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return undefined;
  const diff = date - Date.now();
  return diff > 0 ? diff : 0;
}

function extractPackument(value: unknown): Packument | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const versions = record.versions;
  if (!versions || typeof versions !== 'object' || Array.isArray(versions)) return null;

  const distTags: Record<string, string> = {};
  const rawTags = record['dist-tags'];
  if (rawTags && typeof rawTags === 'object' && !Array.isArray(rawTags)) {
    for (const [tag, version] of Object.entries(rawTags as Record<string, unknown>)) {
      if (typeof version === 'string') distTags[tag] = version;
    }
  }

  return { versions: Object.keys(versions), distTags };
}

function error(
  code: RegistryErrorCode,
  message: string,
  retryable: boolean,
  extra: { status?: number; retryAfterMs?: number } = {},
): RegistryError {
  return { code, message, retryable, ...extra };
}

export class NpmRegistryClient {
  private readonly registryUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly packumentCache = new Map<string, Promise<RegistryResult<Packument>>>();
  private readonly resolutionCache = new Map<string, Promise<RegistryResult<ResolvedVersion>>>();

  constructor(options: NpmRegistryOptions = {}) {
    this.registryUrl = normalizeRegistryUrl(options.registryUrl ?? DEFAULT_REGISTRY);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  /** Ambil packument (daftar versi + dist-tag) dengan cache per request. */
  getPackument(name: string): Promise<RegistryResult<Packument>> {
    const cached = this.packumentCache.get(name);
    if (cached) return cached;

    const pending = this.fetchPackument(name);
    this.packumentCache.set(name, pending);
    return pending;
  }

  /**
   * Resolusikan nama + range menjadi satu versi.
   *
   * Urutan: dist-tag -> range semver -> versi tertinggi yang memenuhi.
   * Spesifikasi non-registry dikembalikan sebagai `NON_REGISTRY_SPEC`, bukan
   * exception.
   */
  resolveVersion(name: string, spec: string): Promise<RegistryResult<ResolvedVersion>> {
    const trimmed = spec.trim();
    const cacheKey = `${name}\u0000${trimmed}`;
    const cached = this.resolutionCache.get(cacheKey);
    if (cached) return cached;

    const pending = this.resolveUncached(name, trimmed);
    this.resolutionCache.set(cacheKey, pending);
    return pending;
  }

  /**
   * Resolusikan banyak dependensi langsung dengan konkurensi terbatas.
   * Kegagalan registry dicatat di `warnings`/`failed` dan tidak menghentikan
   * paket lain. Spesifikasi non-registry hanya menjadi warning.
   */
  async resolveMany(
    specs: Readonly<Record<string, string>>,
    concurrency = 6,
  ): Promise<ResolveManyResult> {
    const entries = Object.entries(specs);
    const results = new Array<RegistryWarning | { name: string; version: string } | null>(entries.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (cursor < entries.length) {
        const index = cursor;
        cursor += 1;
        const entry = entries[index];
        if (!entry) continue;
        const [name, spec] = entry;

        if (isNonRegistrySpec(spec)) {
          results[index] = {
            code: 'NON_REGISTRY_SPEC',
            packageName: name,
            message: `Spesifikasi non-registry untuk ${name} dilewati: ${spec}`,
            retryable: false,
          };
          continue;
        }

        const resolved = await this.resolveVersion(name, spec);
        if (resolved.ok) {
          results[index] = { name, version: resolved.value.version };
        } else {
          results[index] = {
            code: resolved.error.code,
            packageName: name,
            message: resolved.error.message,
            retryable: resolved.error.retryable,
          };
        }
      }
    };

    const workers = Math.max(1, Math.min(concurrency, entries.length));
    await Promise.all(Array.from({ length: workers }, worker));

    const resolvedVersions: Record<string, string> = {};
    const warnings: RegistryWarning[] = [];
    const failed: RegistryWarning[] = [];

    for (const result of results) {
      if (!result) continue;
      if ('version' in result) {
        resolvedVersions[result.name] = result.version;
        continue;
      }
      warnings.push(result);
      if (result.code !== 'NON_REGISTRY_SPEC') failed.push(result);
    }

    return {
      resolved: resolvedVersions,
      warnings,
      failed,
      partial: failed.length > 0,
    };
  }

  private async resolveUncached(name: string, spec: string): Promise<RegistryResult<ResolvedVersion>> {
    if (isNonRegistrySpec(spec)) {
      return {
        ok: false,
        error: error(
          'NON_REGISTRY_SPEC',
          `Spesifikasi non-registry untuk ${name} dilewati: ${spec}`,
          false,
        ),
      };
    }

    // Dist-tag (`latest`, `next`, ...) bukan range semver, jadi pengecekan
    // range ditunda sampai packument diketahui. String yang jelas bukan range
    // maupun bentuk dist-tag ditolak tanpa permintaan jaringan.
    const mayBeDistTag = /^[A-Za-z][A-Za-z0-9._-]*$/.test(spec);
    if (!mayBeDistTag && !parseRange(spec)) {
      return {
        ok: false,
        error: error('INVALID_RANGE', `Range ${name}@${spec} tidak valid.`, false),
      };
    }

    const packument = await this.getPackument(name);
    if (!packument.ok) return packument;

    const tag = packument.value.distTags[spec];
    if (tag !== undefined) {
      if (!parseVersion(tag)) {
        return {
          ok: false,
          error: error(
            'INVALID_RESPONSE',
            `Dist-tag ${spec} untuk ${name} berisi versi tidak valid.`,
            false,
          ),
        };
      }
      return { ok: true, value: { name, version: tag } };
    }

    if (!parseRange(spec)) {
      return {
        ok: false,
        error: error('INVALID_RANGE', `Range ${name}@${spec} tidak valid.`, false),
      };
    }

    const best = maxSatisfying(packument.value.versions, spec);
    if (!best) {
      return {
        ok: false,
        error: error(
          'NO_MATCHING_VERSION',
          `Tidak ada versi ${name} yang memenuhi range ${spec}.`,
          false,
        ),
      };
    }

    return { ok: true, value: { name, version: best } };
  }

  private async fetchPackument(name: string): Promise<RegistryResult<Packument>> {
    const url = `${this.registryUrl}/${encodePackageName(name)}`;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { accept: ACCEPT_HEADER },
      });
    } catch (caught) {
      if (timedOut || isAbortError(caught)) {
        return {
          ok: false,
          error: error('TIMEOUT', `Permintaan registry untuk ${name} melewati batas waktu.`, true),
        };
      }
      return {
        ok: false,
        error: error('NETWORK', `Gagal menghubungi registry untuk ${name}.`, true),
      };
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      if (response.status === 404) {
        return {
          ok: false,
          error: error('NOT_FOUND', `Paket ${name} tidak ditemukan di registry.`, false, {
            status: 404,
          }),
        };
      }
      if (response.status === 429) {
        const delay = retryAfterMs(response);
        return {
          ok: false,
          error: error('RATE_LIMITED', `Registry membatasi permintaan untuk ${name}.`, true, {
            status: 429,
            ...(delay === undefined ? {} : { retryAfterMs: delay }),
          }),
        };
      }
      return {
        ok: false,
        error: error(
          'HTTP_ERROR',
          `Registry mengembalikan HTTP ${response.status} untuk ${name}.`,
          response.status >= 500,
          { status: response.status },
        ),
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        error: error('INVALID_RESPONSE', `Respons registry untuk ${name} bukan JSON.`, false),
      };
    }

    const packument = extractPackument(payload);
    if (!packument) {
      return {
        ok: false,
        error: error(
          'INVALID_RESPONSE',
          `Respons registry untuk ${name} tidak memuat daftar versi.`,
          false,
        ),
      };
    }

    return { ok: true, value: packument };
  }
}

export function createNpmRegistryClient(options: NpmRegistryOptions = {}): NpmRegistryClient {
  return new NpmRegistryClient(options);
}
