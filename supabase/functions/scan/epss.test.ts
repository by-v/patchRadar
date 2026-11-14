import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  EPSS_CACHE_TTL_MS,
  EPSS_LIMIT,
  EPSS_MAX_CVES_PER_REQUEST,
  epssForCves,
  fetchEpssScores,
} from './epss.ts';
import { createMemoryEpssCacheStore, type EpssCacheRecord } from './store.ts';

interface FakeEpss {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  urls: string[];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function cvesFromUrl(url: string): string[] {
  const raw = new URL(url).searchParams.get('cve');
  if (!raw) return [];
  return raw.split(',').filter(Boolean);
}

function successFetch(): FakeEpss {
  const urls: string[] = [];
  return {
    urls,
    async fetchImpl(url) {
      urls.push(url);
      const cves = cvesFromUrl(url);
      return jsonResponse({
        total: cves.length,
        data: cves.map((cve) => ({ cve, epss: '0.42', percentile: '0.97' })),
      });
    },
  };
}

test('EPSS mengirim cve dan limit eksplisit serta memetakan skor', async () => {
  const fake = successFetch();
  const result = await fetchEpssScores(['CVE-2099-0002', 'CVE-2099-0001'], {
    fetchImpl: fake.fetchImpl,
  });

  assert.equal(result.partial, false);
  assert.equal(result.sourceStatus, 'OK');
  assert.equal(result.requests, 1);
  assert.equal(result.warnings.length, 0);

  const url = new URL(fake.urls[0]!);
  // Regresi 12 Nov 2026: beberapa CVE harus dalam SATU parameter `cve`
  // dipisah koma; mengulang `cve` hanya mengembalikan CVE terakhir.
  assert.equal(url.searchParams.getAll('cve').length, 1);
  assert.deepEqual(url.searchParams.get('cve')?.split(','), ['CVE-2099-0001', 'CVE-2099-0002']);
  assert.equal(url.searchParams.get('limit'), String(EPSS_LIMIT));

  assert.deepEqual(result.scores.get('CVE-2099-0001'), {
    cveId: 'CVE-2099-0001',
    epss: 0.42,
    percentile: 0.97,
    available: true,
  });
});

test('beberapa CVE dikirim sebagai satu parameter cve dipisah koma', async () => {
  const fake = successFetch();
  await fetchEpssScores(['CVE-2099-0001', 'CVE-2099-0002', 'CVE-2099-0003'], {
    fetchImpl: fake.fetchImpl,
  });

  const url = new URL(fake.urls[0]!);
  assert.equal(url.searchParams.getAll('cve').length, 1);
  assert.equal(url.searchParams.get('cve'), 'CVE-2099-0001,CVE-2099-0002,CVE-2099-0003');
});

test('CVE tanpa skor di respons campuran menjadi null, bukan 0', async () => {
  const fake: FakeEpss = {
    urls: [],
    async fetchImpl(url) {
      fake.urls.push(url);
      const cves = cvesFromUrl(url);
      return jsonResponse({
        total: 1,
        data: [{ cve: cves[0], epss: '0.1', percentile: '0.8' }],
      });
    },
  };

  const result = await fetchEpssScores(['CVE-2099-0001', 'CVE-2099-0002'], {
    fetchImpl: fake.fetchImpl,
  });

  assert.equal(result.partial, false);
  assert.equal(result.scores.get('CVE-2099-0001')?.epss, 0.1);
  assert.deepEqual(result.scores.get('CVE-2099-0002'), {
    cveId: 'CVE-2099-0002',
    epss: null,
    percentile: null,
    available: false,
  });
  assert.deepEqual(epssForCves(['CVE-2099-0001', 'CVE-2099-0002'], result.scores), {
    epss: 0.1,
    epssPercentile: 0.8,
    epssAvailable: true,
  });
});

test('respons total=0/data=[] untuk permintaan tidak kosong dianggap gagal', async () => {
  const fake: FakeEpss = {
    urls: [],
    async fetchImpl(url) {
      fake.urls.push(url);
      return jsonResponse({ total: 0, data: [] });
    },
  };

  const result = await fetchEpssScores(['CVE-2099-0001'], { fetchImpl: fake.fetchImpl });

  assert.equal(result.partial, true);
  assert.equal(result.sourceStatus, 'FAILED');
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]!.code, 'EPSS_UNAVAILABLE');
  assert.equal(result.scores.get('CVE-2099-0001')?.epss, null);
  assert.equal(result.scores.get('CVE-2099-0001')?.available, false);
});

test('lebih dari 100 CVE dipecah menjadi beberapa request', async () => {
  const fake = successFetch();
  const cves = Array.from({ length: 150 }, (_, index) => `CVE-2099-${String(index + 1).padStart(4, '0')}`);

  const result = await fetchEpssScores(cves, { fetchImpl: fake.fetchImpl });

  assert.equal(fake.urls.length, 2);
  assert.equal(cvesFromUrl(fake.urls[0]!).length, EPSS_MAX_CVES_PER_REQUEST);
  assert.equal(cvesFromUrl(fake.urls[1]!).length, 50);
  assert.equal(result.requests, 2);
  assert.equal(result.partial, false);
  assert.equal(result.scores.size, 150);
  for (const cve of cves) assert.equal(result.scores.get(cve)?.available, true);
});

test('timeout memakai AbortController dan menjadi parsial, bukan crash', async () => {
  let calls = 0;
  const hangingFetch = (_url: string, init?: RequestInit): Promise<Response> => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
  };

  const result = await fetchEpssScores(['CVE-2099-0001'], {
    fetchImpl: hangingFetch,
    timeoutMs: 5,
    maxRetries: 0,
    sleep: async () => undefined,
  });

  assert.equal(calls, 1);
  assert.equal(result.partial, true);
  assert.equal(result.sourceStatus, 'FAILED');
  assert.equal(result.warnings[0]!.code, 'EPSS_UNAVAILABLE');
});

test('retry terbatas dilakukan saat 5xx', async () => {
  let calls = 0;
  const retryFetch = async (url: string): Promise<Response> => {
    calls += 1;
    if (calls === 1) return new Response(null, { status: 503 });
    const cves = cvesFromUrl(url);
    return jsonResponse({
      total: cves.length,
      data: cves.map((cve) => ({ cve, epss: '0.5', percentile: '0.9' })),
    });
  };

  const result = await fetchEpssScores(['CVE-2099-0001'], {
    fetchImpl: retryFetch,
    maxRetries: 1,
    sleep: async () => undefined,
  });

  assert.equal(calls, 2);
  assert.equal(result.partial, false);
  assert.equal(result.scores.get('CVE-2099-0001')?.epss, 0.5);
});

test('tanpa CVE tidak memanggil jaringan', async () => {
  let calls = 0;
  const result = await fetchEpssScores([], {
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({ total: 0, data: [] });
    },
  });

  assert.equal(calls, 0);
  assert.equal(result.requests, 0);
  assert.equal(result.sourceStatus, 'OK');
  assert.equal(result.partial, false);
  assert.equal(result.scores.size, 0);
});

const NOW = Date.parse('2026-11-14T12:00:00.000Z');

function cacheRecord(
  cveId: string,
  epss: number | null,
  fetchedAt = new Date(NOW - 60_000).toISOString(),
): EpssCacheRecord {
  return { cveId, epss, percentile: epss === null ? null : 0.9, fetchedAt };
}

test('CVE yang masih segar di cache tidak memanggil EPSS', async () => {
  const store = createMemoryEpssCacheStore([
    cacheRecord('CVE-2099-0001', 0.4),
    cacheRecord('CVE-2099-0002', null),
  ]);
  const fake = successFetch();
  const result = await fetchEpssScores(['CVE-2099-0001', 'CVE-2099-0002'], {
    fetchImpl: fake.fetchImpl,
    store,
    now: () => NOW,
  });

  assert.equal(fake.urls.length, 0);
  assert.equal(result.requests, 0);
  assert.equal(result.sourceStatus, 'CACHE');
  assert.equal(result.partial, false);
  assert.deepEqual(result.scores.get('CVE-2099-0001'), {
    cveId: 'CVE-2099-0001',
    epss: 0.4,
    percentile: 0.9,
    available: true,
  });
  // Cache negatif tetap "tidak tersedia" dan tidak dianggap gagal.
  assert.equal(result.scores.get('CVE-2099-0002')?.available, false);
  assert.equal(result.warnings.length, 0);
});

test('cache campuran hanya meminta CVE yang miss dan menulis hasilnya', async () => {
  const store = createMemoryEpssCacheStore([cacheRecord('CVE-2099-0001', 0.4)]);
  const fake = successFetch();
  const result = await fetchEpssScores(
    ['CVE-2099-0001', 'CVE-2099-0002', 'CVE-2099-0003'],
    { fetchImpl: fake.fetchImpl, store, now: () => NOW },
  );

  assert.equal(fake.urls.length, 1);
  assert.deepEqual(cvesFromUrl(fake.urls[0]!), ['CVE-2099-0002', 'CVE-2099-0003']);
  assert.equal(result.requests, 1);
  assert.equal(result.sourceStatus, 'OK');
  assert.equal(store.writes.length, 2);
  assert.deepEqual(
    store.writes.map((record) => record.cveId).sort(),
    ['CVE-2099-0002', 'CVE-2099-0003'],
  );
  assert.equal(result.scores.get('CVE-2099-0001')?.epss, 0.4);
  assert.equal(result.scores.get('CVE-2099-0002')?.epss, 0.42);
});

test('cache kedaluwarsa diambil ulang dan ditimpa', async () => {
  const store = createMemoryEpssCacheStore([
    cacheRecord('CVE-2099-0001', 0.01, new Date(NOW - EPSS_CACHE_TTL_MS - 1).toISOString()),
  ]);
  const fake = successFetch();
  const result = await fetchEpssScores(['CVE-2099-0001'], {
    fetchImpl: fake.fetchImpl,
    store,
    now: () => NOW,
  });

  assert.equal(fake.urls.length, 1);
  assert.equal(result.requests, 1);
  assert.equal(result.scores.get('CVE-2099-0001')?.epss, 0.42);
  assert.equal(store.records.get('CVE-2099-0001')?.epss, 0.42);
  assert.equal(store.records.get('CVE-2099-0001')?.fetchedAt, new Date(NOW).toISOString());
});

test('sumber gagal memakai cache kedaluwarsa sebagai fallback dan parsial', async () => {
  const store = createMemoryEpssCacheStore([
    cacheRecord('CVE-2099-0001', 0.33, new Date(NOW - EPSS_CACHE_TTL_MS - 1).toISOString()),
  ]);
  const result = await fetchEpssScores(['CVE-2099-0001'], {
    fetchImpl: async () => jsonResponse({ total: 0, data: [] }),
    store,
    now: () => NOW,
  });

  assert.equal(result.partial, true);
  assert.equal(result.sourceStatus, 'PARTIAL');
  assert.equal(result.scores.get('CVE-2099-0001')?.epss, 0.33);
  assert.equal(result.scores.get('CVE-2099-0001')?.available, true);
  assert.ok(result.warnings.some((warning) => warning.code === 'EPSS_UNAVAILABLE'));
  assert.equal(store.writes.length, 0);
});

test('kegagalan baca cache tidak menggagalkan scan', async () => {
  const failingStore = {
    async getMany(): Promise<Map<string, EpssCacheRecord>> {
      throw new Error('tabel epss_cache tidak ada');
    },
    async upsert(): Promise<void> {
      throw new Error('tabel epss_cache tidak ada');
    },
  };
  const fake = successFetch();
  const result = await fetchEpssScores(['CVE-2099-0001'], {
    fetchImpl: fake.fetchImpl,
    store: failingStore,
    now: () => NOW,
  });

  assert.equal(fake.urls.length, 1);
  assert.equal(result.partial, false);
  assert.equal(result.sourceStatus, 'OK');
  assert.equal(result.scores.get('CVE-2099-0001')?.epss, 0.42);
  const codes = result.warnings.map((warning) => warning.code).sort();
  assert.deepEqual(codes, ['EPSS_CACHE_READ_FAILED', 'EPSS_CACHE_WRITE_FAILED']);
});

test('hasil kosong tetap ditulis ke cache sebagai cache negatif', async () => {
  const store = createMemoryEpssCacheStore();
  const result = await fetchEpssScores(['CVE-2099-0001', 'CVE-2099-0002'], {
    fetchImpl: async (url) => {
      const cves = cvesFromUrl(url);
      return jsonResponse({
        total: 1,
        data: [{ cve: cves[0], epss: '0.2', percentile: '0.7' }],
      });
    },
    store,
    now: () => NOW,
  });

  assert.equal(store.writes.length, 2);
  const negative = store.records.get('CVE-2099-0002');
  assert.equal(negative?.epss, null);
  assert.equal(negative?.percentile, null);
  assert.equal(result.scores.get('CVE-2099-0002')?.available, false);
});
