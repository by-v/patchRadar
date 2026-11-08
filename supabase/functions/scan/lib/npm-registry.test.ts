import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createNpmRegistryClient,
  encodePackageName,
  NpmRegistryClient,
} from './npm-registry.ts';

const PACKUMENT = {
  'dist-tags': { latest: '2.1.0', next: '3.0.0-beta.1' },
  versions: {
    '1.0.0': { version: '1.0.0' },
    '1.2.0': { version: '1.2.0' },
    '1.2.5': { version: '1.2.5' },
    '1.3.0': { version: '1.3.0' },
    '2.0.0': { version: '2.0.0' },
    '2.1.0': { version: '2.1.0' },
    '3.0.0-beta.1': { version: '3.0.0-beta.1' },
  },
};

function jsonResponse(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function clientWith(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  options: { timeoutMs?: number } = {},
): { client: NpmRegistryClient; calls: Array<{ url: string; init?: RequestInit }> } {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    return handler(url, init);
  };
  const client = createNpmRegistryClient({ fetchImpl: fakeFetch, ...options });
  return { client, calls };
}

test('encodePackageName meng-encode paket scoped', () => {
  assert.equal(encodePackageName('lodash'), 'lodash');
  assert.equal(encodePackageName('@types/node'), '@types%2Fnode');
  assert.equal(encodePackageName('@scope/pkg'), '@scope%2Fpkg');
});

test('resolveVersion memilih versi tertinggi untuk caret, tilde, exact, dan range majemuk', async () => {
  const { client, calls } = clientWith(() => jsonResponse(PACKUMENT));

  const caret = await client.resolveVersion('lodash', '^1.2.0');
  assert.deepEqual(caret, { ok: true, value: { name: 'lodash', version: '1.3.0' } });

  const tilde = await client.resolveVersion('lodash', '~1.2.0');
  assert.equal(tilde.ok && tilde.value.version, '1.2.5');

  const exact = await client.resolveVersion('lodash', '1.2.0');
  assert.equal(exact.ok && exact.value.version, '1.2.0');

  const compound = await client.resolveVersion('lodash', '>=1.2.0 <2.0.0');
  assert.equal(compound.ok && compound.value.version, '1.3.0');

  assert.equal(calls.length, 1, 'packument dicache per nama');
  assert.equal(calls[0]?.url, 'https://registry.npmjs.org/lodash');
  assert.match(String(calls[0]?.init?.headers && JSON.stringify(calls[0]?.init?.headers)), /vnd\.npm/);
  assert.ok(calls[0]?.init?.signal, 'permintaan memakai AbortSignal');
});

test('resolveVersion memakai dist-tag dan paket scoped', async () => {
  const { client, calls } = clientWith(() => jsonResponse(PACKUMENT));

  const latest = await client.resolveVersion('@types/node', 'latest');
  assert.deepEqual(latest, {
    ok: true,
    value: { name: '@types/node', version: '2.1.0' },
  });

  const next = await client.resolveVersion('@types/node', 'next');
  assert.equal(next.ok && next.value.version, '3.0.0-beta.1');
  assert.equal(calls[0]?.url, 'https://registry.npmjs.org/@types%2Fnode');
  assert.equal(calls.length, 1, 'dist-tag memakai packument yang sama');
});

test('404 menghasilkan NOT_FOUND yang tidak retryable', async () => {
  const { client } = clientWith(() => jsonResponse({ error: 'not found' }, 404));
  const result = await client.resolveVersion('tidak-ada', '^1.0.0');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'NOT_FOUND');
    assert.equal(result.error.retryable, false);
    assert.equal(result.error.status, 404);
  }
});

test('429 menghasilkan RATE_LIMITED beserta Retry-After', async () => {
  const { client } = clientWith(() =>
    jsonResponse({ error: 'rate limited' }, 429, { 'retry-after': '2' }),
  );
  const result = await client.resolveVersion('lodash', '^1.0.0');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'RATE_LIMITED');
    assert.equal(result.error.retryable, true);
    assert.equal(result.error.retryAfterMs, 2000);
  }
});

test('5xx retryable sedangkan 4xx lain tidak retryable', async () => {
  const server = clientWith(() => jsonResponse({}, 503));
  const serverResult = await server.client.resolveVersion('lodash', '^1.0.0');
  assert.equal(serverResult.ok, false);
  if (!serverResult.ok) {
    assert.equal(serverResult.error.code, 'HTTP_ERROR');
    assert.equal(serverResult.error.retryable, true);
    assert.equal(serverResult.error.status, 503);
  }

  const client = clientWith(() => jsonResponse({}, 400));
  const clientResult = await client.client.resolveVersion('lodash', '^1.0.0');
  assert.equal(clientResult.ok, false);
  if (!clientResult.ok) {
    assert.equal(clientResult.error.code, 'HTTP_ERROR');
    assert.equal(clientResult.error.retryable, false);
    assert.equal(clientResult.error.status, 400);
  }
});

test('timeout menghasilkan TIMEOUT yang retryable tanpa menggantung', async () => {
  const hangingFetch: typeof fetch = (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });

  const client = createNpmRegistryClient({ fetchImpl: hangingFetch, timeoutMs: 5 });
  const result = await client.resolveVersion('lambat', '^1.0.0');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'TIMEOUT');
    assert.equal(result.error.retryable, true);
  }
});

test('kegagalan jaringan dan respons rusak dipetakan tanpa exception', async () => {
  const network = createNpmRegistryClient({
    fetchImpl: (async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch,
  });
  const networkResult = await network.resolveVersion('lodash', '^1.0.0');
  assert.equal(networkResult.ok, false);
  if (!networkResult.ok) {
    assert.equal(networkResult.error.code, 'NETWORK');
    assert.equal(networkResult.error.retryable, true);
  }

  const brokenJson = clientWith(
    () => new Response('bukan json', { status: 200, headers: { 'content-type': 'application/json' } }),
  );
  const brokenResult = await brokenJson.client.resolveVersion('lodash', '^1.0.0');
  assert.equal(brokenResult.ok, false);
  if (!brokenResult.ok) assert.equal(brokenResult.error.code, 'INVALID_RESPONSE');

  const noVersions = clientWith(() => jsonResponse({ 'dist-tags': { latest: '1.0.0' } }));
  const noVersionsResult = await noVersions.client.resolveVersion('lodash', '^1.0.0');
  assert.equal(noVersionsResult.ok, false);
  if (!noVersionsResult.ok) assert.equal(noVersionsResult.error.code, 'INVALID_RESPONSE');
});

test('spesifikasi non-registry dan range tidak valid dilewati tanpa fetch', async () => {
  const { client, calls } = clientWith(() => jsonResponse(PACKUMENT));

  for (const spec of ['git+https://github.com/a/b.git', 'file:../lokal', 'workspace:*', 'https://contoh.test/a.tgz']) {
    const result = await client.resolveVersion('alpha', spec);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, 'NON_REGISTRY_SPEC');
      assert.equal(result.error.retryable, false);
    }
  }

  const invalid = await client.resolveVersion('alpha', 'bukan range');
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.error.code, 'INVALID_RANGE');

  assert.equal(calls.length, 0);
});

test('range tanpa versi yang cocok menghasilkan NO_MATCHING_VERSION', async () => {
  const { client } = clientWith(() => jsonResponse(PACKUMENT));
  const result = await client.resolveVersion('lodash', '^9.0.0');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, 'NO_MATCHING_VERSION');
    assert.equal(result.error.retryable, false);
  }
});

test('resolveMany mencatat warning non-registry dan kegagalan parsial', async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.endsWith('/hilang')) return jsonResponse({}, 404);
    return jsonResponse(PACKUMENT);
  };
  const client = createNpmRegistryClient({ fetchImpl });

  const result = await client.resolveMany({
    alpha: '^1.2.0',
    beta: 'file:../beta',
    gamma: '~1.2.0',
    hilang: '^1.0.0',
    delta: '1.2.0',
  });

  assert.deepEqual(result.resolved, {
    alpha: '1.3.0',
    gamma: '1.2.5',
    delta: '1.2.0',
  });
  assert.deepEqual(
    result.warnings.map((warning) => `${warning.packageName}:${warning.code}`),
    ['beta:NON_REGISTRY_SPEC', 'hilang:NOT_FOUND'],
  );
  assert.deepEqual(
    result.failed.map((warning) => `${warning.packageName}:${warning.code}`),
    ['hilang:NOT_FOUND'],
  );
  assert.equal(result.partial, true);
});

test('resolveMany tanpa kegagalan registry menghasilkan partial=false', async () => {
  const { client } = clientWith(() => jsonResponse(PACKUMENT));
  const result = await client.resolveMany({ alpha: '^1.2.0', beta: '1.2.0' }, 2);

  assert.deepEqual(result.resolved, { alpha: '1.3.0', beta: '1.2.0' });
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.failed, []);
  assert.equal(result.partial, false);
});

test('cache per instance juga menyimpan kegagalan', async () => {
  const { client, calls } = clientWith(() => jsonResponse({}, 404));
  await client.resolveVersion('hilang', '^1.0.0');
  await client.resolveVersion('hilang', '~2.0.0');

  assert.equal(calls.length, 1);
});
