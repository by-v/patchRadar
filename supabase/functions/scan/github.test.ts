import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  fetchAllowedText,
  fetchRepoFile,
  fetchRepoMetadata,
  isAllowedGithubUrl,
  mapGithubHttpError,
} from './github.ts';
import { ScanError } from './errors.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isScanError(code: string) {
  return (error: unknown) => error instanceof ScanError && error.code === code;
}

test('allowlist host hanya API/raw GitHub dengan HTTPS', () => {
  assert.equal(isAllowedGithubUrl('https://api.github.com/repos/a/b'), true);
  assert.equal(isAllowedGithubUrl('https://raw.githubusercontent.com/a/b/main/package.json'), true);
  for (const value of [
    'http://api.github.com/repos/a/b',
    'https://evil.com/x',
    'https://api.github.com.evil.com/x',
    'https://raw.githubusercontent.com@evil.com/x',
    'https://user@api.github.com/x',
    'not-a-url',
  ]) {
    assert.equal(isAllowedGithubUrl(value), false, value);
  }
});

test('fetchAllowedText menolak host lain tanpa memanggil fetch', async () => {
  let called = 0;
  await assert.rejects(
    fetchAllowedText(
      'https://evil.com/steal',
      {},
      {
        fetchImpl: async () => {
          called += 1;
          return new Response('ok');
        },
        timeoutMs: 1000,
        maxBytes: 100,
      },
    ),
    isScanError('UPSTREAM_UNAVAILABLE'),
  );
  assert.equal(called, 0);
});

test('metadata memakai api.github.com, token dikirim, dan default branch dibaca', async () => {
  let seenUrl = '';
  let seenInit: RequestInit | undefined;
  const result = await fetchRepoMetadata('lodash', 'lodash', {
    token: 'token-rahasia-uji',
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return jsonResponse({ default_branch: 'main' });
    },
  });

  assert.equal(seenUrl, 'https://api.github.com/repos/lodash/lodash');
  assert.equal(seenInit?.redirect, 'manual');
  assert.equal(new Headers(seenInit?.headers).get('authorization'), 'Bearer token-rahasia-uji');
  assert.equal(result.defaultBranch, 'main');
  assert.ok(result.durationMs >= 0);
});

test('file raw tidak mengirim token dan memakai branch yang di-encode per segmen', async () => {
  let seenUrl = '';
  let seenHeaders: Headers | undefined;
  const result = await fetchRepoFile('a', 'b', 'fitur/baru', 'package.json', {
    token: 'token-rahasia-uji',
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenHeaders = new Headers(init?.headers);
      return new Response('{"name":"b"}');
    },
  });

  assert.equal(seenUrl, 'https://raw.githubusercontent.com/a/b/fitur/baru/package.json');
  assert.equal(seenHeaders?.get('authorization'), null);
  assert.equal(result?.text, '{"name":"b"}');
});

test('redirect 3xx tidak diikuti dan menjadi UPSTREAM_UNAVAILABLE', async () => {
  await assert.rejects(
    fetchRepoMetadata('a', 'b', {
      token: 'x',
      fetchImpl: async () =>
        new Response(null, { status: 302, headers: { location: 'https://evil.com/' } }),
    }),
    isScanError('UPSTREAM_UNAVAILABLE'),
  );
});

test('timeout memakai AbortController dan menjadi SCAN_TIMEOUT', async () => {
  await assert.rejects(
    fetchRepoMetadata('a', 'b', {
      token: 'x',
      timeoutMs: 5,
      fetchImpl: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    }),
    isScanError('SCAN_TIMEOUT'),
  );
});

test('status GitHub dipetakan: 404, 403 privat, 403 rate limit, 429, 5xx', async () => {
  await assert.rejects(
    fetchRepoMetadata('a', 'b', { token: 'x', fetchImpl: async () => jsonResponse({}, 404) }),
    isScanError('REPO_NOT_FOUND_OR_PRIVATE'),
  );

  await assert.rejects(
    fetchRepoMetadata('a', 'b', {
      token: 'x',
      fetchImpl: async () => jsonResponse({ message: 'forbidden' }, 403),
    }),
    isScanError('REPO_PRIVATE_OR_FORBIDDEN'),
  );

  const rateLimited = mapGithubHttpError(
    403,
    new Headers({ 'x-ratelimit-remaining': '0', 'retry-after': '30' }),
    'metadata',
  );
  assert.equal(rateLimited.code, 'RATE_LIMITED');
  assert.equal(rateLimited.retryAfter, 30);

  const tooMany = mapGithubHttpError(429, new Headers({ 'retry-after': '7' }), 'metadata');
  assert.equal(tooMany.code, 'RATE_LIMITED');
  assert.equal(tooMany.retryAfter, 7);

  await assert.rejects(
    fetchRepoMetadata('a', 'b', { token: 'x', fetchImpl: async () => jsonResponse({}, 502) }),
    isScanError('UPSTREAM_UNAVAILABLE'),
  );
});

test('metadata tanpa default_branch atau JSON rusak menjadi UPSTREAM_UNAVAILABLE', async () => {
  await assert.rejects(
    fetchRepoMetadata('a', 'b', { token: 'x', fetchImpl: async () => jsonResponse({}) }),
    isScanError('UPSTREAM_UNAVAILABLE'),
  );
  await assert.rejects(
    fetchRepoMetadata('a', 'b', { token: 'x', fetchImpl: async () => new Response('{rusak') }),
    isScanError('UPSTREAM_UNAVAILABLE'),
  );
});

test('file 404 mengembalikan null, file terlalu besar menjadi MANIFEST_TOO_LARGE', async () => {
  const missing = await fetchRepoFile('a', 'b', 'main', 'package-lock.json', {
    fetchImpl: async () => new Response(null, { status: 404 }),
  });
  assert.equal(missing, null);

  await assert.rejects(
    fetchRepoFile('a', 'b', 'main', 'package.json', {
      maxBytes: 10,
      fetchImpl: async () => new Response('x'.repeat(50)),
    }),
    isScanError('MANIFEST_TOO_LARGE'),
  );

  await assert.rejects(
    fetchRepoFile('a', 'b', 'main', 'package.json', {
      maxBytes: 10,
      fetchImpl: async () =>
        new Response('ok', { headers: { 'content-length': '999999' } }),
    }),
    isScanError('MANIFEST_TOO_LARGE'),
  );
});
