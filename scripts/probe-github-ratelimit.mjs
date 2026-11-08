#!/usr/bin/env node
/**
 * Probe perilaku GitHub REST saat jatah tanpa token habis (T-W1-01).
 *
 * Skrip ini sengaja TIDAK memakai token. Ia menghabiskan sisa jatah
 * unauthenticated (maksimum 60/jam), lalu merekam status dan header yang
 * benar-benar dikembalikan, termasuk satu pengambilan raw setelah REST habis.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const OUT_FILE = path.resolve('fixtures/github/rate-limit-exhaustion.json');
const USER_AGENT = 'PatchRadar-Probe/1.0';
const MAX_REQUESTS = 100;

if (process.env.GITHUB_TOKEN || process.env.GH_TOKEN) {
  console.error('Skrip ini harus dijalankan TANPA GITHUB_TOKEN/GH_TOKEN.');
  process.exit(1);
}

function headers() {
  return {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

function redactPii(text) {
  if (!text) return text;
  return text.replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>');
}

function rateHeaders(res) {
  return {
    limit: res.headers.get('x-ratelimit-limit'),
    remaining: res.headers.get('x-ratelimit-remaining'),
    used: res.headers.get('x-ratelimit-used'),
    reset: res.headers.get('x-ratelimit-reset'),
    resource: res.headers.get('x-ratelimit-resource'),
    retryAfter: res.headers.get('retry-after'),
  };
}

async function getJson(url) {
  const res = await fetch(url, { headers: headers() });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return {
    status: res.status,
    rateLimit: rateHeaders(res),
    body,
    bodyText: text.slice(0, 500),
  };
}

async function getRaw(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    contentType: res.headers.get('content-type'),
    rateLimit: rateHeaders(res),
  };
}

async function main() {
  await mkdir(path.dirname(OUT_FILE), { recursive: true });

  const start = await getJson(`${API}/rate_limit`);
  let remaining = Number(start.rateLimit.remaining);
  const calls = [];

  while (remaining > 0 && calls.length < MAX_REQUESTS) {
    const res = await getJson(`${API}/repos/octocat/Hello-World`);
    calls.push({ status: res.status, rateLimit: res.rateLimit });
    remaining = Number(res.rateLimit.remaining);
    if (res.status !== 200) break;
  }

  const lastSuccess = [...calls].reverse().find((call) => call.status === 200) ?? null;

  const blockedRepo = await getJson(`${API}/repos/octocat/Hello-World`);
  const blockedMissing = await getJson(`${API}/repos/patchradar-probe/repo-yang-tidak-ada-xyz`);
  const rawAfter = await getRaw(`${RAW}/axios/axios/v1.x/package.json`);

  const result = {
    capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    authenticated: false,
    start: { status: start.status, rateLimit: start.rateLimit },
    requestCount: calls.length,
    lastSuccessBeforeBlock: lastSuccess,
    blockedRepo: {
      status: blockedRepo.status,
      message: redactPii(blockedRepo.body?.message ?? null),
      documentationUrl: blockedRepo.body?.documentation_url ?? null,
      rateLimit: blockedRepo.rateLimit,
      bodyPreview: redactPii(blockedRepo.bodyText),
    },
    blockedMissingRepo: {
      status: blockedMissing.status,
      message: redactPii(blockedMissing.body?.message ?? null),
      rateLimit: blockedMissing.rateLimit,
    },
    rawAfterBlock: rawAfter,
  };

  await writeFile(OUT_FILE, `${JSON.stringify(result, null, 2)}\n`);

  console.log(`start remaining=${start.rateLimit.remaining} limit=${start.rateLimit.limit}`);
  console.log(`requests used in loop=${calls.length}`);
  if (lastSuccess) {
    console.log(
      `last success status=${lastSuccess.status} remaining=${lastSuccess.rateLimit.remaining} used=${lastSuccess.rateLimit.used}`,
    );
  }
  console.log(
    `blocked repo status=${blockedRepo.status} message=${JSON.stringify(blockedRepo.body?.message)} ` +
      `remaining=${blockedRepo.rateLimit.remaining} retryAfter=${blockedRepo.rateLimit.retryAfter}`,
  );
  console.log(
    `blocked missing repo status=${blockedMissing.status} message=${JSON.stringify(blockedMissing.body?.message)}`,
  );
  console.log(`raw after block status=${rawAfter.status} bytes=${rawAfter.bytes}`);
}

main().catch((error) => {
  console.error('Probe gagal:', error.message);
  process.exitCode = 1;
});
