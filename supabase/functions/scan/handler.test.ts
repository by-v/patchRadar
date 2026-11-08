import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleScanRequest, type ScanLogEntry } from './handler.ts';
import { scanErrorResponse } from './errors.ts';
import { isAllowedGithubUrl } from './github.ts';

const FIXTURES = new URL('../../../fixtures/lockfiles/', import.meta.url);
const TOKEN = 'token-rahasia-yang-tidak-boleh-bocor';

function fixture(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, FIXTURES)), 'utf8');
}

interface FetchBehaviour {
  metadataStatus?: number;
  metadataBody?: unknown;
  metadataHeaders?: Record<string, string>;
  packageStatus?: number;
  packageBody?: string;
  lockStatus?: number;
  lockBody?: string;
  throwNetwork?: boolean;
  hangUntilAbort?: boolean;
}

interface FakeFetch {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  calls: string[];
}

function makeFetch(behaviour: FetchBehaviour = {}): FakeFetch {
  const calls: string[] = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    if (!isAllowedGithubUrl(url)) {
      throw new Error(`HOST_TIDAK_DIIZINKAN: ${url}`);
    }
    calls.push(url);

    if (behaviour.throwNetwork) throw new Error('jaringan tiruan gagal');
    if (behaviour.hangUntilAbort) {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    }

    if (new URL(url).hostname === 'api.github.com') {
      const status = behaviour.metadataStatus ?? 200;
      const body =
        behaviour.metadataBody ??
        (status === 200 ? { default_branch: 'main' } : { message: 'tiruan' });
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...behaviour.metadataHeaders },
      });
    }

    if (url.endsWith('/package.json')) {
      const status = behaviour.packageStatus ?? 200;
      return new Response(status === 200 ? (behaviour.packageBody ?? '{}') : null, { status });
    }

    if (url.endsWith('/package-lock.json')) {
      const status = behaviour.lockStatus ?? 200;
      return new Response(status === 200 ? (behaviour.lockBody ?? '{}') : null, { status });
    }

    throw new Error(`URL tiruan tidak dikenal: ${url}`);
  };
  return { fetchImpl, calls };
}

function scanRequest(repoUrl: unknown = 'https://github.com/lodash/lodash', method = 'POST'): Request {
  return new Request('https://contoh.test/functions/v1/scan', {
    method,
    headers: { 'content-type': 'application/json', 'x-client-version': '1.0.0' },
    body: method === 'POST' ? JSON.stringify({ repoUrl, clientVersion: '1.0.0' }) : undefined,
  });
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

function validFixtureFetch(): FakeFetch {
  return makeFetch({
    packageBody: fixture('small-100/package.json'),
    lockBody: fixture('small-100/package-lock.json'),
  });
}

test('repo valid dengan lockfile mengembalikan 200 manifest-only + scanId + requestId', async () => {
  const fake = validFixtureFetch();
  const logs: ScanLogEntry[] = [];
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
    logger: (entry) => logs.push(entry),
  });
  const body = await bodyOf(response);

  assert.equal(response.status, 200);
  assert.equal(typeof body.scanId, 'string');
  assert.match(String(body.scanId), /^[0-9a-f-]{36}$/);
  assert.equal(body.requestId, response.headers.get('x-request-id'));
  assert.deepEqual(body.repo, {
    owner: 'lodash',
    name: 'lodash',
    url: 'https://github.com/lodash/lodash',
    defaultBranch: 'main',
  });
  assert.deepEqual(body.manifest, { source: 'LOCKFILE', lockfileFormat: 'v3', estimated: false });
  assert.deepEqual(body.summary, { totalPackages: 107, affectedPackages: 0, findingCount: 0 });
  assert.deepEqual(body.findings, []);
  assert.equal(body.partial, false);
  assert.deepEqual(body.sourceStatus, { github: 'OK' });

  assert.ok(fake.calls.every(isAllowedGithubUrl));
  assert.ok(fake.calls.some((url) => url.includes('api.github.com')));
  assert.ok(fake.calls.some((url) => url.includes('raw.githubusercontent.com')));

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes(TOKEN), false);
  assert.equal(serialized.includes('token-rahasia'), false);
  assert.equal(logs.length, 1);
  assert.deepEqual(Object.keys(logs[0]!).sort(), [
    'githubMs',
    'owner',
    'repo',
    'requestId',
    'status',
    'totalMs',
  ]);
  assert.equal(JSON.stringify(logs).includes(TOKEN), false);
  assert.equal(logs[0]!.status, 200);
});

test('repo tanpa lockfile memakai fallback package.json', async () => {
  const fake = makeFetch({
    packageBody: fixture('no-lockfile/package.json'),
    lockStatus: 404,
  });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
  });
  const body = await bodyOf(response);

  assert.equal(response.status, 200);
  assert.deepEqual(body.manifest, { source: 'PACKAGE_JSON', lockfileFormat: null, estimated: true });
  assert.equal((body.summary as { totalPackages: number }).totalPackages, 3);
  assert.ok(
    (body.warnings as Array<{ code: string }>).some((warning) => warning.code === 'LOCKFILE_MISSING'),
  );
});

test('URL tidak valid, host lain, dan path tambahan menghasilkan 400 INVALID_URL', async () => {
  const invalid = [
    'bukan-url',
    'https://gitlab.com/a/b',
    'https://github.com/a/b/tree/main',
    'https://127.0.0.1/a/b',
    'https://GitHub.com/a/b',
  ];

  for (const repoUrl of invalid) {
    const fake = makeFetch();
    const logs: ScanLogEntry[] = [];
    const response = await handleScanRequest(scanRequest(repoUrl), {
      token: TOKEN,
      fetchImpl: fake.fetchImpl,
      logger: (entry) => logs.push(entry),
    });
    const body = await bodyOf(response);
    const error = body.error as { code: string; requestId: string; retryable: boolean };

    assert.equal(response.status, 400, repoUrl);
    assert.equal(error.code, 'INVALID_URL', repoUrl);
    assert.equal(error.retryable, false);
    assert.equal(error.requestId, response.headers.get('x-request-id'));
    assert.equal(fake.calls.length, 0, `${repoUrl} tidak boleh fetch`);
    assert.equal(logs[0]?.owner, null);
  }
});

test('repo privat/forbidden menghasilkan 403', async () => {
  const fake = makeFetch({ metadataStatus: 403, metadataBody: { message: 'Forbidden' } });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
  });
  const body = await bodyOf(response);
  assert.equal(response.status, 403);
  assert.equal((body.error as { code: string }).code, 'REPO_PRIVATE_OR_FORBIDDEN');
});

test('repo tidak ada menghasilkan 404 dengan kode gabungan sesuai PRD', async () => {
  const fake = makeFetch({ metadataStatus: 404 });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
  });
  const body = await bodyOf(response);
  assert.equal(response.status, 404);
  assert.equal((body.error as { code: string }).code, 'REPO_NOT_FOUND_OR_PRIVATE');
});

test('rate limit 429 menghasilkan retryable + retryAfter + header', async () => {
  const fake = makeFetch({
    metadataStatus: 429,
    metadataHeaders: { 'retry-after': '12' },
  });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
  });
  const body = await bodyOf(response);
  const error = body.error as { code: string; retryable: boolean; retryAfter: number };
  assert.equal(response.status, 429);
  assert.equal(error.code, 'RATE_LIMITED');
  assert.equal(error.retryable, true);
  assert.equal(error.retryAfter, 12);
  assert.equal(response.headers.get('retry-after'), '12');
});

test('package.json tidak ada menghasilkan 422 NO_PACKAGE_JSON', async () => {
  const fake = makeFetch({ packageStatus: 404 });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
  });
  assert.equal(response.status, 422);
  assert.equal(((await bodyOf(response)).error as { code: string }).code, 'NO_PACKAGE_JSON');
});

test('upstream 5xx menghasilkan 502 dan jaringan gagal juga 502', async () => {
  const upstream = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: makeFetch({ metadataStatus: 502 }).fetchImpl,
  });
  assert.equal(upstream.status, 502);
  assert.equal(((await bodyOf(upstream)).error as { code: string }).code, 'UPSTREAM_UNAVAILABLE');

  const network = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: makeFetch({ throwNetwork: true }).fetchImpl,
  });
  assert.equal(network.status, 502);
});

test('timeout menghasilkan 504 SCAN_TIMEOUT', async () => {
  const fake = makeFetch({ hangUntilAbort: true });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
    timeoutMs: 5,
  });
  assert.equal(response.status, 504);
  assert.equal(((await bodyOf(response)).error as { code: string }).code, 'SCAN_TIMEOUT');
});

test('redirect upstream menghasilkan 502, bukan diikuti', async () => {
  const fake = makeFetch();
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: async (url) => {
      if (!isAllowedGithubUrl(url)) throw new Error('host salah');
      return new Response(null, { status: 302, headers: { location: 'https://evil.com/' } });
    },
  });
  assert.equal(response.status, 502);
});

test('manifest > 5 MB menghasilkan 413', async () => {
  const fake = makeFetch({
    packageBody: 'x'.repeat(500),
    lockBody: '{}',
  });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
    maxManifestBytes: 200,
  });
  assert.equal(response.status, 413);
  assert.equal(((await bodyOf(response)).error as { code: string }).code, 'MANIFEST_TOO_LARGE');
});

test('lebih dari 2.000 paket unik menghasilkan 413', async () => {
  const packages: Record<string, { version: string }> = {};
  for (let index = 0; index < 2001; index += 1) {
    packages[`node_modules/pkg-${index}`] = { version: '1.0.0' };
  }
  const fake = makeFetch({
    packageBody: JSON.stringify({ name: 'besar', dependencies: {} }),
    lockBody: JSON.stringify({ lockfileVersion: 3, packages: { '': {}, ...packages } }),
  });
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
  });
  assert.equal(response.status, 413);
});

test('tanpa token, metode salah, dan body rusak ditangani', async () => {
  const withoutToken = await handleScanRequest(scanRequest(), { fetchImpl: makeFetch().fetchImpl });
  assert.equal(withoutToken.status, 502);

  const method = await handleScanRequest(scanRequest(undefined, 'GET'), {
    token: TOKEN,
    fetchImpl: makeFetch().fetchImpl,
  });
  assert.equal(method.status, 405);

  const malformed = await handleScanRequest(
    new Request('https://contoh.test/functions/v1/scan', { method: 'POST', body: '{rusak' }),
    { token: TOKEN, fetchImpl: makeFetch().fetchImpl },
  );
  assert.equal(malformed.status, 400);
});

test('error tak terduga dipetakan ke 500 INTERNAL tanpa detail sensitif', async () => {
  const response = scanErrorResponse(new Error('detail internal rahasia'), 'req_uji');
  const body = (await response.json()) as { error: Record<string, unknown> };
  assert.equal(response.status, 500);
  assert.equal(body.error.code, 'INTERNAL');
  assert.equal(body.error.requestId, 'req_uji');
  assert.equal(JSON.stringify(body).includes('detail internal rahasia'), false);
});
