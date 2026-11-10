import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  enrichWithOsv,
  osvAdvisoryCacheKey,
  osvPackageCacheKey,
  type OsvPackageInput,
} from './osv.ts';
import { ScanError } from './errors.ts';
import { createMemoryOsvCacheStore } from './store.ts';

interface RecordedCall {
  url: string;
  method: string;
  body: string | null;
}

interface FakeOsvOptions {
  batch?: (queries: Array<{ name: string; version: string }>, call: number) => Response | Error;
  detail?: (id: string) => Response | Error;
}

function makeFakeOsv(options: FakeOsvOptions = {}): {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  calls: RecordedCall[];
  bodies: Array<Array<{ name: string; version: string }>>;
} {
  const calls: RecordedCall[] = [];
  const bodies: Array<Array<{ name: string; version: string }>> = [];
  let batchCall = 0;

  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : null;
    calls.push({ url, method, body });

    if (url.endsWith('/v1/querybatch')) {
      const parsed = JSON.parse(body ?? '{}') as {
        queries?: Array<{ package?: { name?: string }; version?: string }>;
      };
      const queries = (parsed.queries ?? []).map((query) => ({
        name: query.package?.name ?? '',
        version: query.version ?? '',
      }));
      bodies.push(queries);
      batchCall += 1;
      const result = options.batch ? options.batch(queries, batchCall) : undefined;
      if (result instanceof Error) throw result;
      if (result) return result;
      return new Response(
        JSON.stringify({ results: queries.map(() => ({})) }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.includes('/v1/vulns/')) {
      const id = decodeURIComponent(url.slice(url.indexOf('/v1/vulns/') + '/v1/vulns/'.length));
      const result = options.detail ? options.detail(id) : undefined;
      if (result instanceof Error) throw result;
      if (result) return result;
      return new Response(JSON.stringify({ id, aliases: [], summary: `Ringkasan ${id}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    throw new Error(`URL OSV tidak dikenal: ${url}`);
  };

  return { fetchImpl, calls, bodies };
}

function batchResponse(vulnsPerQuery: Array<Array<{ id: string; modified?: string }>>): Response {
  return new Response(
    JSON.stringify({
      results: vulnsPerQuery.map((vulns) => ({
        vulns: vulns.map((vuln) => ({ id: vuln.id, modified: vuln.modified ?? '' })),
      })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

const noSleep = async (): Promise<void> => undefined;

const PACKAGES: OsvPackageInput[] = [
  { name: 'lodash', version: '4.17.15', direct: true },
  { name: 'express', version: '4.18.2', direct: false },
];

test('chunk OSV menyimpan hasil ke cache termasuk hasil negatif', async () => {
  const store = createMemoryOsvCacheStore();
  const fake = makeFakeOsv({
    batch: (queries) =>
      batchResponse(
        queries.map((query) =>
          query.name === 'lodash'
            ? [{ id: 'GHSA-29mw-wpgm-hmr9', modified: '2026-11-01T00:00:00Z' }]
            : [],
        ),
      ),
    detail: (id) =>
      new Response(
        JSON.stringify({
          id,
          aliases: ['CVE-2020-28500'],
          summary: 'ReDoS pada lodash',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  });

  const result = await enrichWithOsv(PACKAGES, {
    store,
    fetchImpl: fake.fetchImpl,
    sleep: noSleep,
    now: () => Date.parse('2026-11-10T00:00:00Z'),
  });

  assert.equal(result.packageResults.length, 2);
  assert.equal(result.cacheHits, 0);
  assert.equal(result.cacheMisses, 2);
  assert.equal(result.batchRequests, 1);
  assert.equal(result.detailRequests, 1);
  assert.equal(result.partial, false);
  assert.equal(result.sourceStatus, 'OK');

  assert.ok(store.records.has(osvPackageCacheKey('lodash', '4.17.15')));
  assert.ok(store.records.has(osvPackageCacheKey('express', '4.18.2')));
  assert.ok(store.records.has(osvAdvisoryCacheKey('GHSA-29mw-wpgm-hmr9')));

  const expressPayload = store.records.get(osvPackageCacheKey('express', '4.18.2'))?.payload as {
    vulns: unknown[];
  };
  assert.deepEqual(expressPayload.vulns, []);
  assert.equal(result.advisories['GHSA-29mw-wpgm-hmr9']?.aliases?.[0], 'CVE-2020-28500');
});

test('scan kedua memakai cache paket dan detail tanpa memanggil OSV', async () => {
  const store = createMemoryOsvCacheStore();
  const fake = makeFakeOsv({
    batch: (queries) => batchResponse(queries.map(() => [{ id: 'GHSA-aaaa-bbbb-cccc' }])),
  });
  const options = {
    store,
    fetchImpl: fake.fetchImpl,
    sleep: noSleep,
    now: () => Date.parse('2026-11-10T00:00:00Z'),
  };

  await enrichWithOsv(PACKAGES, options);
  const callsAfterFirst = fake.calls.length;
  assert.ok(callsAfterFirst > 0);

  const second = await enrichWithOsv(PACKAGES, options);
  assert.equal(fake.calls.length, callsAfterFirst, 'tidak boleh ada panggilan OSV baru');
  assert.equal(second.cacheHits, 2);
  assert.equal(second.batchRequests, 0);
  assert.equal(second.detailRequests, 0);
  assert.equal(second.detailCacheHits, 1);
  assert.equal(second.sourceStatus, 'CACHE');
  assert.equal(second.partial, false);
});

test('cache kedaluwarsa setelah TTL memicu query ulang', async () => {
  const store = createMemoryOsvCacheStore([
    {
      cacheKey: osvPackageCacheKey('lodash', '4.17.15'),
      payload: { vulns: [] },
      fetchedAt: '2026-11-08T00:00:00.000Z',
    },
  ]);
  const fake = makeFakeOsv({
    batch: (queries) =>
      batchResponse(queries.map((query) => (query.name === 'lodash' ? [{ id: 'GHSA-1' }] : []))),
  });

  const result = await enrichWithOsv([{ name: 'lodash', version: '4.17.15' }], {
    store,
    fetchImpl: fake.fetchImpl,
    sleep: noSleep,
    now: () => Date.parse('2026-11-10T00:00:01Z'),
  });

  assert.equal(result.cacheHits, 0);
  assert.equal(result.cacheMisses, 1);
  assert.equal(result.batchRequests, 1);
  assert.deepEqual(
    result.packageResults[0]?.vulns.map((vuln) => vuln.id),
    ['GHSA-1'],
  );
});

test('query dibagi per chunk 50', async () => {
  const packages = Array.from({ length: 51 }, (_, index) => ({
    name: `paket-${index}`,
    version: '1.0.0',
  }));
  const fake = makeFakeOsv({ batch: (queries) => batchResponse(queries.map(() => [])) });

  const result = await enrichWithOsv(packages, {
    store: createMemoryOsvCacheStore(),
    fetchImpl: fake.fetchImpl,
    sleep: noSleep,
  });

  assert.equal(result.batchRequests, 2);
  assert.deepEqual([0, 1].map((index) => fake.bodies[index]?.length), [50, 1]);
});

test('429 dan 5xx diulang maksimum 2 kali dengan backoff', async () => {
  const sleeps: number[] = [];
  const store = createMemoryOsvCacheStore();
  const fake = makeFakeOsv({
    batch: (queries, call) => {
      if (call === 1) return new Response('rate limited', { status: 429 });
      if (call === 2) return new Response('server error', { status: 503 });
      return batchResponse(queries.map(() => []));
    },
  });

  const result = await enrichWithOsv([{ name: 'lodash', version: '4.17.15' }], {
    store,
    fetchImpl: fake.fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });

  assert.equal(fake.calls.length, 3);
  assert.deepEqual(sleeps, [250, 500]);
  assert.equal(result.partial, false);
});

test('kegagalan OSV total menjadi ScanError 502', async () => {
  const fake = makeFakeOsv({ batch: () => new Response('down', { status: 500 }) });

  await assert.rejects(
    enrichWithOsv(PACKAGES, {
      store: createMemoryOsvCacheStore(),
      fetchImpl: fake.fetchImpl,
      sleep: noSleep,
    }),
    (error: unknown) => {
      assert.ok(error instanceof ScanError);
      assert.equal(error.code, 'UPSTREAM_UNAVAILABLE');
      assert.equal(error.status, 502);
      return true;
    },
  );
});

test('kegagalan sebagian chunk menjadi warning dan parsial', async () => {
  const packages = Array.from({ length: 51 }, (_, index) => ({
    name: `paket-${index}`,
    version: '1.0.0',
  }));
  const fake = makeFakeOsv({
    batch: (queries) =>
      queries.length === 50
        ? batchResponse(queries.map(() => []))
        : new Response('down', { status: 502 }),
  });

  const result = await enrichWithOsv(packages, {
    store: createMemoryOsvCacheStore(),
    fetchImpl: fake.fetchImpl,
    sleep: noSleep,
  });

  assert.equal(result.partial, true);
  assert.equal(result.sourceStatus, 'PARTIAL');
  assert.ok(result.warnings.some((warning) => warning.code === 'OSV_PARTIAL'));
  assert.equal(result.packageResults.length, 50);
});

test('detail advisory gagal sebagian menghasilkan warning, bukan kehilangan semua temuan', async () => {
  const fake = makeFakeOsv({
    batch: (queries) =>
      batchResponse(queries.map(() => [{ id: 'GHSA-ok' }, { id: 'GHSA-gagal' }])),
    detail: (id) =>
      id === 'GHSA-gagal'
        ? new Response('not found', { status: 404 })
        : new Response(JSON.stringify({ id, aliases: ['CVE-2021-0001'] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
  });

  const result = await enrichWithOsv([{ name: 'lodash', version: '4.17.15' }], {
    store: createMemoryOsvCacheStore(),
    fetchImpl: fake.fetchImpl,
    sleep: noSleep,
  });

  assert.equal(result.partial, true);
  assert.equal(result.detailRequests, 2);
  assert.ok(result.advisories['GHSA-ok']);
  assert.equal(result.advisories['GHSA-gagal'], undefined);
  assert.ok(result.warnings.some((warning) => warning.code === 'OSV_DETAIL_PARTIAL'));
});

test('kegagalan cache baca/tulis tidak menggagalkan scan', async () => {
  const store = {
    async getMany() {
      throw new Error('db mati');
    },
    async upsert() {
      throw new Error('db mati');
    },
  };
  const fake = makeFakeOsv({ batch: (queries) => batchResponse(queries.map(() => [])) });

  const result = await enrichWithOsv([{ name: 'lodash', version: '4.17.15' }], {
    store,
    fetchImpl: fake.fetchImpl,
    sleep: noSleep,
  });

  assert.equal(result.partial, true);
  assert.ok(result.warnings.some((warning) => warning.code === 'OSV_CACHE_READ_FAILED'));
  assert.ok(result.warnings.some((warning) => warning.code === 'OSV_CACHE_WRITE_FAILED'));
});
