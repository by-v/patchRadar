import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createSupabaseEpssCacheStore,
  createSupabaseOsvCacheStore,
  EPSS_CACHE_READ_BATCH_SIZE,
  OSV_CACHE_READ_BATCH_SIZE,
} from './supabase-store.ts';

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
