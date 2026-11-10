import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleScanRequest, type ScanLogEntry } from './handler.ts';
import { scanErrorResponse } from './errors.ts';
import { isAllowedGithubUrl } from './github.ts';
import { createMemoryKevStore } from './store.ts';

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
  external?: (url: string, init?: RequestInit) => Promise<Response> | null;
}

interface FakeFetch {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  calls: string[];
}

function makeFetch(behaviour: FetchBehaviour = {}): FakeFetch {
  const calls: string[] = [];
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    if (!isAllowedGithubUrl(url)) {
      const handled = await behaviour.external?.(url, init);
      if (handled) return handled;

      const parsed = new URL(url);
      if (parsed.hostname === 'api.osv.dev' && parsed.pathname === '/v1/querybatch') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { queries?: unknown[] };
        const queries = Array.isArray(body.queries) ? body.queries : [];
        return new Response(JSON.stringify({ results: queries.map(() => ({})) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (parsed.hostname === 'www.cisa.gov') {
        return new Response(
          JSON.stringify({ catalogVersion: 'tiruan', count: 0, vulnerabilities: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (parsed.hostname === 'api.first.org') {
        return new Response(JSON.stringify({ total: 0, data: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (parsed.hostname === 'registry.npmjs.org') {
        return new Response(
          JSON.stringify({
            versions: ['4.18.0', '4.17.0', '29.7.0'],
            'dist-tags': {},
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
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

test('repo valid dengan lockfile mengembalikan 200 final + scanId + requestId', async () => {
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
  assert.equal(body.status, 'COMPLETED');
  assert.equal(body.persisted, false);
  assert.deepEqual(body.sourceStatus, {
    github: 'OK',
    osv: 'OK',
    kev: 'OK',
    epss: 'OK',
  });
  assert.deepEqual(body.warnings, []);
  assert.deepEqual(Object.keys(body.timings as object).sort(), [
    'enrichmentMs',
    'githubMs',
    'osvMs',
    'totalMs',
  ]);

  assert.ok(fake.calls.every(isAllowedGithubUrl));
  assert.ok(fake.calls.some((url) => url.includes('api.github.com')));
  assert.ok(fake.calls.some((url) => url.includes('raw.githubusercontent.com')));

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes(TOKEN), false);
  assert.equal(serialized.includes('token-rahasia'), false);
  assert.equal(logs.length, 1);
  const log = logs[0]!;
  for (const key of [
    'requestId',
    'owner',
    'repo',
    'status',
    'githubMs',
    'parseMs',
    'registryMs',
    'osvMs',
    'kevMs',
    'epssMs',
    'findingsMs',
    'labelMs',
    'syncMs',
    'totalMs',
    'sourceStatus',
    'stages',
  ]) {
    assert.ok(key in log, `log harus memuat ${key}`);
  }
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
  assert.equal(body.partial, false);
  assert.equal(body.status, 'COMPLETED');
  assert.ok(
    (body.warnings as Array<{ code: string }>).some((warning) => warning.code === 'LOCKFILE_MISSING'),
  );
  assert.equal(
    (body.warnings as Array<{ code: string }>).some(
      (warning) => warning.code === 'LOCKFILE_PARTIAL',
    ),
    false,
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

const E2E_NOW = Date.parse('2026-11-10T00:00:00.000Z');
const E2E_NOW_ISO = new Date(E2E_NOW).toISOString();
const OLD_KEV_ISO = '2026-11-01T00:00:00.000Z';

function jsonBody(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const ADVISORIES: Record<string, unknown> = {
  'GHSA-e2e-express': {
    id: 'GHSA-e2e-express',
    aliases: ['CVE-2099-0001'],
    summary: 'Penyerang dapat menjalankan input berbahaya pada server.',
    severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }],
    affected: [
      {
        package: { name: 'express', ecosystem: 'npm' },
        ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '4.21.3' }] }],
      },
    ],
    references: [{ type: 'ADVISORY', url: 'https://example.test/express' }],
  },
  'GHSA-e2e-morgan': {
    id: 'GHSA-e2e-morgan',
    aliases: ['CVE-2099-0002'],
    summary: 'Log dapat dimanipulasi melalui header permintaan.',
    severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H' }],
    affected: [
      {
        package: { name: 'morgan', ecosystem: 'npm' },
        ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.10.1' }] }],
      },
    ],
    references: [{ type: 'WEB', url: 'https://example.test/morgan' }],
  },
};

function pipelineExternal(options: { epssFail?: boolean } = {}) {
  return async (url: string, init?: RequestInit): Promise<Response | null> => {
    const parsed = new URL(url);

    if (parsed.hostname === 'api.osv.dev') {
      if (parsed.pathname === '/v1/querybatch') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          queries?: Array<{ package?: { name?: string }; version?: string }>;
        };
        const results = (body.queries ?? []).map((query) => {
          if (query.package?.name === 'express' && query.version === '4.21.2') {
            return { vulns: [{ id: 'GHSA-e2e-express', modified: E2E_NOW_ISO }] };
          }
          if (query.package?.name === 'morgan' && query.version === '1.10.0') {
            return { vulns: [{ id: 'GHSA-e2e-morgan', modified: E2E_NOW_ISO }] };
          }
          return {};
        });
        return jsonBody({ results });
      }

      const id = decodeURIComponent(parsed.pathname.split('/').pop() ?? '');
      return ADVISORIES[id] ? jsonBody(ADVISORIES[id]) : new Response(null, { status: 404 });
    }

    if (parsed.hostname === 'www.cisa.gov') return new Response(null, { status: 503 });

    if (parsed.hostname === 'api.first.org') {
      const cves = parsed.searchParams.getAll('cve');
      if (options.epssFail === true) return jsonBody({ total: 0, data: [] });
      return jsonBody({
        total: cves.length,
        data: cves.map((cve) => ({
          cve,
          epss: cve === 'CVE-2099-0001' ? '0.5' : '0.02',
          percentile: '0.9',
        })),
      });
    }

    return null;
  };
}

function kevEntry(cveId: string, updatedAt: string) {
  return {
    cveId,
    vendor: 'vendor',
    product: 'product',
    name: 'contoh',
    dateAdded: '2026-01-01',
    knownRansomware: false,
    raw: {},
    updatedAt,
  };
}

async function runPipeline(options: {
  epssFail?: boolean;
  kevStore?: ReturnType<typeof createMemoryKevStore>;
} = {}) {
  const fake = makeFetch({
    packageBody: fixture('small-100/package.json'),
    lockBody: fixture('small-100/package-lock.json'),
    external: pipelineExternal({ epssFail: options.epssFail }),
  });
  const logs: ScanLogEntry[] = [];
  const response = await handleScanRequest(scanRequest(), {
    token: TOKEN,
    fetchImpl: fake.fetchImpl,
    kevStore: options.kevStore ?? createMemoryKevStore([kevEntry('CVE-2099-0001', E2E_NOW_ISO)]),
    now: () => E2E_NOW,
    sleep: async () => undefined,
    logger: (entry) => logs.push(entry),
  });
  return { response, body: await bodyOf(response), logs, fake };
}

test('pipeline end-to-end menghasilkan respons final §9 lengkap', async () => {
  const { response, body, logs } = await runPipeline();
  const findings = body.findings as Array<Record<string, any>>;

  assert.equal(response.status, 200);
  assert.equal(body.status, 'COMPLETED');
  assert.equal(body.partial, false);
  assert.equal(body.persisted, false);
  assert.deepEqual(body.warnings, []);
  assert.deepEqual(Object.keys(body).sort(), [
    'findings',
    'manifest',
    'partial',
    'persisted',
    'repo',
    'requestId',
    'scanId',
    'scannedAt',
    'sourceStatus',
    'status',
    'summary',
    'timings',
    'warnings',
  ]);
  assert.deepEqual(body.sourceStatus, {
    github: 'OK',
    osv: 'OK',
    kev: 'CACHE',
    epss: 'OK',
  });
  assert.deepEqual(body.summary, { totalPackages: 107, affectedPackages: 2, findingCount: 2 });
  assert.equal(findings.length, 2);

  const [first, second] = findings;
  assert.deepEqual(Object.keys(first!).sort(), [
    'cveIds',
    'exploitation',
    'findingId',
    'fix',
    'osvId',
    'package',
    'priority',
    'references',
    'severity',
    'summary',
  ]);
  assert.equal(first!.package.name, 'express');
  assert.equal(first!.package.installedVersion, '4.21.2');
  assert.equal(first!.package.direct, true);
  assert.equal(first!.osvId, 'GHSA-e2e-express');
  assert.deepEqual(first!.cveIds, ['CVE-2099-0001']);
  assert.deepEqual(first!.severity, { level: 'CRITICAL', cvss: 9.8, source: 'OSV' });
  assert.deepEqual(first!.exploitation, {
    kev: true,
    epss: 0.5,
    epssPercentile: 0.9,
    epssAvailable: true,
  });
  assert.equal(first!.priority.label, 'FIX_NOW');
  assert.equal(typeof first!.priority.score, 'number');
  assert.match(String(first!.priority.reason), /CISA KEV/);
  assert.deepEqual(first!.fix, {
    safeVersion: '4.21.3',
    command: 'npm install express@4.21.3',
    suggestion: null,
  });
  assert.ok(
    (first!.references as Array<{ url: string }>).some(
      (reference) => reference.url === 'https://osv.dev/vulnerability/GHSA-e2e-express',
    ),
  );
  assert.ok(
    (first!.references as Array<{ url: string }>).some(
      (reference) => reference.url === 'https://example.test/express',
    ),
  );

  assert.equal(second!.package.name, 'morgan');
  assert.equal(second!.severity.level, 'HIGH');
  assert.equal(second!.exploitation.kev, false);
  assert.equal(second!.priority.label, 'SCHEDULE');
  assert.equal(second!.fix.safeVersion, '1.10.1');
  assert.equal(second!.fix.command, 'npm install morgan@1.10.1');
  assert.equal(second!.fix.suggestion, null);

  // Skor hanya alat urut, bukan "x dari 100" di respons.
  assert.equal(JSON.stringify(body).includes('dari 100'), false);
  assert.equal(JSON.stringify(body).includes(TOKEN), false);
  assert.equal(JSON.stringify(logs).includes(TOKEN), false);
  assert.equal(logs[0]!.status, 200);
});

test('EPSS gagal menghasilkan 200 parsial dengan warning dan findings tetap ada', async () => {
  const { response, body } = await runPipeline({ epssFail: true });
  const findings = body.findings as Array<Record<string, any>>;
  const warnings = body.warnings as Array<{ code: string; message: string }>;

  assert.equal(response.status, 200);
  assert.equal(body.status, 'PARTIAL');
  assert.equal(body.partial, true);
  assert.equal(body.persisted, false);
  assert.equal((body.sourceStatus as Record<string, string>).epss, 'FAILED');
  assert.ok(warnings.some((warning) => warning.code === 'EPSS_UNAVAILABLE'));
  assert.equal(findings.length, 2);
  assert.equal(findings[0]!.exploitation.epss, null);
  assert.equal(findings[0]!.exploitation.epssAvailable, false);
  // KEV tetap menjadi pemicu FIX_NOW meski EPSS tidak tersedia.
  assert.equal(findings[0]!.priority.label, 'FIX_NOW');
});

test('KEV kosong atau STALE tidak menghentikan scan dan memberi warning', async () => {
  const empty = await runPipeline({ kevStore: createMemoryKevStore([]) });
  assert.equal(empty.response.status, 200);
  assert.equal(empty.body.status, 'PARTIAL');
  assert.equal((empty.body.sourceStatus as Record<string, string>).kev, 'EMPTY');
  assert.ok(
    (empty.body.warnings as Array<{ code: string }>).some(
      (warning) => warning.code === 'KEV_UNAVAILABLE',
    ),
  );
  assert.equal((empty.body.findings as unknown[]).length, 2);

  const stale = await runPipeline({
    kevStore: createMemoryKevStore([kevEntry('CVE-2099-0001', OLD_KEV_ISO)]),
  });
  assert.equal(stale.response.status, 200);
  assert.equal(stale.body.status, 'PARTIAL');
  assert.equal((stale.body.sourceStatus as Record<string, string>).kev, 'STALE');
  assert.ok(
    (stale.body.warnings as Array<{ code: string }>).some(
      (warning) => warning.code === 'KEV_STALE',
    ),
  );
  assert.equal((stale.body.findings as Array<Record<string, any>>)[0]!.exploitation.kev, true);
});

