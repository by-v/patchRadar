import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  createSupabaseOsvCacheStore,
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
