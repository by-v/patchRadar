import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  EPSS_LIMIT,
  EPSS_MAX_CVES_PER_REQUEST,
  epssForCves,
  fetchEpssScores,
} from './epss.ts';

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
