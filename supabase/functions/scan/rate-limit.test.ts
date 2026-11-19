import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScanError } from './errors.ts';
import {
  clientIpFromRequest,
  enforceIpRateLimit,
  enforceRateLimit,
  hashIp,
  RATE_LIMIT_IP_MAX_SCANS,
  RATE_LIMIT_KIND,
  RATE_LIMIT_MAX_SCANS,
  RATE_LIMIT_WINDOW_MS,
} from './rate-limit.ts';
import { createMemoryRateLimitStore, type RateLimitEventRecord } from './store.ts';

const USER = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000bb';
const NOW = Date.parse('2026-11-15T10:00:00.000Z');

function event(userId: string, msAgo: number): RateLimitEventRecord {
  return {
    userId,
    kind: RATE_LIMIT_KIND,
    createdAt: new Date(NOW - msAgo).toISOString(),
  };
}

test('lima scan diizinkan lalu scan keenam ditolak 429 dengan retryAfter', async () => {
  const store = createMemoryRateLimitStore();

  for (let index = 1; index <= RATE_LIMIT_MAX_SCANS; index += 1) {
    const decision = await enforceRateLimit({ store, userId: USER, now: () => NOW });
    assert.equal(decision.allowed, true);
  }
  assert.equal(store.events.length, RATE_LIMIT_MAX_SCANS);

  await assert.rejects(
    () => enforceRateLimit({ store, userId: USER, now: () => NOW }),
    (error: unknown) => {
      assert.ok(error instanceof ScanError);
      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.status, 429);
      assert.equal(error.retryAfter, 600);
      assert.match(error.message, /10 menit/);
      return true;
    },
  );
  assert.equal(store.events.length, RATE_LIMIT_MAX_SCANS);
});

test('jendela bergulir menerima scan lagi setelah 10 menit', async () => {
  const store = createMemoryRateLimitStore([event(USER, RATE_LIMIT_WINDOW_MS - 1_000)]);

  const now = NOW;
  const atLimit = createMemoryRateLimitStore([
    ...Array.from({ length: RATE_LIMIT_MAX_SCANS - 1 }, () => event(USER, RATE_LIMIT_WINDOW_MS - 1_000)),
    event(USER, RATE_LIMIT_WINDOW_MS - 1_000),
  ]);
  await assert.rejects(() => enforceRateLimit({ store: atLimit, userId: USER, now: () => now }));

  const later = NOW + RATE_LIMIT_WINDOW_MS;
  const decision = await enforceRateLimit({ store: atLimit, userId: USER, now: () => later });
  assert.equal(decision.allowed, true);

  // Event lama tidak dihitung lagi; hanya event baru yang tersisa dalam jendela.
  const recent = await atLimit.listRecent(
    USER,
    RATE_LIMIT_KIND,
    new Date(later - RATE_LIMIT_WINDOW_MS).toISOString(),
  );
  assert.equal(recent.length, 1);
  assert.equal(store.events.length, 1);
});

test('retryAfter mengikuti kejadian tertua yang masih di jendela', async () => {
  const store = createMemoryRateLimitStore(
    Array.from({ length: RATE_LIMIT_MAX_SCANS }, () => event(USER, 9 * 60 * 1000)),
  );

  await assert.rejects(
    () => enforceRateLimit({ store, userId: USER, now: () => NOW }),
    (error: unknown) => {
      assert.ok(error instanceof ScanError);
      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.retryAfter, 60);
      return true;
    },
  );
});

test('kuota dihitung terpisah per pengguna anonim', async () => {
  const store = createMemoryRateLimitStore(
    Array.from({ length: RATE_LIMIT_MAX_SCANS }, () => event(USER, 1_000)),
  );

  const other = await enforceRateLimit({ store, userId: OTHER, now: () => NOW });
  assert.equal(other.allowed, true);
  assert.equal(store.events.at(-1)?.userId, OTHER);
});

test('scan yang diizinkan mencatat user_id dan kind yang benar', async () => {
  const store = createMemoryRateLimitStore();

  await enforceRateLimit({ store, userId: USER, now: () => NOW });

  assert.deepEqual(store.events, [
    { userId: USER, kind: RATE_LIMIT_KIND, createdAt: new Date(NOW).toISOString(), ipHash: null },
  ]);
});

test('FR-25b: hash IP disimpan pada kejadian dan tidak berisi IP mentah', async () => {
  const store = createMemoryRateLimitStore();
  const ip = '203.0.113.7';
  const ipHash = await hashIp(ip, 'garam-rahasia');

  assert.ok(ipHash);
  assert.equal(ipHash!.length, 64);
  assert.notEqual(ipHash, ip);

  await enforceRateLimit({ store, userId: USER, ipHash, now: () => NOW });

  assert.equal(store.events[0]!.ipHash, ipHash);
  assert.ok(!JSON.stringify(store.events).includes(ip));
});

test('FR-25b: dua akun berbeda dari IP yang sama ditolak setelah 20 scan/jam', async () => {
  const store = createMemoryRateLimitStore();
  const ipHash = await hashIp('198.51.100.9', 'garam');
  const first = '00000000-0000-4000-8000-000000000101';
  const second = '00000000-0000-4000-8000-000000000102';
  const users = [
    first,
    second,
    '00000000-0000-4000-8000-000000000103',
    '00000000-0000-4000-8000-000000000104',
  ];

  for (let index = 0; index < RATE_LIMIT_IP_MAX_SCANS; index += 1) {
    const userId = users[index % users.length]!;
    const decision = await enforceIpRateLimit({ store, ipHash: ipHash!, now: () => NOW });
    assert.equal(decision.allowed, true);
    await enforceRateLimit({ store, userId, ipHash, now: () => NOW });
  }

  await assert.rejects(
    () => enforceIpRateLimit({ store, ipHash: ipHash!, now: () => NOW }),
    (error: unknown) => {
      assert.ok(error instanceof ScanError);
      assert.equal(error.code, 'RATE_LIMITED');
      assert.equal(error.retryAfter, 3_600);
      return true;
    },
  );
});

test('FR-25b: garam kosong menonaktifkan hash tanpa mengubah FR-25a', async () => {
  assert.equal(await hashIp('203.0.113.7', ''), null);

  const store = createMemoryRateLimitStore();
  for (let index = 0; index < RATE_LIMIT_MAX_SCANS; index += 1) {
    await enforceRateLimit({ store, userId: USER, ipHash: null, now: () => NOW });
  }
  await assert.rejects(
    () => enforceRateLimit({ store, userId: USER, ipHash: null, now: () => NOW }),
    (error: unknown) => {
      assert.ok(error instanceof ScanError);
      assert.equal(error.code, 'RATE_LIMITED');
      return true;
    },
  );
  assert.ok(store.events.every((item) => item.ipHash === null));
});

test('clientIpFromRequest membaca x-forwarded-for lalu header alternatif', () => {
  assert.equal(
    clientIpFromRequest(new Request('https://contoh.test', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    })),
    '203.0.113.7',
  );
  assert.equal(
    clientIpFromRequest(new Request('https://contoh.test', {
      headers: { 'x-real-ip': '198.51.100.2' },
    })),
    '198.51.100.2',
  );
  assert.equal(clientIpFromRequest(new Request('https://contoh.test')), null);
});
