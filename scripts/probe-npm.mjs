#!/usr/bin/env node
/**
 * Probe npm registry untuk resolusi range (T-W1-02).
 *
 * Mengambil metadata ringkas (install-v1) untuk paket biasa, scoped, dan
 * paket dengan versi prerelease. Menyimpan respons mentah dan ringkasan
 * resolusi ke fixtures/npm/.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('fixtures/npm');
const REGISTRY = 'https://registry.npmjs.org';
const ACCEPT = 'application/vnd.npm.install-v1+json';
const USER_AGENT = 'PatchRadar-Probe/1.0';

const PACKAGES = [
  { slug: 'express', name: 'express', encoded: 'express' },
  { slug: 'types-node', name: '@types/node', encoded: '@types%2Fnode' },
  { slug: 'react', name: 'react', encoded: 'react' },
];

const NOT_FOUND = { slug: 'not-found', encoded: 'patchradar-package-yang-tidak-ada-xyz' };

function parseVersion(version) {
  const dash = version.indexOf('-');
  const main = dash === -1 ? version : version.slice(0, dash);
  const pre = dash === -1 ? [] : version.slice(dash + 1).split('.');
  return { main: main.split('.').map(Number), pre };
}

function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    const da = va.main[i] ?? 0;
    const db = vb.main[i] ?? 0;
    if (da !== db) return da < db ? -1 : 1;
  }
  if (va.pre.length === 0 && vb.pre.length === 0) return 0;
  if (va.pre.length === 0) return 1;
  if (vb.pre.length === 0) return -1;
  const len = Math.max(va.pre.length, vb.pre.length);
  for (let i = 0; i < len; i += 1) {
    const pa = va.pre[i];
    const pb = vb.pre[i];
    if (pa === undefined) return -1;
    if (pb === undefined) return 1;
    const aNumeric = /^\d+$/.test(pa);
    const bNumeric = /^\d+$/.test(pb);
    if (aNumeric && bNumeric) {
      const na = Number(pa);
      const nb = Number(pb);
      if (na !== nb) return na < nb ? -1 : 1;
    } else if (aNumeric) {
      return -1;
    } else if (bNumeric) {
      return 1;
    } else if (pa !== pb) {
      return pa < pb ? -1 : 1;
    }
  }
  return 0;
}

function upperBoundForCaret(base) {
  const [major, minor, patch] = base.main;
  if (major > 0) return [major + 1, 0, 0];
  if (minor > 0) return [0, minor + 1, 0];
  return [0, 0, patch + 1];
}

function resolveRange(range, versions) {
  const trimmed = range.trim();
  const operator = trimmed[0] === '^' || trimmed[0] === '~' ? trimmed[0] : '';
  const baseText = operator ? trimmed.slice(1) : trimmed;
  const base = parseVersion(baseText);
  if (base.main.some((part) => Number.isNaN(part))) {
    return { range, resolved: null, reason: 'versi dasar tidak valid' };
  }

  let candidates;
  if (operator === '') {
    candidates = versions.filter((version) => version === baseText);
  } else if (operator === '^') {
    const upper = upperBoundForCaret(base);
    candidates = versions.filter((version) => {
      if (version.includes('-')) return false;
      if (compareVersions(version, baseText) < 0) return false;
      return compareVersions(version, upper.join('.')) < 0;
    });
  } else {
    const upper = [base.main[0], base.main[1] + 1, 0];
    candidates = versions.filter((version) => {
      if (version.includes('-')) return false;
      if (compareVersions(version, baseText) < 0) return false;
      return compareVersions(version, upper.join('.')) < 0;
    });
  }

  candidates.sort(compareVersions);
  return {
    range,
    resolved: candidates.at(-1) ?? null,
    matchCount: candidates.length,
  };
}

function maxVersion(versions) {
  return [...versions].sort(compareVersions).at(-1) ?? null;
}

async function fetchPackage(encoded) {
  const started = performance.now();
  const res = await fetch(`${REGISTRY}/${encoded}`, {
    headers: { Accept: ACCEPT, 'User-Agent': USER_AGENT },
  });
  const buffer = Buffer.from(await res.arrayBuffer());
  const durationMs = Math.round(performance.now() - started);
  let body = null;
  try {
    body = JSON.parse(buffer.toString('utf8'));
  } catch {
    body = null;
  }
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    contentEncoding: res.headers.get('content-encoding'),
    bytes: buffer.length,
    durationMs,
    body,
    buffer,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const results = [];

  for (const pkg of PACKAGES) {
    const response = await fetchPackage(pkg.encoded);
    if (response.status === 200) {
      await writeFile(path.join(OUT_DIR, `${pkg.slug}.json`), response.buffer);
    }

    const versions = response.body ? Object.keys(response.body.versions ?? {}) : [];
    const prereleases = versions.filter((version) => version.includes('-'));
    const record = {
      slug: pkg.slug,
      name: pkg.name,
      encoded: pkg.encoded,
      status: response.status,
      contentType: response.contentType,
      contentEncoding: response.contentEncoding,
      bytes: response.bytes,
      durationMs: response.durationMs,
      versionCount: versions.length,
      distTags: response.body?.['dist-tags'] ?? null,
      latestVersion: response.body?.['dist-tags']?.latest ?? null,
      prereleaseCount: prereleases.length,
      maxPrereleaseBySemver: maxVersion(prereleases),
      resolutions: [],
    };

    if (pkg.slug === 'express' && versions.length > 0) {
      for (const range of ['^4.18.0', '~4.18.0', '4.18.2']) {
        record.resolutions.push(resolveRange(range, versions));
      }
    }
    if (pkg.slug === 'types-node' && versions.length > 0) {
      record.resolutions.push(resolveRange('^22.0.0', versions));
    }
    if (pkg.slug === 'react' && versions.length > 0) {
      record.resolutions.push(resolveRange('^19.0.0', versions));
      if (record.maxPrereleaseBySemver) {
        record.resolutions.push(resolveRange(record.maxPrereleaseBySemver, versions));
      }
    }

    results.push(record);
    console.log(
      `${pkg.name} status=${record.status} bytes=${record.bytes} ms=${record.durationMs} ` +
        `versions=${record.versionCount} latest=${record.latestVersion} pre=${record.prereleaseCount}`,
    );
    for (const res of record.resolutions) {
      console.log(`  ${res.range} -> ${res.resolved} (kandidat=${res.matchCount ?? '-'})`);
    }
  }

  const notFound = await fetchPackage(NOT_FOUND.encoded);
  await writeFile(path.join(OUT_DIR, 'not-found.json'), notFound.buffer);
  console.log(
    `${NOT_FOUND.encoded} status=${notFound.status} bytes=${notFound.bytes} body=${JSON.stringify(notFound.body)}`,
  );

  const summary = {
    probedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    registry: REGISTRY,
    accept: ACCEPT,
    packages: results,
    notFound: {
      encoded: NOT_FOUND.encoded,
      status: notFound.status,
      contentType: notFound.contentType,
      bytes: notFound.bytes,
      body: notFound.body,
    },
    rateLimit429: {
      observed: false,
      note: 'Tidak terpicu selama probe normal; perlakukan 429/503 sebagai error sementara dengan backoff.',
    },
    nonRegistrySpecs: [
      { spec: 'git+https://github.com/expressjs/express.git', decision: 'dilewati' },
      { spec: 'file:../paket-lokal', decision: 'dilewati' },
      { spec: 'workspace:*', decision: 'dilewati' },
    ],
  };
  await writeFile(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error('Probe gagal:', error.message);
  process.exitCode = 1;
});
