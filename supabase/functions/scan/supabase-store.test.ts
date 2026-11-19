import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createSupabaseEpssCacheStore,
  createSupabaseOsvCacheStore,
  createSupabaseRateLimitStore,
  createSupabaseRetentionStore,
  createSupabaseScanStore,
  EPSS_CACHE_READ_BATCH_SIZE,
  OSV_CACHE_READ_BATCH_SIZE,
} from './supabase-store.ts';
import type { FindingRecord, ScanRecord } from './store.ts';

function keysInUrl(url: string): string[] {
  const value = new URL(url).searchParams.get('cache_key') ?? '';
  const inner = value.slice('in.('.length, -1);
  if (!inner) return [];
  return inner.slice(1, -1).split('","');
}

test('getMany memecah kunci menjadi batch kecil dan menggabungkan hasil', async () => {
  const urls: string[] = [];
  const store = createSupabaseOsvCacheStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async (url) => {
      urls.push(url);
      const keys = keysInUrl(url);
      return new Response(
        JSON.stringify(
          keys.map((key) => ({
            cache_key: key,
            payload: { vulns: [] },
            fetched_at: '2026-11-10T00:00:00.000Z',
          })),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const keys = Array.from({ length: 250 }, (_, index) => `npm:paket-${index}@1.0.0`);
  const result = await store.getMany(keys);

  assert.equal(result.size, 250);
  assert.equal(urls.length, Math.ceil(250 / OSV_CACHE_READ_BATCH_SIZE));
  for (const url of urls) {
    assert.ok(new URL(url).href.length < 8_000, 'URL batch harus jauh di bawah batas runtime');
    assert.ok(keysInUrl(url).length <= OSV_CACHE_READ_BATCH_SIZE);
  }
  assert.equal(result.get('npm:paket-0@1.0.0')?.cacheKey, 'npm:paket-0@1.0.0');
});

test('getMany menghentikan pembacaan saat satu batch gagal', async () => {
  let calls = 0;
  const store = createSupabaseOsvCacheStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async () => {
      calls += 1;
      return new Response('gagal', { status: 500 });
    },
  });

  const keys = Array.from({ length: 250 }, (_, index) => `npm:paket-${index}@1.0.0`);
  await assert.rejects(() => store.getMany(keys), /osv_cache GET gagal \(500\)/);
  assert.equal(calls, 1);
});

test('getMany tanpa kunci tidak memanggil jaringan', async () => {
  let calls = 0;
  const store = createSupabaseOsvCacheStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async () => {
      calls += 1;
      return new Response('[]', { status: 200 });
    },
  });

  const result = await store.getMany([]);
  assert.equal(result.size, 0);
  assert.equal(calls, 0);
});

test('cacheReadBatchSize dapat diatur untuk pengujian', async () => {
  const urlLengths: number[] = [];
  const store = createSupabaseOsvCacheStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    cacheReadBatchSize: 2,
    fetchImpl: async (url) => {
      urlLengths.push(new URL(url).href.length);
      const keys = keysInUrl(url);
      return new Response(
        JSON.stringify(
          keys.map((key) => ({ cache_key: key, payload: {}, fetched_at: '2026-11-10T00:00:00.000Z' })),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const result = await store.getMany(['a', 'b', 'c']);
  assert.equal(result.size, 3);
  assert.equal(urlLengths.length, 2);
});

function cvesInUrl(url: string): string[] {
  const value = new URL(url).searchParams.get('cve_id') ?? '';
  const inner = value.slice('in.('.length, -1);
  if (!inner) return [];
  return inner.slice(1, -1).split('","');
}

test('epss getMany memecah batch, membaca numeric string, dan menyimpan null', async () => {
  const urls: string[] = [];
  const store = createSupabaseEpssCacheStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    cacheReadBatchSize: 2,
    fetchImpl: async (url) => {
      urls.push(url);
      const cves = cvesInUrl(url);
      return new Response(
        JSON.stringify(
          cves.map((cve) => ({
            cve_id: cve,
            epss: cve.endsWith('0001') ? '0.42' : null,
            percentile: cve.endsWith('0001') ? '0.97' : null,
            fetched_at: '2026-11-14T00:00:00.000Z',
          })),
        ),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const result = await store.getMany(['CVE-2099-0001', 'CVE-2099-0002', 'CVE-2099-0003']);
  assert.equal(urls.length, 2);
  assert.equal(EPSS_CACHE_READ_BATCH_SIZE, 100);
  assert.deepEqual(result.get('CVE-2099-0001'), {
    cveId: 'CVE-2099-0001',
    epss: 0.42,
    percentile: 0.97,
    fetchedAt: '2026-11-14T00:00:00.000Z',
  });
  assert.equal(result.get('CVE-2099-0002')?.epss, null);
  assert.equal(result.get('CVE-2099-0003')?.epss, null);
});

test('epss getMany melempar error pada respons non-2xx', async () => {
  const store = createSupabaseEpssCacheStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async () => new Response(null, { status: 404 }),
  });

  await assert.rejects(() => store.getMany(['CVE-2099-0001']), /epss_cache GET gagal \(404\)/);
});

test('epss upsert mengirim merge-duplicates tanpa mengembalikan baris', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = createSupabaseEpssCacheStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: 201 });
    },
  });

  await store.upsert([
    { cveId: 'CVE-2099-0001', epss: 0.42, percentile: 0.97, fetchedAt: '2026-11-14T00:00:00.000Z' },
    { cveId: 'CVE-2099-0002', epss: null, percentile: null, fetchedAt: '2026-11-14T00:00:00.000Z' },
  ]);

  assert.equal(calls.length, 1);
  const headers = calls[0]!.init?.headers as Record<string, string>;
  assert.equal(headers.prefer, 'resolution=merge-duplicates,return=minimal');
  const body = JSON.parse(String(calls[0]!.init?.body)) as unknown[];
  assert.deepEqual(body, [
    { cve_id: 'CVE-2099-0001', epss: 0.42, percentile: 0.97, fetched_at: '2026-11-14T00:00:00.000Z' },
    { cve_id: 'CVE-2099-0002', epss: null, percentile: null, fetched_at: '2026-11-14T00:00:00.000Z' },
  ]);
});

const SCAN_RECORD: ScanRecord = {
  id: '10000000-0000-4000-8000-0000000000aa',
  userId: '00000000-0000-4000-8000-0000000000aa',
  repoOwner: 'lodash',
  repoName: 'lodash',
  repoUrl: 'https://github.com/lodash/lodash',
  status: 'COMPLETED',
  manifestSource: 'LOCKFILE',
  lockfileFormat: 'v3',
  estimated: false,
  totalPackages: 27,
  affectedPackages: 1,
  findingCount: 1,
  partial: false,
  warnings: [],
  sourceStatus: { github: 'OK', osv: 'OK', kev: 'OK', epss: 'OK' },
  engineVersion: '1.0.0',
  durationMs: 120,
  createdAt: '2026-11-15T10:00:00.000Z',
};

const FINDING_RECORD: FindingRecord = {
  id: '20000000-0000-4000-8000-0000000000aa',
  scanId: SCAN_RECORD.id,
  osvId: 'GHSA-test-0001',
  cveIds: ['CVE-2026-0001'],
  packageName: 'lodash',
  installedVersion: '4.0.0',
  direct: true,
  devOnly: false,
  parentPackage: null,
  severity: 'HIGH',
  cvssScore: 7.5,
  epss: 0.5,
  epssPercentile: 0.9,
  kev: true,
  label: 'FIX_NOW',
  score: 62.5,
  reason: 'Ada di katalog KEV.',
  fixVersion: '4.17.21',
  fixCommand: 'npm install lodash@4.17.21',
  summary: 'Contoh advisory.',
  references: [{ label: 'Advisory', url: 'https://example.test/advisory' }],
};

test('ScanStore menulis scans lalu findings dengan kolom yang benar', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = createSupabaseScanStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(null, { status: 201 });
    },
  });

  await store.save(SCAN_RECORD, [FINDING_RECORD]);

  assert.equal(calls.length, 2);
  assert.ok(calls[0]!.url.endsWith('/rest/v1/scans'));
  assert.equal(calls[0]!.init?.method, 'POST');
  assert.equal(
    (calls[0]!.init?.headers as Record<string, string>).prefer,
    'return=minimal',
  );
  const scanBody = JSON.parse(String(calls[0]!.init?.body)) as Array<Record<string, unknown>>;
  assert.equal(scanBody[0]?.id, SCAN_RECORD.id);
  assert.equal(scanBody[0]?.user_id, SCAN_RECORD.userId);
  assert.equal(scanBody[0]?.engine_version, '1.0.0');

  assert.ok(calls[1]!.url.endsWith('/rest/v1/findings'));
  const findingBody = JSON.parse(String(calls[1]!.init?.body)) as Array<Record<string, unknown>>;
  assert.equal(findingBody[0]?.scan_id, SCAN_RECORD.id);
  assert.deepEqual(findingBody[0]?.cve_ids, ['CVE-2026-0001']);
  assert.equal(findingBody[0]?.fix_version, '4.17.21');
  assert.deepEqual(findingBody[0]?.references, [
    { label: 'Advisory', url: 'https://example.test/advisory' },
  ]);
});

test('kegagalan findings menghapus baris scans yang sudah masuk lalu melempar error', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = createSupabaseScanStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.endsWith('/rest/v1/findings')) return new Response(null, { status: 500 });
      return new Response(null, { status: 204 });
    },
  });

  await assert.rejects(() => store.save(SCAN_RECORD, [FINDING_RECORD]), /findings insert gagal/);
  assert.equal(calls.length, 3);
  assert.equal(calls[2]!.init?.method, 'DELETE');
  assert.ok(calls[2]!.url.includes(`scans?id=eq.${SCAN_RECORD.id}`));
});

test('RateLimitStore membaca jendela per pengguna dan mencatat scan', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const store = createSupabaseRateLimitStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (init?.method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              user_id: SCAN_RECORD.userId,
              kind: 'scan',
              created_at: '2026-11-15T09:55:00.000Z',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(null, { status: 201 });
    },
  });

  const since = '2026-11-15T09:50:00.000Z';
  const events = await store.listRecent(SCAN_RECORD.userId, 'scan', since);

  assert.deepEqual(events, [
    {
      userId: SCAN_RECORD.userId,
      kind: 'scan',
      createdAt: '2026-11-15T09:55:00.000Z',
      ipHash: null,
    },
  ]);
  const listUrl = calls[0]!.url;
  assert.ok(listUrl.includes('/rest/v1/rate_limit_events?'));
  assert.ok(listUrl.includes(`user_id=eq.${SCAN_RECORD.userId}`));
  assert.ok(listUrl.includes('kind=eq.scan'));
  assert.ok(listUrl.includes('created_at=gte.2026-11-15T09%3A50%3A00.000Z'));
  assert.ok(listUrl.includes('order=created_at.asc'));

  await store.record({
    userId: SCAN_RECORD.userId,
    kind: 'scan',
    createdAt: '2026-11-15T10:00:00.000Z',
  });
  assert.equal(calls[1]!.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[1]!.init?.body)), [
    {
      user_id: SCAN_RECORD.userId,
      kind: 'scan',
      created_at: '2026-11-15T10:00:00.000Z',
      ip_hash: null,
    },
  ]);
});

test('RateLimitStore FR-25b: listRecentByIpHash memfilter ip_hash dan menulis hash', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const ipHash = 'a'.repeat(64);
  const store = createSupabaseRateLimitStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (init?.method === 'GET') {
        return new Response(
          JSON.stringify([
            {
              user_id: SCAN_RECORD.userId,
              kind: 'scan',
              created_at: '2026-11-15T09:55:00.000Z',
              ip_hash: ipHash,
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(null, { status: 201 });
    },
  });

  const since = '2026-11-15T09:00:00.000Z';
  const events = await store.listRecentByIpHash(ipHash, 'scan', since);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.ipHash, ipHash);
  assert.ok(calls[0]!.url.includes(`ip_hash=eq.${ipHash}`));
  assert.ok(calls[0]!.url.includes('created_at=gte.2026-11-15T09%3A00%3A00.000Z'));

  await store.record({
    userId: SCAN_RECORD.userId,
    kind: 'scan',
    createdAt: '2026-11-15T10:00:00.000Z',
    ipHash,
  });
  assert.deepEqual(JSON.parse(String(calls[1]!.init?.body)), [
    {
      user_id: SCAN_RECORD.userId,
      kind: 'scan',
      created_at: '2026-11-15T10:00:00.000Z',
      ip_hash: ipHash,
    },
  ]);
});

test('RetentionStore memanggil RPC purge_old_scans dan mencatat ukuran DB', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let statsCalls = 0;
  const store = createSupabaseRetentionStore({
    url: 'https://contoh.supabase.co',
    serviceRoleKey: 'kunci-uji',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      if (url.includes('/rpc/scan_storage_stats')) {
        statsCalls += 1;
        return new Response(JSON.stringify([{ db_size_bytes: statsCalls === 1 ? 2_000 : 1_500 }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(
        JSON.stringify([{ deleted_scans: 7, deleted_findings: 9 }]),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    },
  });

  const cutoff = '2026-08-21T00:00:00.000Z';
  const result = await store.purgeOlderThan(cutoff, 500);

  assert.deepEqual(result, {
    deletedScans: 7,
    deletedFindings: 9,
    dbSizeBeforeBytes: 2_000,
    dbSizeAfterBytes: 1_500,
  });
  const purgeCall = calls.find((call) => call.url.includes('/rpc/purge_old_scans'));
  assert.ok(purgeCall);
  assert.deepEqual(JSON.parse(String(purgeCall!.init?.body)), {
    cutoff,
    max_rows: 500,
  });
  assert.equal(
    (purgeCall!.init?.headers as Record<string, string>).authorization.startsWith('Bearer '),
    true,
  );
});
