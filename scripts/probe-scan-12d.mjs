#!/usr/bin/env node
/**
 * Bukti T-W1-12d: scan remote dengan respons lengkap (tanpa mencetak kunci).
 *
 * - Anon key dibaca dari environment atau Supabase CLI, hanya di memori proses.
 * - Hanya memanggil fungsi `scan`; tidak mengubah proyek remote.
 * - Parameter pertama: path JSON keluaran (default: scan-12d-evidence.json).
 *
 * Kasus dijalankan berurutan:
 *   1. socketio/socket.io (cache dingin)
 *   2. socketio/socket.io (cache hangat, langsung setelahnya)
 *   3. facebook/react (tanpa lockfile)
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTION = 'scan';
const TIMEOUT_MS = 60_000;

const CASES = [
  { name: 'socketio_cold', repoUrl: 'https://github.com/socketio/socket.io' },
  { name: 'socketio_warm', repoUrl: 'https://github.com/socketio/socket.io' },
  { name: 'react_no_lockfile', repoUrl: 'https://github.com/facebook/react' },
];

function projectRef() {
  const env = process.env.SUPABASE_PROJECT_REF?.trim();
  if (env) return env;
  return readFileSync(join(ROOT, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
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

function anonKey() {
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

async function invoke(url, key, repoUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
        'x-client-version': '1.0.0',
      },
      body: JSON.stringify({ repoUrl, clientVersion: '1.0.0' }),
      signal: controller.signal,
    });
    const wallMs = performance.now() - started;
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return {
      status: response.status,
      clientWallMs: Number(wallMs.toFixed(1)),
      requestIdHeader: response.headers.get('x-request-id'),
      body,
      raw: body === null ? text.slice(0, 500) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function pick(result) {
  const body = result.body ?? {};
  return {
    status: result.status,
    clientWallMs: result.clientWallMs,
    requestId: body.requestId ?? body.error?.requestId ?? result.requestIdHeader,
    requestIdMatchesHeader:
      (body.requestId ?? body.error?.requestId ?? null) === result.requestIdHeader,
    scanStatus: body.status ?? null,
    manifest: body.manifest ?? null,
    summary: body.summary ?? null,
    sourceStatus: body.sourceStatus ?? null,
    partial: body.partial ?? null,
    persisted: body.persisted ?? null,
    warnings: body.warnings ?? null,
    timings: body.timings ?? null,
    findings: Array.isArray(body.findings)
      ? body.findings.map((finding) => ({
          packageName: finding.packageName,
          installedVersion: finding.installedVersion,
          severity: finding.severity,
          label: finding.label,
          kev: finding.kev,
          cveIds: finding.cveIds,
          epss: finding.epss,
          epssPercentile: finding.epssPercentile,
        }))
      : null,
    error: body.error ?? null,
    raw: result.raw,
  };
}

async function main() {
  const ref = projectRef();
  const key = anonKey();
  const url = `https://${ref}.supabase.co/functions/v1/${FUNCTION}`;
  const outPath = resolve(process.argv[2] ?? 'scan-12d-evidence.json');
  const results = [];

  for (const testCase of CASES) {
    const startedAt = new Date().toISOString();
    const raw = await invoke(url, key, testCase.repoUrl);
    const finishedAt = new Date().toISOString();
    const entry = { case: testCase.name, repoUrl: testCase.repoUrl, startedAt, finishedAt, ...pick(raw) };
    results.push(entry);
    console.log(
      JSON.stringify({
        case: entry.case,
        status: entry.status,
        requestId: entry.requestId,
        manifest: entry.manifest,
        totalPackages: entry.summary?.totalPackages ?? null,
        findingCount: entry.summary?.findingCount ?? null,
        sourceStatus: entry.sourceStatus,
        partial: entry.partial,
        warnings: entry.warnings,
        timings: entry.timings,
        clientWallMs: entry.clientWallMs,
      }),
    );
  }

  writeFileSync(outPath, JSON.stringify({ projectRef: ref, generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Bukti lengkap ditulis ke ${outPath}`);
}

main().catch((error) => {
  console.error(`PROBE GAGAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
