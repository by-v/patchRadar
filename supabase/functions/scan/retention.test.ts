import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  resetRetentionThrottle,
  RETENTION_DAYS,
  RETENTION_INTERVAL_MS,
  RETENTION_MAX_ROWS,
  runLazyRetention,
} from './retention.ts';
import { createMemoryRetentionStore } from './store.ts';

const NOW = Date.parse('2026-11-19T10:00:00.000Z');

test('retensi menghapus dengan cutoff 90 hari dan batas baris per panggilan', async () => {
  resetRetentionThrottle();
  const store = createMemoryRetentionStore({ deletedScans: 12 });
  const run = await runLazyRetention({ store, now: () => NOW, force: true });

  assert.ok(run);
  assert.equal(run!.days, RETENTION_DAYS);
  assert.equal(run!.cutoffIso, new Date(NOW - 90 * 24 * 60 * 60 * 1000).toISOString());
  assert.deepEqual(store.purges, [{ cutoffIso: run!.cutoffIso, limit: RETENTION_MAX_ROWS }]);
  assert.equal(run!.deletedScans, 12);
  assert.equal(run!.deletedFindings, 12);
});

test('retensi di-throttle sekali per jam tanpa cron', async () => {
  resetRetentionThrottle();
  const store = createMemoryRetentionStore();

  const first = await runLazyRetention({ store, now: () => NOW });
  assert.ok(first);

  const skipped = await runLazyRetention({ store, now: () => NOW + 1_000 });
  assert.equal(skipped, null);
  assert.equal(store.purges.length, 1);

  const later = await runLazyRetention({ store, now: () => NOW + RETENTION_INTERVAL_MS });
  assert.ok(later);
  assert.equal(store.purges.length, 2);
});

test('kegagalan retensi tidak melempar dan mengembalikan null', async () => {
  resetRetentionThrottle();
  const store = createMemoryRetentionStore();
  store.failWith = new Error('db sibuk');

  const run = await runLazyRetention({ store, now: () => NOW, force: true });
  assert.equal(run, null);
});

test('retensi mencatat ukuran database sebelum dan sesudah', async () => {
  resetRetentionThrottle();
  const store = createMemoryRetentionStore({
    deletedScans: 3,
    dbSizeBeforeBytes: 1_000_000,
    dbSizeAfterBytes: 900_000,
  });

  const run = await runLazyRetention({ store, now: () => NOW, force: true });
  assert.equal(run!.dbSizeBeforeBytes, 1_000_000);
  assert.equal(run!.dbSizeAfterBytes, 900_000);
  assert.ok(run!.ms >= 0);
});
