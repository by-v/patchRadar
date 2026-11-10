/**
 * Pengukur wall time per tahap pipeline.
 *
 * Tahap sinkron dan non-sinkron dicatat terpisah. Untuk kode sinkron, wall time
 * dapat dipakai sebagai batas atas CPU (lihat `T-W1-07b`/`T-W1-12d`); tahap
 * non-sinkron (menunggu jaringan) tidak boleh dijumlahkan sebagai CPU.
 *
 * Tidak memakai API Node; `performance.now` tersedia di Deno dan Node modern.
 */

export type TimingClock = () => number;

export interface StageTimings {
  /** Tahap sinkron: nama → durasi wall time (ms). */
  sync: Record<string, number>;
  /** Tahap non-sinkron: nama → durasi wall time (ms). */
  async: Record<string, number>;
  /** Urutan pemanggilan, termasuk kategori; berguna untuk log. */
  stages: Array<{ name: string; async: boolean; ms: number }>;
}

function defaultClock(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

export function createStageTimings(clock: TimingClock = defaultClock): StageTimings {
  return { sync: {}, async: {}, stages: [] };
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function record(
  timings: StageTimings,
  name: string,
  asyncStage: boolean,
  ms: number,
): void {
  const rounded = Math.round(ms * 1000) / 1000;
  const bucket = asyncStage ? timings.async : timings.sync;
  bucket[name] = (bucket[name] ?? 0) + rounded;
  timings.stages.push({ name, async: asyncStage, ms: rounded });
}

/**
 * Jalankan satu tahap dan catat wall time-nya.
 *
 * Bila `fn` mengembalikan promise, hasil dicatat sebagai tahap non-sinkron;
 * selain itu dicatat sebagai tahap sinkron. Nilai/penolakan diteruskan apa
 * adanya agar pemanggil tetap menangani errornya.
 */
export async function timed<T>(
  timings: StageTimings,
  name: string,
  fn: () => T | Promise<T>,
  clock: TimingClock = defaultClock,
): Promise<T> {
  const started = clock();
  let output: T | Promise<T>;
  try {
    output = fn();
  } catch (error) {
    record(timings, name, false, clock() - started);
    throw error;
  }

  if (isThenable(output)) {
    try {
      const value = (await output) as T;
      record(timings, name, true, clock() - started);
      return value;
    } catch (error) {
      record(timings, name, true, clock() - started);
      throw error;
    }
  }

  record(timings, name, false, clock() - started);
  return output;
}

/** Jumlah seluruh wall time tahap sinkron (batas atas CPU pipeline). */
export function totalSyncMs(timings: StageTimings): number {
  return Object.values(timings.sync).reduce((sum, value) => sum + value, 0);
}
