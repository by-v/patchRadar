/**
 * Spike sementara T-W1-07b: ukur CPU/wall time parser lockfile di runtime
 * Supabase. Fungsi ini hanya memuat parser T-W1-07 dan tidak memanggil
 * jaringan eksternal.
 *
 * Dihapus dari remote setelah pengukuran selesai.
 */

import nodeProcess from 'node:process';
import { parseManifest } from '../scan/lib/lockfile.ts';

declare const Deno: {
  serve: (handler: (request: Request) => Response | Promise<Response>) => void;
  cpuUsage?: (previous?: CpuUsage) => CpuUsage;
  version?: { deno?: string };
};

interface CpuUsage {
  user: number;
  system: number;
}

interface SpikeBody {
  packageJsonText?: unknown;
  lockfileText?: unknown;
  repeat?: unknown;
}

const MAX_BODY_BYTES = 8 * 1024 * 1024;

function readCpu(): CpuUsage | null {
  try {
    if (Deno.cpuUsage) return Deno.cpuUsage();
  } catch {
    // lanjut ke fallback node:process
  }
  try {
    if (typeof nodeProcess.cpuUsage === 'function') return nodeProcess.cpuUsage();
  } catch {
    // API tidak tersedia pada runtime ini
  }
  return null;
}

function cpuSource(): string | null {
  if (typeof Deno.cpuUsage === 'function') return 'Deno.cpuUsage';
  if (typeof nodeProcess.cpuUsage === 'function') return 'node:process.cpuUsage';
  return null;
}

function cpuDelta(start: CpuUsage | null, end: CpuUsage | null): CpuUsage | null {
  if (!start || !end) return null;
  return { user: end.user - start.user, system: end.system - start.system };
}

function totalMicros(usage: CpuUsage | null): number | null {
  return usage ? usage.user + usage.system : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  const handlerStartWall = performance.now();
  const handlerStartCpu = readCpu();

  if (request.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return json({ error: 'BODY_TOO_LARGE', bytes: text.length }, 413);
  }

  let body: SpikeBody;
  const bodyParseStartWall = performance.now();
  try {
    body = JSON.parse(text) as SpikeBody;
  } catch {
    return json({ error: 'INVALID_JSON' }, 400);
  }
  const bodyParseMs = performance.now() - bodyParseStartWall;

  if (!body || typeof body !== 'object') {
    return json({ error: 'INVALID_BODY' }, 400);
  }
  if (typeof body.packageJsonText !== 'string' || typeof body.lockfileText !== 'string') {
    return json({ error: 'MISSING_MANIFEST_FIELDS' }, 400);
  }

  const repeatValue = typeof body.repeat === 'number' ? body.repeat : 1;
  if (!Number.isInteger(repeatValue) || repeatValue < 1 || repeatValue > 50) {
    return json({ error: 'INVALID_REPEAT' }, 400);
  }

  const parseStartWall = performance.now();
  const parseStartCpu = readCpu();
  let parsed: ReturnType<typeof parseManifest> | null = null;
  for (let index = 0; index < repeatValue; index += 1) {
    parsed = parseManifest({
      packageJsonText: body.packageJsonText,
      lockfileText: body.lockfileText,
    });
  }
  const parseEndCpu = readCpu();
  const parseMs = performance.now() - parseStartWall;
  const parseCpu = cpuDelta(parseStartCpu, parseEndCpu);

  if (!parsed) {
    return json({ error: 'PARSE_NOT_RUN' }, 500);
  }

  const handlerWallMs = performance.now() - handlerStartWall;
  const handlerCpu = cpuDelta(handlerStartCpu, readCpu());
  const parseCpuUs = totalMicros(parseCpu);

  const base = {
    cpuUsageAvailable: parseCpu !== null,
    cpuSource: cpuSource(),
    denoVersion: Deno.version?.deno ?? null,
    packageJsonBytes: body.packageJsonText.length,
    lockfileBytes: body.lockfileText.length,
    bodyBytes: text.length,
    bodyParseMs,
    repeat: repeatValue,
    parseMs,
    parseCpuUs,
    parseCpuUsPerRun: parseCpuUs === null ? null : parseCpuUs / repeatValue,
    parseCpuUserUs: parseCpu?.user ?? null,
    parseCpuSystemUs: parseCpu?.system ?? null,
    handlerWallMs,
    handlerCpuUs: totalMicros(handlerCpu),
    handlerCpuUserUs: handlerCpu?.user ?? null,
    handlerCpuSystemUs: handlerCpu?.system ?? null,
  };

  if ('error' in parsed) {
    return json({ ...base, error: parsed.error }, 422);
  }

  return json({
    ...base,
    source: parsed.source,
    lockfileVersion: parsed.lockfileVersion,
    packages: parsed.totalPackages,
    warnings: parsed.warnings.length,
  });
});
