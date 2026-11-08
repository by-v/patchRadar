#!/usr/bin/env node
/**
 * Probe GitHub REST + raw untuk PatchRadar (T-W1-01).
 *
 * Mengambil metadata repo, package.json, dan package-lock.json dari root
 * default branch. Menyimpan respons mentah ke fixtures/github/ dan ringkasan
 * ke fixtures/github/summary.json.
 *
 * Token opsional dibaca dari GITHUB_TOKEN atau GH_TOKEN. Token tidak pernah
 * dicetak ke log.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';
const OUT_DIR = path.resolve('fixtures/github');
const USER_AGENT = 'PatchRadar-Probe/1.0';

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const TARGETS = [
  { slug: 'axios', repo: 'axios/axios' },
  { slug: 'lodash', repo: 'lodash/lodash' },
  { slug: 'npm-cli', repo: 'npm/cli' },
  { slug: 'express-no-lockfile', repo: 'expressjs/express' },
];

const ERROR_CASES = [
  { slug: 'not-found', repo: 'patchradar-probe/repo-yang-tidak-ada-xyz' },
];

function baseHeaders(extra = {}) {
  const headers = {
    'User-Agent': USER_AGENT,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  };
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  return headers;
}

function rateLimitInfo(res) {
  return {
    limit: res.headers.get('x-ratelimit-limit'),
    remaining: res.headers.get('x-ratelimit-remaining'),
    used: res.headers.get('x-ratelimit-used'),
    reset: res.headers.get('x-ratelimit-reset'),
    resource: res.headers.get('x-ratelimit-resource'),
    retryAfter: res.headers.get('retry-after'),
  };
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function getJson(url) {
  const res = await fetch(url, { headers: baseHeaders() });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  return {
    status: res.status,
    ok: res.ok,
    redirected: res.redirected,
    finalUrl: res.url,
    contentType: res.headers.get('content-type'),
    rateLimit: rateLimitInfo(res),
    body,
    text,
  };
}

async function getRaw(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  const buffer = Buffer.from(await res.arrayBuffer());
  let decodedAsUtf8 = true;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    decodedAsUtf8 = false;
  }
  return {
    status: res.status,
    ok: res.ok,
    redirected: res.redirected,
    finalUrl: res.url,
    contentType: res.headers.get('content-type'),
    bytes: buffer.length,
    sha256: digest(buffer),
    decodedAsUtf8,
    buffer,
  };
}

async function probeRepo(target) {
  const repoInfo = await getJson(`${API}/repos/${target.repo}`);
  const result = {
    slug: target.slug,
    repo: target.repo,
    metadata: {
      status: repoInfo.status,
      redirected: repoInfo.redirected,
      finalUrl: repoInfo.finalUrl,
      rateLimit: repoInfo.rateLimit,
      fullName: repoInfo.body?.full_name ?? null,
      defaultBranch: repoInfo.body?.default_branch ?? null,
      private: repoInfo.body?.private ?? null,
      sizeKb: repoInfo.body?.size ?? null,
    },
    manifests: {},
  };

  if (repoInfo.status !== 200) {
    result.metadata.errorMessage = repoInfo.body?.message ?? null;
    return result;
  }

  const branch = result.metadata.defaultBranch;
  for (const file of ['package.json', 'package-lock.json']) {
    const raw = await getRaw(`${RAW}/${target.repo}/${branch}/${file}`);
    result.manifests[file] = {
      status: raw.status,
      redirected: raw.redirected,
      finalUrl: raw.finalUrl,
      contentType: raw.contentType,
      bytes: raw.bytes,
      sha256: raw.sha256,
      utf8: raw.decodedAsUtf8,
    };
    if (raw.status === 200) {
      const dir = path.join(OUT_DIR, target.slug);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, file), raw.buffer);
    }
  }

  const dir = path.join(OUT_DIR, target.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'repo.json'), `${JSON.stringify(repoInfo.body, null, 2)}\n`);

  return result;
}

async function probeError(errorCase) {
  const res = await getJson(`${API}/repos/${errorCase.repo}`);
  const dir = path.join(OUT_DIR, `error-${errorCase.slug}`);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'response.json'), `${JSON.stringify(res.body, null, 2)}\n`);
  return {
    slug: errorCase.slug,
    repo: errorCase.repo,
    status: res.status,
    message: res.body?.message ?? null,
    documentationUrl: res.body?.documentation_url ?? null,
    rateLimit: res.rateLimit,
  };
}

async function rateLimitSnapshot() {
  const res = await getJson(`${API}/rate_limit`);
  return { status: res.status, ...res.rateLimit, body: res.body?.resources ?? null };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const before = await rateLimitSnapshot();
  const repos = [];
  for (const target of TARGETS) {
    repos.push(await probeRepo(target));
  }
  const errors = [];
  for (const errorCase of ERROR_CASES) {
    errors.push(await probeError(errorCase));
  }
  const after = await rateLimitSnapshot();

  const summary = {
    probedAt: new Date().toISOString(),
    authenticated: Boolean(TOKEN),
    rateLimitBefore: before,
    rateLimitAfter: after,
    repos,
    errors,
  };

  await writeFile(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`auth=${TOKEN ? 'token' : 'anonymous'}`);
  for (const repo of repos) {
    const pkg = repo.manifests['package.json'];
    const lock = repo.manifests['package-lock.json'];
    console.log(
      `${repo.repo} metadata=${repo.metadata.status} branch=${repo.metadata.defaultBranch} ` +
        `package.json=${pkg?.status ?? '-'}(${pkg?.bytes ?? 0}B) lock=${lock?.status ?? '-'}(${lock?.bytes ?? 0}B)`,
    );
  }
  for (const err of errors) {
    console.log(`${err.repo} status=${err.status} message=${JSON.stringify(err.message)}`);
  }
  console.log(
    `rate limit before: limit=${before.limit} remaining=${before.remaining}; ` +
      `after: remaining=${after.remaining}`,
  );
}

main().catch((error) => {
  console.error('Probe gagal:', error.message);
  process.exitCode = 1;
});
