/**
 * Klien GitHub untuk `scan` tahap 1.
 *
 * - Hanya boleh memanggil `api.github.com` dan `raw.githubusercontent.com`.
 * - Redirect 301 diikuti maksimal satu hop hanya di `api.github.com`; redirect
 *   berantai, host lain, alamat privat/loopback, skema turun, userinfo, atau
 *   port non-standar ditolak (PRD §12 baris 11, T-W3-07b).
 * - Setiap fetch memakai AbortController dan batas ukuran body.
 * - Token hanya dikirim ke api.github.com; tidak pernah dicatat/dikembalikan.
 *
 * Fungsi menerima `fetchImpl` agar unit test memakai fetch tiruan tanpa
 * jaringan, dan tetap aman dijalankan pada Deno.
 */

import { ScanError } from './errors.ts';

export const ALLOWED_GITHUB_HOSTS: ReadonlySet<string> = new Set([
  'api.github.com',
  'raw.githubusercontent.com',
]);

export const MAX_MANIFEST_BYTES = 5 * 1024 * 1024;
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GithubClientOptions {
  token?: string | null;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface FetchedText {
  text: string;
  durationMs: number;
}

/** Cek URL sebelum fetch; mencegah SSRF dan skema selain HTTPS. */
export function isAllowedGithubUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    ALLOWED_GITHUB_HOSTS.has(url.hostname) &&
    url.port === '' &&
    url.username === '' &&
    url.password === ''
  );
}

/**
 * Validasi tujuan redirect 301. Hanya `api.github.com` tanpa userinfo/port dan
 * tetap HTTPS yang diizinkan; `raw.githubusercontent.com` tidak boleh menjadi
 * tujuan redirect.
 */
export function resolveSafeGithubRedirect(
  location: string | null,
  baseUrl: string,
): string | null {
  if (location === null || location.trim().length === 0) return null;

  let base: URL;
  let target: URL;
  try {
    base = new URL(baseUrl);
    target = new URL(location, base);
  } catch {
    return null;
  }

  if (base.hostname !== 'api.github.com') return null;
  if (target.protocol !== 'https:') return null;
  if (target.hostname !== 'api.github.com') return null;
  if (target.username !== '' || target.password !== '') return null;
  if (target.port !== '') return null;
  return target.href;
}

function githubRateLimitError(headers: Headers): ScanError {
  const retryAfter = retryAfterSeconds(headers);
  const message =
    retryAfter === null
      ? 'Batas permintaan GitHub tercapai. Coba lagi sebentar lagi.'
      : `Batas permintaan GitHub tercapai. Coba lagi dalam ${Math.max(
          1,
          Math.ceil(retryAfter / 60),
        )} menit.`;

  return new ScanError('RATE_LIMITED', {
    message,
    retryAfter,
    scope: 'github',
  });
}

function retryAfterSeconds(headers: Headers): number | null {
  const retryAfter = headers.get('retry-after');
  if (retryAfter !== null && /^\d+$/.test(retryAfter.trim())) {
    const seconds = Number(retryAfter);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }

  const reset = headers.get('x-ratelimit-reset');
  if (reset !== null && /^\d+$/.test(reset.trim())) {
    return Math.max(1, Number(reset) - Math.floor(Date.now() / 1000));
  }

  return null;
}

/** Petakan status HTTP GitHub/raw menjadi ScanError tanpa membocorkan body upstream. */
export function mapGithubHttpError(
  status: number,
  headers: Headers,
  context: 'metadata' | 'file',
): ScanError {
  if (status === 429) {
    return githubRateLimitError(headers);
  }

  if (status === 403) {
    if (headers.get('x-ratelimit-remaining') === '0') {
      return githubRateLimitError(headers);
    }
    if (context === 'metadata') {
      return new ScanError('REPO_PRIVATE_OR_FORBIDDEN');
    }
    return new ScanError('UPSTREAM_UNAVAILABLE');
  }

  if (status === 404 && context === 'metadata') {
    // GitHub memakai 404 yang sama untuk repo tidak ada dan repo privat yang
    // tidak dapat diakses token server; PRD menyediakan kode gabungan ini.
    return new ScanError('REPO_NOT_FOUND_OR_PRIVATE');
  }

  return new ScanError('UPSTREAM_UNAVAILABLE');
}

function abortableError(error: unknown): ScanError {
  return new ScanError('SCAN_TIMEOUT', { cause: error });
}

function networkError(error: unknown): ScanError {
  return new ScanError('UPSTREAM_UNAVAILABLE', { cause: error });
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null && /^\d+$/.test(declaredLength.trim())) {
    if (Number(declaredLength) > maxBytes) {
      throw new ScanError('MANIFEST_TOO_LARGE');
    }
  }

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new ScanError('MANIFEST_TOO_LARGE');
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        throw new ScanError('MANIFEST_TOO_LARGE');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

interface FetchTextOptions {
  fetchImpl: FetchLike;
  timeoutMs: number;
  maxBytes: number;
}

/** Fetch dengan allowlist host, timeout, redirect manual, dan batas body. */
export async function fetchAllowedText(
  rawUrl: string,
  init: RequestInit,
  options: FetchTextOptions,
): Promise<{ response: Response; text: string }> {
  if (!isAllowedGithubUrl(rawUrl)) {
    throw new ScanError('UPSTREAM_UNAVAILABLE', {
      message: 'Host upstream tidak diizinkan.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const request = (url: string): Promise<Response> =>
      options.fetchImpl(url, {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
      });

    let response: Response;
    try {
      response = await request(rawUrl);
    } catch (error) {
      if (controller.signal.aborted) throw abortableError(error);
      throw networkError(error);
    }

    if (response.status === 301) {
      const redirectUrl = resolveSafeGithubRedirect(
        response.headers.get('location'),
        rawUrl,
      );
      if (redirectUrl === null) {
        await response.body?.cancel().catch(() => undefined);
        throw new ScanError('UPSTREAM_UNAVAILABLE', {
          message:
            'GitHub mengalihkan ke alamat yang tidak diizinkan; redirect ditolak.',
        });
      }

      // Tepat satu hop; redirect berikutnya selalu ditolak.
      try {
        response = await request(redirectUrl);
      } catch (error) {
        if (controller.signal.aborted) throw abortableError(error);
        throw networkError(error);
      }
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        throw new ScanError('UPSTREAM_UNAVAILABLE', {
          message: 'Rantai redirect GitHub tidak diizinkan.',
        });
      }
    } else if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined);
      throw new ScanError('UPSTREAM_UNAVAILABLE', {
        message: 'Upstream mengalihkan ke alamat lain; redirect tidak diikuti.',
      });
    }

    if (!response.ok) {
      // Body error tidak dibaca agar tidak membocorkan/menghabiskan memori.
      await response.body?.cancel().catch(() => undefined);
      return { response, text: '' };
    }

    try {
      const text = await readLimitedText(response, options.maxBytes);
      return { response, text };
    } catch (error) {
      if (error instanceof ScanError) throw error;
      if (controller.signal.aborted) throw abortableError(error);
      throw networkError(error);
    }
  } finally {
    clearTimeout(timer);
  }
}

function apiHeaders(token: string | null | undefined): HeadersInit {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'PatchRadar/1.0',
    'x-github-api-version': '2022-11-28',
  };
  if (typeof token === 'string' && token.length > 0) {
    headers.authorization = `Bearer ${token}`;
  }
  return headers;
}

function rawHeaders(): HeadersInit {
  return {
    accept: 'text/plain',
    'user-agent': 'PatchRadar/1.0',
  };
}

export interface RepoMetadata {
  defaultBranch: string;
  durationMs: number;
}

/** Ambil metadata repo dan default branch. Token hanya dikirim ke api.github.com. */
export async function fetchRepoMetadata(
  owner: string,
  repo: string,
  options: GithubClientOptions = {},
): Promise<RepoMetadata> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const started = Date.now();
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const { response, text } = await fetchAllowedText(
    url,
    {
      method: 'GET',
      headers: apiHeaders(options.token),
    },
    { fetchImpl, timeoutMs, maxBytes },
  );

  if (!response.ok) {
    throw mapGithubHttpError(response.status, response.headers, 'metadata');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ScanError('UPSTREAM_UNAVAILABLE', { cause: error });
  }

  const defaultBranch =
    parsed && typeof parsed === 'object' && 'default_branch' in parsed
      ? (parsed as { default_branch?: unknown }).default_branch
      : null;

  if (typeof defaultBranch !== 'string' || defaultBranch.trim().length === 0) {
    throw new ScanError('UPSTREAM_UNAVAILABLE');
  }

  return { defaultBranch, durationMs: Date.now() - started };
}

/** Ambil file manifest. 404 mengembalikan null (mis. lockfile tidak ada). */
export async function fetchRepoFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  options: GithubClientOptions = {},
): Promise<FetchedText | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? MAX_MANIFEST_BYTES;
  const started = Date.now();
  const encodedBranch = branch
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo,
  )}/${encodedBranch}/${encodeURIComponent(path)}`;

  const { response, text } = await fetchAllowedText(
    url,
    {
      method: 'GET',
      headers: rawHeaders(),
    },
    { fetchImpl, timeoutMs, maxBytes },
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw mapGithubHttpError(response.status, response.headers, 'file');
  }

  return { text, durationMs: Date.now() - started };
}
