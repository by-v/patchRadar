#!/usr/bin/env node
/**
 * Probe T-W1-07b: kirim fixture lockfile ke Edge Function `cpu-spike` dan
 * catat wall time klien + CPU/wall time yang dilaporkan fungsi.
 *
 * Kunci API diambil dari Supabase CLI ke memori proses ini dan tidak pernah
 * dicetak. Script tidak menulis kunci ke disk.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = join(ROOT, 'fixtures', 'lockfiles');
const FUNCTION_NAME = 'cpu-spike';
const DEFAULT_RUNS = 7;
const WARMUP_RUNS = 1;
const REQUEST_TIMEOUT_MS = 60_000;

const CASES = [
  { name: 'small-100', expectedPackages: 107 },
  { name: 'medium-500', expectedPackages: 491 },
  { name: 'large-1500', expectedPackages: 1409 },
];

function readProjectRef() {
  const fromEnv = process.env.SUPABASE_PROJECT_REF?.trim();
  if (fromEnv) return fromEnv;
  const ref = readFileSync(join(ROOT, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
  if (!ref) throw new Error('Project ref kosong.');
  return ref;
}

function cliJson(args) {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'npx';
  const commandArgs = isWindows
    ? ['/d', '/s', '/c', `npx --yes supabase@latest ${args.join(' ')}`]
    : ['--yes', 'supabase@latest', ...args];
  const output = execFileSync(command, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const start = output.indexOf('[');
  if (start < 0) throw new Error('Output CLI bukan JSON.');
  return JSON.parse(output.slice(start));
}

function readAnonKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;

  const keys = cliJson(['projects', 'api-keys', '-o', 'json']);
  const legacyAnon = keys.find((entry) => entry?.type === 'legacy' && entry?.name === 'anon');
  const publishable = keys.find((entry) => entry?.type === 'publishable');
  const key = legacyAnon?.api_key ?? publishable?.api_key;
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Kunci anon/publishable tidak ditemukan lewat CLI.');
  }
  return key;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2;
  return sorted[middle];
}

function summarize(samples, field) {
  const values = samples
    .map((sample) => sample[field])
    .filter((value) => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return {
    median: Number(median(values).toFixed(3)),
    worst: Number(Math.max(...values).toFixed(3)),
    min: Number(Math.min(...values).toFixed(3)),
  };
}

async function invoke(url, key, body, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body,
      signal: controller.signal,
    });
    const clientWallMs = performance.now() - started;
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${label}: HTTP ${response.status} ${text.slice(0, 300)}`);
    }
    return {
      clientWallMs: Number(clientWallMs.toFixed(3)),
      ...JSON.parse(text),
      traceId: response.headers.get('x-deno-execution-id') ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const runs = Number(process.env.RUNS ?? DEFAULT_RUNS);
  if (!Number.isInteger(runs) || runs < 5) throw new Error('RUNS minimal 5.');

  const projectRef = readProjectRef();
  const key = readAnonKey();
  const url = `https://${projectRef}.supabase.co/functions/v1/${FUNCTION_NAME}`;
  const report = {
    function: FUNCTION_NAME,
    runs,
    warmup: WARMUP_RUNS,
    cpuNote:
      'CPU time platform tidak dilaporkan di header respons. Deno/process.cpuUsage di runtime ini diuji dengan loop parse berulang; bila hasilnya 0, nilai CPU dilaporkan null dan tidak diperkirakan.',
    cases: [],
  };

  for (const testCase of CASES) {
    const packageJsonText = readFileSync(join(FIXTURES, testCase.name, 'package.json'), 'utf8');
    const lockfileText = readFileSync(join(FIXTURES, testCase.name, 'package-lock.json'), 'utf8');
    const body = JSON.stringify({ packageJsonText, lockfileText });

    const warmup = await invoke(url, key, body, `${testCase.name} warmup`);
    if (warmup.packages !== testCase.expectedPackages) {
      throw new Error(`${testCase.name}: packages ${warmup.packages} != ${testCase.expectedPackages}`);
    }

    const repeat = testCase.name === 'large-1500' ? 10 : 20;
    const instrumentation = await invoke(
      url,
      key,
      JSON.stringify({ packageJsonText, lockfileText, repeat }),
      `${testCase.name} instrumentation`,
    );
    const cpuUsageObserved = (instrumentation.parseCpuUs ?? 0) > 0;

    const samples = [];
    for (let index = 0; index < runs; index += 1) {
      samples.push(await invoke(url, key, body, `${testCase.name} run ${index + 1}`));
    }

    for (const sample of samples) {
      if (sample.packages !== testCase.expectedPackages) {
        throw new Error(`${testCase.name}: packages ${sample.packages} != ${testCase.expectedPackages}`);
      }
    }

    const reportSamples = samples.map((sample) => ({
      ...sample,
      parseCpuUs: cpuUsageObserved ? sample.parseCpuUs : null,
      parseCpuUsPerRun: cpuUsageObserved ? sample.parseCpuUsPerRun : null,
      handlerCpuUs: cpuUsageObserved ? sample.handlerCpuUs : null,
    }));

    report.cases.push({
      fixture: testCase.name,
      expectedPackages: testCase.expectedPackages,
      bodyBytes: Buffer.byteLength(body),
      lockfileBytes: Buffer.byteLength(lockfileText),
      cpuUsageObserved,
      cpuSource: instrumentation.cpuSource ?? null,
      cpuInstrumentationCheck: {
        repeat,
        parseMs: instrumentation.parseMs,
        parseCpuUs: instrumentation.parseCpuUs,
        parseCpuUsPerRun: instrumentation.parseCpuUsPerRun,
      },
      denoVersion: samples[0]?.denoVersion ?? null,
      clientWallMs: summarize(samples, 'clientWallMs'),
      parseMs: summarize(samples, 'parseMs'),
      parseCpuUs: cpuUsageObserved ? summarize(samples, 'parseCpuUs') : null,
      handlerCpuUs: cpuUsageObserved ? summarize(samples, 'handlerCpuUs') : null,
      handlerWallMs: summarize(samples, 'handlerWallMs'),
      samples: reportSamples,
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`PROBE GAGAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
