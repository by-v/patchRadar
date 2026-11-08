#!/usr/bin/env node
/**
 * Probe OSV.dev untuk PatchRadar (T-W1-03).
 *
 * 1. Kirim querybatch 50 paket+versi npm dan catat bentuk respons.
 * 2. Ambil detail minimal 20 advisory; bandingkan `severity` (CVSS),
 *    `database_specific.severity`, dan alias GHSA/CVE.
 * 3. Uji paket tanpa advisory dan penerimaan batch lebih besar.
 * 4. Simpan fixture mentah + ringkasan ke fixtures/osv/.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.osv.dev/v1';
const OUT_DIR = path.resolve('fixtures/osv');
const USER_AGENT = 'PatchRadar-Probe/1.0';
const DETAIL_LIMIT = 40;

const QUERIES = [
  ['lodash', '4.17.20'],
  ['lodash', '4.17.15'],
  ['minimist', '1.2.5'],
  ['minimist', '0.0.8'],
  ['axios', '0.21.1'],
  ['axios', '0.21.0'],
  ['node-fetch', '2.6.0'],
  ['node-fetch', '2.6.6'],
  ['serialize-javascript', '3.1.0'],
  ['serialize-javascript', '2.1.1'],
  ['express', '4.17.0'],
  ['express', '4.16.0'],
  ['json5', '2.2.0'],
  ['json5', '1.0.1'],
  ['ejs', '3.1.5'],
  ['ejs', '3.1.6'],
  ['handlebars', '4.7.6'],
  ['handlebars', '4.7.3'],
  ['marked', '0.3.5'],
  ['marked', '1.1.0'],
  ['tar', '6.1.0'],
  ['tar', '4.4.13'],
  ['shell-quote', '1.7.2'],
  ['glob-parent', '5.1.1'],
  ['glob-parent', '3.1.0'],
  ['hosted-git-info', '2.8.8'],
  ['hosted-git-info', '3.0.7'],
  ['ini', '1.3.5'],
  ['ini', '1.3.7'],
  ['y18n', '4.0.0'],
  ['y18n', '5.0.4'],
  ['acorn', '5.7.3'],
  ['acorn', '6.4.0'],
  ['bl', '1.2.2'],
  ['bl', '4.0.2'],
  ['node-forge', '0.10.0'],
  ['node-forge', '0.9.0'],
  ['follow-redirects', '1.14.7'],
  ['follow-redirects', '1.14.0'],
  ['simple-get', '3.1.0'],
  ['mout', '1.2.2'],
  ['jquery', '3.5.0'],
  ['jquery', '2.2.4'],
  ['moment', '2.29.1'],
  ['moment', '2.29.3'],
  ['async', '2.6.3'],
  ['async', '3.2.0'],
  ['underscore', '1.12.0'],
  ['underscore', '1.13.1'],
  ['left-pad', '1.3.0'],
];

function headers() {
  return {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function post(pathname, body) {
  const started = performance.now();
  const res = await fetch(`${API}${pathname}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    bytes: Buffer.byteLength(text),
    durationMs: Math.round(performance.now() - started),
    json,
    text,
  };
}

async function get(pathname) {
  const started = performance.now();
  const res = await fetch(`${API}${pathname}`, { headers: headers() });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    bytes: Buffer.byteLength(text),
    durationMs: Math.round(performance.now() - started),
    json,
    text,
  };
}

function queryBody(pairs) {
  return {
    queries: pairs.map(([name, version]) => ({
      package: { name, ecosystem: 'npm' },
      version,
    })),
  };
}

// --- CVSS v3 base score (untuk membandingkan `severity` OSV) ----------------

const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC = { L: 0.77, H: 0.44 };
const UI = { N: 0.85, R: 0.62 };
const CIA = { H: 0.56, L: 0.22, N: 0 };

function roundUp(value) {
  const scaled = Math.round(value * 100000);
  if (scaled % 10000 === 0) return scaled / 100000;
  return (Math.floor(scaled / 10000) + 1) / 10;
}

function parseVector(vector) {
  const parts = {};
  for (const piece of vector.split('/')) {
    const [key, value] = piece.split(':');
    if (key && value) parts[key] = value;
  }
  return parts;
}

function cvssV3Score(vector) {
  const p = parseVector(vector);
  if (!p.AV || !p.AC || !p.PR || !p.UI || !p.S || !p.C || !p.I || !p.A) return null;
  const changed = p.S === 'C';
  const pr = changed
    ? { N: 0.85, L: 0.68, H: 0.5 }[p.PR]
    : { N: 0.85, L: 0.62, H: 0.27 }[p.PR];
  const iss = 1 - (1 - CIA[p.C]) * (1 - CIA[p.I]) * (1 - CIA[p.A]);
  const impact = changed
    ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
    : 6.42 * iss;
  const exploitability = 8.22 * AV[p.AV] * AC[p.AC] * pr * UI[p.UI];
  if (impact <= 0) return 0;
  const raw = changed
    ? Math.min(1.08 * (impact + exploitability), 10)
    : Math.min(impact + exploitability, 10);
  return roundUp(raw);
}

function bucketFromScore(score) {
  if (score === null || score === undefined) return 'UNKNOWN';
  if (score >= 9) return 'CRITICAL';
  if (score >= 7) return 'HIGH';
  if (score >= 4) return 'MEDIUM';
  if (score >= 0.1) return 'LOW';
  return 'UNKNOWN';
}

function normalizeSeverity(detail) {
  const structured = detail.severity ?? [];
  const cvssV3 = structured.find((entry) => entry.type === 'CVSS_V3');
  const cvssV4 = structured.find((entry) => entry.type === 'CVSS_V4');
  const score = cvssV3 ? cvssV3Score(cvssV3.score) : null;
  const dbSeverity = detail.database_specific?.severity ?? null;
  let level = 'UNKNOWN';
  let source = 'UNKNOWN';
  if (cvssV3 && score !== null) {
    level = bucketFromScore(score);
    source = 'CVSS_V3';
  } else if (dbSeverity) {
    level = String(dbSeverity).toUpperCase();
    // GitHub memakai MODERATE; PRD memakai MEDIUM.
    if (level === 'MODERATE') level = 'MEDIUM';
    source = 'database_specific.severity';
  }
  return {
    structuredTypes: structured.map((entry) => entry.type),
    structuredScores: structured.map((entry) => entry.score),
    cvssV3Vector: cvssV3?.score ?? null,
    cvssV3Score: score,
    cvssV4Present: Boolean(cvssV4),
    databaseSpecificSeverity: dbSeverity,
    normalizedLevel: level,
    source,
  };
}

function fixedVersions(detail) {
  const fixed = new Set();
  for (const affected of detail.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) fixed.add(event.fixed);
      }
    }
  }
  return [...fixed];
}

function summarizeDetail(detail) {
  const aliases = detail.aliases ?? [];
  return {
    id: detail.id,
    aliases,
    cveIds: aliases.filter((alias) => alias.startsWith('CVE-')),
    ghsaIds: [detail.id, ...aliases].filter((id) => id.startsWith('GHSA-')),
    summary: detail.summary ?? null,
    published: detail.published ?? null,
    modified: detail.modified ?? null,
    severity: normalizeSeverity(detail),
    fixedVersions: fixedVersions(detail),
    affected: (detail.affected ?? []).map((affected) => ({
      package: affected.package?.name ?? null,
      ecosystem: affected.package?.ecosystem ?? null,
      ranges: affected.ranges ?? [],
      versionsCount: (affected.versions ?? []).length,
    })),
    referencesCount: (detail.references ?? []).length,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // 1. Batch 50 query.
  const batch = await post('/querybatch', queryBody(QUERIES));
  const batchResults = batch.json?.results ?? [];
  const perQuery = QUERIES.map(([name, version], index) => {
    const result = batchResults[index] ?? {};
    const vulns = result.vulns ?? [];
    return {
      index,
      package: name,
      version,
      findingCount: vulns.length,
      vulnIds: vulns.map((vuln) => vuln.id),
      hasDetailInBatch: vulns.some((vuln) => vuln.summary || vuln.severity || vuln.affected),
    };
  });

  await writeFile(
    path.join(OUT_DIR, 'batch-50.json'),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        endpoint: `${API}/querybatch`,
        status: batch.status,
        contentType: batch.contentType,
        bytes: batch.bytes,
        durationMs: batch.durationMs,
        queryCount: QUERIES.length,
        resultCount: batchResults.length,
        request: queryBody(QUERIES),
        response: batch.json,
      },
      null,
      2,
    )}\n`,
  );

  const vulnerablePairs = perQuery.filter((entry) => entry.findingCount > 0);
  const neutralPairs = perQuery.filter((entry) => entry.findingCount === 0);

  // 2. Detail advisory (minimal 20). Ambil ID unik dari hasil batch.
  const uniqueIds = [];
  for (const entry of vulnerablePairs) {
    for (const id of entry.vulnIds) {
      if (!uniqueIds.includes(id)) uniqueIds.push(id);
    }
  }
  const detailIds = uniqueIds.slice(0, DETAIL_LIMIT);
  const details = [];
  const detailFailures = [];
  for (const id of detailIds) {
    const res = await get(`/vulns/${encodeURIComponent(id)}`);
    if (res.status === 200 && res.json) {
      details.push({
        ...summarizeDetail(res.json),
        bytes: res.bytes,
        durationMs: res.durationMs,
        raw: res.json,
      });
    } else {
      detailFailures.push({ id, status: res.status, body: res.text.slice(0, 300) });
    }
  }

  await writeFile(
    path.join(OUT_DIR, 'advisory-details.json'),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        requested: detailIds.length,
        succeeded: details.length,
        failures: detailFailures,
        details: details.map(({ raw, ...rest }) => rest),
      },
      null,
      2,
    )}\n`,
  );

  // Simpan respons detail mentah secara terpisah agar bentuk asli tetap ada.
  await writeFile(
    path.join(OUT_DIR, 'advisory-raw.json'),
    `${JSON.stringify(
      Object.fromEntries(details.map((detail) => [detail.id, detail.raw])),
      null,
      2,
    )}\n`,
  );

  const severityRows = details.map((detail) => ({
    id: detail.id,
    cveIds: detail.cveIds,
    ghsaIds: detail.ghsaIds,
    structuredTypes: detail.severity.structuredTypes,
    cvssV3Vector: detail.severity.cvssV3Vector,
    cvssV3Score: detail.severity.cvssV3Score,
    cvssBucket: bucketFromScore(detail.severity.cvssV3Score),
    databaseSpecificSeverity: detail.severity.databaseSpecificSeverity,
    normalizedLevel: detail.severity.normalizedLevel,
    source: detail.severity.source,
    fixedVersions: detail.fixedVersions,
  }));

  const withCve = severityRows.filter((row) => row.cveIds.length > 0).length;
  const ghsaWithCve = severityRows.filter(
    (row) => row.id.startsWith('GHSA-') && row.cveIds.length > 0,
  ).length;
  const ghsaWithoutCve = severityRows.filter(
    (row) => row.id.startsWith('GHSA-') && row.cveIds.length === 0,
  ).length;

  // 3a. Paket tanpa advisory (fixture netral).
  const neutralPair = ['left-pad', '1.3.0'];
  const neutral = await post('/querybatch', queryBody([neutralPair]));
  await writeFile(
    path.join(OUT_DIR, 'neutral.json'),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        package: neutralPair[0],
        version: neutralPair[1],
        status: neutral.status,
        bytes: neutral.bytes,
        durationMs: neutral.durationMs,
        response: neutral.json,
      },
      null,
      2,
    )}\n`,
  );

  // 3b. Uji penerimaan batch lebih besar (100 query) untuk mencatat batas.
  const chunkTrials = [];
  for (const queryCount of [100, 200, 1000, 1001]) {
    const queries = [];
    while (queries.length < queryCount) {
      for (const pair of QUERIES) {
        if (queries.length === queryCount) break;
        queries.push(pair);
      }
    }
    const trial = await post('/querybatch', queryBody(queries));
    chunkTrials.push({
      queryCount,
      status: trial.status,
      bytes: trial.bytes,
      resultCount: trial.json?.results?.length ?? null,
      error: trial.status >= 400 ? trial.text.slice(0, 300) : null,
    });
  }
  await writeFile(
    path.join(OUT_DIR, 'chunk-boundary.json'),
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        trials: chunkTrials,
      },
      null,
      2,
    )}\n`,
  );

  // 4. Ringkasan keputusan.
  const summary = {
    probedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endpoint: API,
    batch: {
      status: batch.status,
      queryCount: QUERIES.length,
      resultCount: batchResults.length,
      bytes: batch.bytes,
      durationMs: batch.durationMs,
      vulnsInBatchIncludeDetail: perQuery.some((entry) => entry.hasDetailInBatch),
      vulnerablePairs: vulnerablePairs.length,
      neutralPairs: neutralPairs.length,
      totalFindings: perQuery.reduce((sum, entry) => sum + entry.findingCount, 0),
      uniqueAdvisories: uniqueIds.length,
    },
    details: {
      requested: detailIds.length,
      succeeded: details.length,
      failures: detailFailures,
      advisoriesWithCveAlias: withCve,
      ghsaWithCveAlias: ghsaWithCve,
      ghsaWithoutCveAlias: ghsaWithoutCve,
    },
    severityRows,
    chunkBoundary: chunkTrials,
    neutral: {
      package: neutralPair[0],
      version: neutralPair[1],
      status: neutral.status,
      findingCount: neutral.json?.results?.[0]?.vulns?.length ?? 0,
    },
    rateLimit: {
      status429Observed: false,
      status5xxObserved: false,
      note: 'Tidak terpicu selama probe normal; perlakukan 429/5xx sebagai error sementara dengan backoff.',
    },
  };
  await writeFile(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(`batch status=${batch.status} queries=${QUERIES.length} results=${batchResults.length} bytes=${batch.bytes}`);
  console.log(`vulnerablePairs=${vulnerablePairs.length} neutralPairs=${neutralPairs.length} findings=${summary.batch.totalFindings} unique=${uniqueIds.length}`);
  console.log(`details ${details.length}/${detailIds.length} fetched; GHSA+CVE=${ghsaWithCve} GHSA tanpa CVE=${ghsaWithoutCve}`);
  for (const row of severityRows.slice(0, 8)) {
    console.log(
      `${row.id} cvss=${row.cvssV3Score ?? '-'} bucket=${row.cvssBucket} db=${row.databaseSpecificSeverity ?? '-'} -> ${row.normalizedLevel} [${row.source}]`,
    );
  }
  console.log(`neutral ${neutralPair[0]}@${neutralPair[1]} findings=${summary.neutral.findingCount}`);
  console.log(
    `chunk: ${chunkTrials.map((trial) => `${trial.queryCount}=${trial.status}`).join(', ')}`,
  );
}

main().catch((error) => {
  console.error('Probe gagal:', error.message);
  process.exitCode = 1;
});
