#!/usr/bin/env node
/**
 * Probe kasus tepi raw.githubusercontent.com tanpa memakai jatah REST (T-W1-01):
 * redirect repo yang di-rename dan repo tanpa manifest npm.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_FILE = path.resolve('fixtures/github/raw-edge-cases.json');
const USER_AGENT = 'PatchRadar-Probe/1.0';

const CASES = [
  {
    name: 'redirect-renamed-repo-raw',
    url: 'https://raw.githubusercontent.com/facebookincubator/create-react-app/HEAD/package.json',
  },
  {
    name: 'redirect-renamed-repo-web',
    url: 'https://github.com/facebookincubator/create-react-app',
  },
  {
    name: 'no-manifest-package-json',
    url: 'https://raw.githubusercontent.com/torvalds/linux/HEAD/package.json',
  },
  {
    name: 'no-manifest-package-lock',
    url: 'https://raw.githubusercontent.com/torvalds/linux/HEAD/package-lock.json',
  },
];

async function probe(testCase) {
  const manual = await fetch(testCase.url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'manual',
  });
  const location = manual.headers.get('location');
  const result = {
    name: testCase.name,
    url: testCase.url,
    status: manual.status,
    location,
    contentType: manual.headers.get('content-type'),
    bytes: 0,
    followedStatus: null,
    followedFinalUrl: null,
  };

  if (manual.status >= 300 && manual.status < 400 && location) {
    const followed = await fetch(testCase.url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    const buffer = Buffer.from(await followed.arrayBuffer());
    result.followedStatus = followed.status;
    result.followedFinalUrl = followed.url;
    result.followedContentType = followed.headers.get('content-type');
    result.followedBytes = buffer.length;
  } else {
    const buffer = Buffer.from(await manual.arrayBuffer());
    result.bytes = buffer.length;
    result.followedStatus = manual.status;
    result.followedFinalUrl = manual.url;
  }

  return result;
}

async function main() {
  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  const results = [];
  for (const testCase of CASES) {
    results.push(await probe(testCase));
  }
  const payload = {
    capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    authenticated: false,
    usesRestQuota: false,
    cases: results,
  };
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
  for (const r of results) {
    console.log(
      `${r.name}: status=${r.status} location=${r.location ?? '-'} ` +
        `followed=${r.followedStatus} bytes=${r.followedBytes ?? r.bytes}`,
    );
  }
}

main().catch((error) => {
  console.error('Probe gagal:', error.message);
  process.exitCode = 1;
});
