import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createStageTimings, timed, totalSyncMs } from './timing.ts';

function fakeClock(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value ?? values.at(-1) ?? 0;
  };
}

test('tahap sinkron dan non-sinkron dicatat terpisah', async () => {
  const timings = createStageTimings();
  const clock = fakeClock([0, 2, 10, 35]);

  const syncValue = await timed(timings, 'findings', () => 'a', clock);
  const asyncValue = await timed(timings, 'osv.batch', async () => 'b', clock);

  assert.equal(syncValue, 'a');
  assert.equal(asyncValue, 'b');
  assert.deepEqual(timings.sync, { findings: 2 });
  assert.deepEqual(timings.async, { 'osv.batch': 25 });
  assert.equal(totalSyncMs(timings), 2);
  assert.deepEqual(timings.stages.map((stage) => stage.async), [false, true]);
});

test('tahap yang gagal tetap tercatat lalu error diteruskan', async () => {
  const syncTimings = createStageTimings();
  const clock = fakeClock([0, 5]);
  await assert.rejects(
    timed(syncTimings, 'gagal', () => {
      throw new Error('boom');
    }, clock),
    /boom/,
  );
  assert.deepEqual(syncTimings.sync, { gagal: 5 });

  const asyncTimings = createStageTimings();
  const asyncClock = fakeClock([0, 7]);
  await assert.rejects(
    timed(asyncTimings, 'gagal.async', async () => {
      throw new Error('async boom');
    }, asyncClock),
    /async boom/,
  );
  assert.deepEqual(asyncTimings.async, { 'gagal.async': 7 });
});

test('tahap dengan nama sama diakumulasi', async () => {
  const timings = createStageTimings();
  const clock = fakeClock([0, 1, 1, 4]);
  await timed(timings, 'match', () => undefined, clock);
  await timed(timings, 'match', () => undefined, clock);
  assert.equal(timings.sync.match, 4);
});
