import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  buildScanDependencies,
  logScanMisconfiguration,
  scanMisconfiguredError,
} from './composition.ts';
import { handleScanRequest } from './handler.ts';
import { isAllowedGithubUrl } from './github.ts';

function makeJwt(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `${header}.${payload}.sig`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

interface PostgrestCall {
  method: string;
  url: string;
  body: unknown;
  headers: Headers;
}

function createPostgrestFetch(options: {
  calls: PostgrestCall[];
  recentRateLimitEvents?: Array<{ user_id: string; kind: string; created_at: string }>;
  failWrites?: boolean;
}) {
  const recent = options.recentRateLimitEvents ?? [];
  return async (url: string, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown = null;
    if (typeof init?.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    options.calls.push({
      method,
      url,
      body,
      headers: new Headers(init?.headers),
    });

    const u = new URL(url);
    const path = u.pathname;

    if (options.failWrites && method === 'POST') {
      return new Response(JSON.stringify({ message: 'simulasi gagal' }), { status: 500 });
    }

    if (method === 'GET' && path.endsWith('/osv_cache')) {
      return jsonResponse([]);
    }
    if (method === 'POST' && path.endsWith('/osv_cache')) {
      return new Response(null, { status: 201 });
    }

    if (method === 'GET' && path.endsWith('/epss_cache')) {
      return jsonResponse([]);
    }
    if (method === 'POST' && path.endsWith('/epss_cache')) {
      return new Response(null, { status: 201 });
    }

    if (method === 'GET' && path.endsWith('/rate_limit_events')) {
      return jsonResponse(recent);
    }
    if (method === 'POST' && path.endsWith('/rate_limit_events')) {
      return new Response(null, { status: 201 });
    }

    if (method === 'GET' && path.endsWith('/kev_entries')) {
      // count(): select=cve_id + prefer count=exact
      if (u.searchParams.get('select') === 'cve_id') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-range': '0-0/1',
          },
        });
      }
      // latestUpdatedAt(): select=updated_at&order=updated_at.desc&limit=1
      if (u.searchParams.get('select') === 'updated_at') {
        return jsonResponse([{ updated_at: new Date().toISOString() }]);
      }
      // loadAll()
      return jsonResponse([]);
    }
    if (method === 'POST' && path.endsWith('/kev_entries')) {
      return new Response(null, { status: 201 });
    }

    if (method === 'POST' && path.endsWith('/scans')) {
      return new Response(null, { status: 201 });
    }
    if (method === 'POST' && path.endsWith('/findings')) {
      return new Response(null, { status: 201 });
    }
    if (method === 'DELETE' && path.endsWith('/scans')) {
      return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify({ message: 'unhandled', url, method }), { status: 404 });
  };
}

function createGithubFetch() {
  const packageJson = JSON.stringify({
    name: 'repo-uji',
    version: '1.0.0',
    dependencies: {},
  });
  const lockfile = JSON.stringify({
    name: 'repo-uji',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: 'repo-uji', version: '1.0.0' },
    },
  });
  return async (url: string, init?: RequestInit): Promise<Response> => {
    if (!isAllowedGithubUrl(url)) {
      throw new Error(`HOST_TIDAK_DIIZINKAN: ${url}`);
    }
    if (new URL(url).hostname === 'api.github.com') {
      return jsonResponse({ default_branch: 'main' });
    }
    if (url.endsWith('/package.json')) {
      return new Response(packageJson, { status: 200 });
    }
    if (url.endsWith('/package-lock.json')) {
      return new Response(lockfile, { status: 200 });
    }
    return new Response(null, { status: 404 });
  };
}

function scanRequest(options: { authorization?: string } = {}): Request {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-client-version': '1.0.0',
  };
  if (options.authorization) headers.authorization = options.authorization;
  return new Request('https://contoh.test/functions/v1/scan', {
    method: 'POST',
    headers,
    body: JSON.stringify({ repoUrl: 'https://github.com/lodash/lodash', clientVersion: '1.0.0' }),
  });
}

test('buildScanDependencies: env lengkap merakit store nyata dan token', () => {
  const result = buildScanDependencies(
    (name) => {
      if (name === 'GITHUB_TOKEN') return 'gh-token';
      if (name === 'SUPABASE_URL') return 'https://project.supabase.co';
      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
      return undefined;
    },
    { storeOptions: { fetchImpl: async () => new Response('[]', { status: 200 }) } },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.missing, []);
  assert.equal(result.dependencies.token, 'gh-token');
  assert.ok(result.dependencies.osvStore);
  assert.ok(result.dependencies.kevStore);
  assert.ok(result.dependencies.epssStore);
  assert.ok(result.dependencies.scanStore);
  assert.ok(result.dependencies.rateLimitStore);
});

test('buildScanDependencies: env Supabase kurang ditolak sebagai misconfig', () => {
  const missingUrl = buildScanDependencies((name) => {
    if (name === 'GITHUB_TOKEN') return 'gh-token';
    if (name === 'SUPABASE_SERVICE_ROLE_KEY') return 'service-role-key';
    return undefined;
  });
  assert.equal(missingUrl.ok, false);
  if (missingUrl.ok) return;
  assert.deepEqual(missingUrl.missing, ['SUPABASE_URL']);

  const missingKey = buildScanDependencies((name) => {
    if (name === 'GITHUB_TOKEN') return 'gh-token';
    if (name === 'SUPABASE_URL') return 'https://project.supabase.co';
    return undefined;
  });
  assert.equal(missingKey.ok, false);
  if (missingKey.ok) return;
  assert.deepEqual(missingKey.missing, ['SUPABASE_SERVICE_ROLE_KEY']);

  const missingBoth = buildScanDependencies((name) => {
    if (name === 'GITHUB_TOKEN') return 'gh-token';
    return undefined;
  });
  assert.equal(missingBoth.ok, false);
  if (missingBoth.ok) return;
  assert.deepEqual(missingBoth.missing, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
});

test('logScanMisconfiguration dan scanMisconfiguredError: log nama variabel tanpa nilai, klien generik', () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (msg?: unknown) => {
    errors.push(String(msg));
  };
  try {
    logScanMisconfiguration(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  } finally {
    console.error = original;
  }
  assert.equal(errors.length, 1);
  const parsed = JSON.parse(errors[0]!) as { event: string; missing: string[] };
  assert.equal(parsed.event, 'scan.misconfigured');
  assert.deepEqual(parsed.missing, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  assert.ok(!errors[0]!.includes('project.supabase.co'));
  assert.ok(!errors[0]!.includes('service-role-key'));

  const err = scanMisconfiguredError();
  assert.equal(err.code, 'SERVER_MISCONFIGURED');
  assert.equal(err.status, 500);
  assert.equal(err.message, 'Layanan sedang tidak dapat digunakan. Coba lagi nanti.');
});

const USER_ID = '11111111-2222-4333-8444-555555555555';
const SERVICE_ROLE = 'service-role-key-test';

function productionDeps(options: { failWrites?: boolean; recent?: Array<{ user_id: string; kind: string; created_at: string }> } = {}) {
  const calls: PostgrestCall[] = [];
  const postgrest = createPostgrestFetch({
    calls,
    failWrites: options.failWrites,
    recentRateLimitEvents: options.recent,
  });
  const built = buildScanDependencies(
    (name) => {
      if (name === 'GITHUB_TOKEN') return 'github-token';
      if (name === 'SUPABASE_URL') return 'https://project.supabase.co';
      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return SERVICE_ROLE;
      return undefined;
    },
    { storeOptions: { fetchImpl: postgrest } },
  );
  assert.equal(built.ok, true);
  if (!built.ok) throw new Error('expected ok');
  return { deps: built.dependencies, calls };
}

test('penyambungan nyata: rate limit, scans, findings ditulis dengan user_id sub dan service role', async () => {
  const { deps, calls } = productionDeps();
  const response = await handleScanRequest(scanRequest({ authorization: `Bearer ${makeJwt(USER_ID)}` }), {
    ...deps,
    fetchImpl: createGithubFetch(),
    osvFetchImpl: async () => jsonResponse({ results: [{}] }),
    kevFetchImpl: async () => new Response('', { status: 404 }),
    epssFetchImpl: async () => jsonResponse({ status: 'OK', total: 0, data: [] }),
  });

  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(response.status, 200);
  assert.equal(body.persisted, true);
  assert.equal(typeof body.requestId, 'string');

  const ratePost = calls.find((c) => c.method === 'POST' && c.url.includes('/rest/v1/rate_limit_events'));
  assert.ok(ratePost, 'rate_limit_events harus ditulis');
  const rateRows = ratePost!.body as Array<{ user_id: string; kind: string }>;
  assert.equal(rateRows[0]?.user_id, USER_ID);
  assert.equal(rateRows[0]?.kind, 'scan');
  assert.equal(ratePost!.headers.get('apikey'), SERVICE_ROLE);
  assert.equal(ratePost!.headers.get('authorization'), `Bearer ${SERVICE_ROLE}`);

  const scanPost = calls.find((c) => c.method === 'POST' && c.url.includes('/rest/v1/scans'));
  assert.ok(scanPost, 'scans harus ditulis');
  const scanRows = scanPost!.body as Array<{ user_id: string; id: string }>;
  assert.equal(scanRows[0]?.user_id, USER_ID);
  assert.equal(scanRows[0]?.id, body.scanId);
  assert.equal(scanPost!.headers.get('apikey'), SERVICE_ROLE);
  assert.equal(scanPost!.headers.get('authorization'), `Bearer ${SERVICE_ROLE}`);

  const findingsPost = calls.find((c) => c.method === 'POST' && c.url.includes('/rest/v1/findings'));
  if (Array.isArray(body.findings) && body.findings.length > 0) {
    assert.ok(findingsPost, 'findings harus ditulis bila ada temuan');
    const findingRows = findingsPost!.body as Array<{ scan_id: string }>;
    for (const row of findingRows) {
      assert.equal(row.scan_id, body.scanId);
    }
    assert.equal(findingsPost!.headers.get('apikey'), SERVICE_ROLE);
    assert.equal(findingsPost!.headers.get('authorization'), `Bearer ${SERVICE_ROLE}`);
  } else {
    // Tanpa temuan, store tidak mengirim POST findings (perilaku save).
    assert.equal(findingsPost, undefined);
  }
});

test('penyambungan nyata: penulisan gagal -> persisted=false dan CLOUD_PERSIST_FAILED', async () => {
  const { deps } = productionDeps({ failWrites: true });
  // failWrites makes all POST fail including osv/epss/kev cache upserts and rate_limit/scans/findings.
  // To isolate persist failure, we need rate limit/scans/findings to fail but allow scan to proceed.
  // Easier: custom fetch that fails only scans/findings posts.
  const calls: PostgrestCall[] = [];
  const postgrest = async (url: string, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? 'GET').toUpperCase();
    let body: unknown = null;
    if (typeof init?.body === 'string') {
      try { body = JSON.parse(init.body); } catch { body = init.body; }
    }
    calls.push({ method, url, body, headers: new Headers(init?.headers) });
    const u = new URL(url);
    const path = u.pathname;
    if (method === 'POST' && (path.endsWith('/scans') || path.endsWith('/findings'))) {
      return new Response(JSON.stringify({ message: 'gagal' }), { status: 500 });
    }
    // allow rate limit write and reads/caches
    if (method === 'GET' && path.endsWith('/rate_limit_events')) return jsonResponse([]);
    if (method === 'POST' && path.endsWith('/rate_limit_events')) return new Response(null, { status: 201 });
    if (method === 'GET' && path.endsWith('/osv_cache')) return jsonResponse([]);
    if (method === 'POST' && path.endsWith('/osv_cache')) return new Response(null, { status: 201 });
    if (method === 'GET' && path.endsWith('/epss_cache')) return jsonResponse([]);
    if (method === 'POST' && path.endsWith('/epss_cache')) return new Response(null, { status: 201 });
    if (method === 'GET' && path.endsWith('/kev_entries')) {
      if (u.searchParams.get('select') === 'cve_id') {
        return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json', 'content-range': '0-0/1' } });
      }
      if (u.searchParams.get('select') === 'updated_at') return jsonResponse([{ updated_at: new Date().toISOString() }]);
      return jsonResponse([]);
    }
    if (method === 'POST' && path.endsWith('/kev_entries')) return new Response(null, { status: 201 });
    if (method === 'DELETE') return new Response(null, { status: 204 });
    return jsonResponse([]);
  };

  const built = buildScanDependencies(
    (name) => {
      if (name === 'GITHUB_TOKEN') return 'github-token';
      if (name === 'SUPABASE_URL') return 'https://project.supabase.co';
      if (name === 'SUPABASE_SERVICE_ROLE_KEY') return SERVICE_ROLE;
      return undefined;
    },
    { storeOptions: { fetchImpl: postgrest } },
  );
  assert.equal(built.ok, true);
  if (!built.ok) return;

  const response = await handleScanRequest(scanRequest({ authorization: `Bearer ${makeJwt(USER_ID)}` }), {
    ...built.dependencies,
    fetchImpl: createGithubFetch(),
    osvFetchImpl: async () => jsonResponse({ results: [{}] }),
    kevFetchImpl: async () => new Response('', { status: 404 }),
    epssFetchImpl: async () => jsonResponse({ status: 'OK', total: 0, data: [] }),
  });

  const body = (await response.json()) as { persisted: boolean; warnings: Array<{ code: string }> };
  assert.equal(response.status, 200);
  assert.equal(body.persisted, false);
  assert.ok(body.warnings.some((w) => w.code === 'CLOUD_PERSIST_FAILED'));
});

test('penyambungan nyata: tanpa sub JWT ditolak UNAUTHENTICATED sebelum fetch eksternal', async () => {
  const { deps } = productionDeps();
  let githubCalled = false;
  const githubFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    githubCalled = true;
    return createGithubFetch()(url, init);
  };

  // hanya kunci anon / tanpa bearer sub yang valid
  const response = await handleScanRequest(scanRequest(), {
    ...deps,
    fetchImpl: githubFetch,
  });
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(response.status, 401);
  assert.equal(body.error.code, 'UNAUTHENTICATED');
  assert.equal(githubCalled, false);
});

test('penyambungan nyata: percobaan ke-6 menghasilkan 429 FR-25a', async () => {
  const nowIso = new Date().toISOString();
  const recent = Array.from({ length: 5 }, () => ({
    user_id: USER_ID,
    kind: 'scan',
    created_at: nowIso,
  }));
  const { deps } = productionDeps({ recent });
  let githubCalled = false;
  const githubFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    githubCalled = true;
    return createGithubFetch()(url, init);
  };

  const response = await handleScanRequest(scanRequest({ authorization: `Bearer ${makeJwt(USER_ID)}` }), {
    ...deps,
    fetchImpl: githubFetch,
  });
  const body = (await response.json()) as { error: { code: string } };
  assert.equal(response.status, 429);
  assert.equal(body.error.code, 'RATE_LIMITED');
  assert.equal(githubCalled, false);
});
