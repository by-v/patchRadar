import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  KEV_FEED_URL,
  loadKevCatalog,
  mapKevFeed,
  type KevFeed,
} from './kev.ts';
import { createMemoryKevStore, type KevEntryRecord } from './store.ts';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const noSleep = async (): Promise<void> => undefined;

function feed(overrides: Partial<KevFeed> = {}): KevFeed {
  return {
    catalogVersion: '2026.11.06',
    dateReleased: '2026-11-06T19:44:45Z',
    count: 2,
    vulnerabilities: [
      {
        cveID: 'CVE-2021-44228',
        vendorProject: 'Apache',
        product: 'Log4j',
        vulnerabilityName: 'Apache Log4j RCE',
        dateAdded: '2021-12-10',
        knownRansomwareCampaignUse: 'Known',
        shortDescription: 'Remote code execution.',
        requiredAction: 'Apply updates.',
        dueDate: '2021-12-24',
      },
      {
        cveID: 'CVE-2022-0001',
        vendorProject: 'Contoh',
        product: 'Produk',
        vulnerabilityName: 'Contoh kerentanan',
        dateAdded: '2022-01-01',
        knownRansomwareCampaignUse: 'Unknown',
      },
    ],
    ...overrides,
  };
}

function kevRow(overrides: Partial<KevEntryRecord> = {}): KevEntryRecord {
  return {
    cveId: 'CVE-2021-44228',
    vendor: 'Apache',
    product: 'Log4j',
    name: 'Apache Log4j RCE',
    dateAdded: '2021-12-10',
    knownRansomware: true,
    raw: { cveID: 'CVE-2021-44228' },
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...overrides,
  };
}

function fakeFetch(handler: (url: string, call: number) => Response | Error): {
  fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
  calls: string[];
} {
  const calls: string[] = [];
  const fetchImpl = async (url: string): Promise<Response> => {
    calls.push(url);
    const result = handler(url, calls.length);
    if (result instanceof Error) throw result;
    return result;
  };
  return { fetchImpl, calls };
}

test('feed dipetakan memakai nama field asli dan hanya Known menjadi true', () => {
  const rows = mapKevFeed(feed(), '2026-11-10T12:00:00.000Z');

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    cveId: 'CVE-2021-44228',
    vendor: 'Apache',
    product: 'Log4j',
    name: 'Apache Log4j RCE',
    dateAdded: '2021-12-10',
    knownRansomware: true,
    raw: (feed().vulnerabilities as unknown[])[0],
    updatedAt: '2026-11-10T12:00:00.000Z',
  });
  assert.equal(rows[1]?.knownRansomware, false);
});

test('feed dengan entri ganda, tanpa cveID, dan bukan objek dilewati aman', () => {
  const rows = mapKevFeed(
    {
      vulnerabilities: [
        { cveID: 'CVE-2021-44228' },
        { cveID: 'CVE-2021-44228' },
        { cveID: '' },
        null,
        'bukan objek',
        { cveID: 'CVE-2022-0001' },
      ],
    },
    '2026-11-10T12:00:00.000Z',
  );
  assert.deepEqual(rows.map((row) => row.cveId), ['CVE-2021-44228', 'CVE-2022-0001']);
});

test('salinan masih < 24 jam dipakai tanpa refresh', async () => {
  const store = createMemoryKevStore([kevRow()]);
  const fake = fakeFetch(() => {
    throw new Error('fetch tidak boleh dipanggil');
  });

  const result = await loadKevCatalog({
    store,
    fetchImpl: fake.fetchImpl,
    now: () => NOW,
    sleep: noSleep,
  });

  assert.equal(result.sourceStatus, 'CACHE');
  assert.equal(result.refreshed, false);
  assert.equal(fake.calls.length, 0);
  assert.deepEqual(result.entries.map((entry) => entry.cveId), ['CVE-2021-44228']);
});

test('salinan > 24 jam memicu tepat satu refresh dan mengganti katalog', async () => {
  const store = createMemoryKevStore([kevRow({ updatedAt: '2026-11-08T00:00:00.000Z' })]);
  const fake = fakeFetch(() =>
    new Response(JSON.stringify(feed()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );

  const result = await loadKevCatalog({
    store,
    fetchImpl: fake.fetchImpl,
    now: () => NOW,
    sleep: noSleep,
  });

  assert.equal(result.sourceStatus, 'OK');
  assert.equal(result.refreshed, true);
  assert.equal(store.replaceCalls, 1);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0], KEV_FEED_URL);
  assert.deepEqual([...store.entries.keys()].sort(), ['CVE-2021-44228', 'CVE-2022-0001']);
  assert.equal(store.entries.get('CVE-2022-0001')?.knownRansomware, false);
});

test('refresh gagal dengan salinan lama menghasilkan STALE tanpa crash', async () => {
  const store = createMemoryKevStore([kevRow({ updatedAt: '2026-11-08T00:00:00.000Z' })]);
  const fake = fakeFetch(() => new Response('down', { status: 500 }));

  const result = await loadKevCatalog({
    store,
    fetchImpl: fake.fetchImpl,
    now: () => NOW,
    sleep: noSleep,
  });

  assert.equal(result.sourceStatus, 'STALE');
  assert.equal(result.refreshed, false);
  assert.equal(fake.calls.length, 3, 'maksimum 2 retry untuk 5xx');
  assert.deepEqual(result.entries.map((entry) => entry.cveId), ['CVE-2021-44228']);
  assert.ok(result.warnings.some((warning) => warning.code === 'KEV_STALE'));
});

test('belum ada salinan dan refresh gagal tetap mengembalikan katalog kosong', async () => {
  const store = createMemoryKevStore();
  const fake = fakeFetch(() => new Error('jaringan mati'));

  const result = await loadKevCatalog({
    store,
    fetchImpl: fake.fetchImpl,
    now: () => NOW,
    sleep: noSleep,
  });

  assert.equal(result.sourceStatus, 'EMPTY');
  assert.deepEqual(result.entries, []);
  assert.ok(result.warnings.some((warning) => warning.code === 'KEV_UNAVAILABLE'));
});

test('katalog belum ada dan refresh berhasil menjadi OK', async () => {
  const store = createMemoryKevStore();
  const fake = fakeFetch(() =>
    new Response(JSON.stringify(feed()), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );

  const result = await loadKevCatalog({
    store,
    fetchImpl: fake.fetchImpl,
    now: () => NOW,
    sleep: noSleep,
  });

  assert.equal(result.sourceStatus, 'OK');
  assert.equal(result.entries.length, 2);
  assert.ok(result.timings.stages.some((stage) => stage.name === 'kev.parse' && stage.async === false));
});

test('katalog kosong tanpa refresh (feed kosong) tetap tidak crash', async () => {
  const store = createMemoryKevStore();
  const fake = fakeFetch(() =>
    new Response(JSON.stringify({ vulnerabilities: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );

  const result = await loadKevCatalog({
    store,
    fetchImpl: fake.fetchImpl,
    now: () => NOW,
    sleep: noSleep,
  });

  assert.equal(result.sourceStatus, 'OK');
  assert.deepEqual(result.entries, []);
});
