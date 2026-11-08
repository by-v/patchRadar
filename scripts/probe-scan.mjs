#!/usr/bin/env node
/**
 * Uji integrasi T-W1-11 untuk Edge Function `scan`.
 *
 * Anon key diambil lewat Supabase CLI ke memori proses ini dan tidak pernah
 * dicetak/disimpan. JWT (Authorization) tetap dikirim seperti klien nyata.
 * Skrip hanya memanggil endpoint; tidak mengubah proyek remote.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUNCTION_NAME = 'scan';
const REQUEST_TIMEOUT_MS = 30_000;

const CASES = [
  { name: 'valid_lockfile_v3', repoUrl: 'https://github.com/axios/axios', expect: 200 },
  {
    name: 'valid_lockfile_v1_fallback',
    repoUrl: 'https://github.com/lodash/lodash',
    expect: 200,
  },
  { name: 'valid_no_lockfile', repoUrl: 'https://github.com/expressjs/express', expect: 200 },
  {
    name: 'repo_not_found',
    repoUrl: 'https://github.com/patchradar-uji-tidak-ada-xyz/repo-tidak-ada-12345',
    expect: 404,
  },
  { name: 'invalid_url', repoUrl: 'bukan-url', expect: 400 },
  { name: 'other_host', repoUrl: 'https://gitlab.com/lodash/lodash', expect: 400 },
  { name: 'extra_path', repoUrl: 'https://github.com/lodash/lodash/tree/master', expect: 400 },
  { name: 'uppercase_host', repoUrl: 'https://GitHub.com/lodash/lodash', expect: 400 },
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

async function invoke(url, key, repoUrl, withJwt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const started = performance.now();
  try {
    const headers = {
      apikey: key,
      'content-type': 'application/json',
      'x-client-version': '1.0.0',
    };
    if (withJwt) headers.authorization = `Bearer ${key}`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ repoUrl, clientVersion: '1.0.0' }),
      signal: controller.signal,
    });
    const clientWallMs = performance.now() - started;
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return {
      status: response.status,
      clientWallMs: Number(clientWallMs.toFixed(1)),
      requestIdHeader: response.headers.get('x-request-id'),
      body,
      rawPreview: body === null ? text.slice(0, 200) : null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function summarize(testCase, result) {
  const manifest = result.body?.manifest ?? null;
  const error = result.body?.error ?? null;
  return {
    case: testCase.name,
    repoUrl: testCase.repoUrl,
    expected: testCase.expect,
    status: result.status,
    pass: result.status === testCase.expect,
    code: error?.code ?? null,
    retryable: error?.retryable ?? null,
    requestId: result.body?.requestId ?? error?.requestId ?? result.requestIdHeader,
    requestIdMatchesHeader:
      (result.body?.requestId ?? error?.requestId ?? null) === result.requestIdHeader,
    manifest,
    totalPackages: result.body?.summary?.totalPackages ?? null,
    findingsCount: Array.isArray(result.body?.findings) ? result.body.findings.length : null,
    message: error?.message ?? null,
    clientWallMs: result.clientWallMs,
  };
}

async function main() {
  const projectRef = readProjectRef();
  const key = readAnonKey();
  const url = `https://${projectRef}.supabase.co/functions/v1/${FUNCTION_NAME}`;
  const results = [];

  for (const testCase of CASES) {
    const result = await invoke(url, key, testCase.repoUrl, true);
    results.push(summarize(testCase, result));
  }

  const noJwt = await invoke(url, key, CASES[0].repoUrl, false);
  results.push({
    case: 'tanpa_jwt',
    repoUrl: CASES[0].repoUrl,
    expected: 401,
    status: noJwt.status,
    pass: noJwt.status === 401,
    code: noJwt.body?.error?.code ?? null,
    requestId: noJwt.body?.error?.requestId ?? null,
    message: noJwt.body?.error?.message ?? null,
  });

  const privateCase = {
    case: 'repo_privat_403',
    result: 'TIDAK DIPICU: tidak ada repo privat yang diketahui dan boleh diuji.',
  };

  console.log(JSON.stringify({ results, privateCase }, null, 2));

  const failed = results.filter((entry) => entry.pass !== true);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`PROBE GAGAL: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
