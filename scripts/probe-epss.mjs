#!/usr/bin/env node
/**
 * Probe EPSS FIRST untuk PatchRadar (T-W1-05).
 *
 * Mengukur format respons, batas jumlah CVE per request, perilaku CVE tanpa
 * skor, 404, respons kosong, dan header cache. Nilai yang tidak tersedia
 * dipetakan ke null, bukan angka karangan.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://api.first.org/data/v1/epss';
const KEV_FEED = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const OUT_DIR = path.resolve('fixtures/epss');
const USER_AGENT = 'PatchRadar-Probe/1.0';
const SINGLE_CVE = 'CVE-2021-44228';
const BATCH_3 = ['CVE-2021-44228', 'CVE-2021-45046', 'CVE-2020-1472'];
const UNKNOWN_CVE = 'CVE-9999-99999';

function headersOf(res) {
  const picked = {};
  for (const name of [
    'content-type',
    'content-length',
    'cache-control',
    'x-total',
    'x-access',
    'etag',
    'last-modified',
    'retry-after',
  ]) {
    const value = res.headers.get(name);
    if (value !== null) picked[name] = value;
  }
  return picked;
}

async function get(query) {
  const url = `${API}${query}`;
  const started = performance.now();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return {
    url,
    status: res.status,
    headers: headersOf(res),
    bytes: Buffer.byteLength(text),
    durationMs: Math.round(performance.now() - started),
    json,
    textPreview: text.slice(0, 300),
  };
}

function cveParam(cves) {
  return `?cve=${cves.map(encodeURIComponent).join(',')}`;
}

function toRecord(cve, data) {
  const entry = data.find((row) => row.cve === cve);
  if (!entry) {
    return { cve, epss: null, percentile: null, date: null, available: false };
  }
  return {
    cve,
    epss: Number(entry.epss),
    percentile: Number(entry.percentile),
    date: entry.date ?? null,
    available: true,
  };
}

async function kevCves(count) {
  const res = await fetch(KEV_FEED, { headers: { 'User-Agent': USER_AGENT } });
  const json = await res.json();
  return (json.vulnerabilities ?? []).slice(0, count).map((entry) => entry.cveID);
}

async function limitTrial(cves, extraQuery = '') {
  const query = `${cveParam(cves)}${extraQuery}`;
  const res = await get(query);
  const data = res.json?.data ?? [];
  return {
    requested: cves.length,
    extraQuery: extraQuery || null,
    urlLength: `${API}${query}`.length,
    status: res.status,
    total: res.json?.total ?? null,
    dataLength: data.length,
    offset: res.json?.offset ?? null,
    limit: res.json?.limit ?? null,
    bytes: res.bytes,
    durationMs: res.durationMs,
    error: res.status >= 400 ? res.textPreview : null,
    missingFromResponse: cves.filter((cve) => !data.some((row) => row.cve === cve)).length,
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  // 1. Satu CVE.
  const single = await get(cveParam([SINGLE_CVE]));
  const singleRecord = toRecord(SINGLE_CVE, single.json?.data ?? []);

  // 2. Tiga CVE dalam satu request.
  const batch3 = await get(cveParam(BATCH_3));
  const batch3Records = BATCH_3.map((cve) => toRecord(cve, batch3.json?.data ?? []));

  // 3. Daftar CVE nyata dari KEV untuk uji batas.
  const cves250 = await kevCves(250);
  const limitTrials = [];
  for (const count of [50, 100, 101, 120, 130, 131, 132, 133, 134, 140, 150, 200, 250]) {
    limitTrials.push(await limitTrial(cves250.slice(0, count)));
  }
  const limitTrialsLargeParam = [];
  for (const count of [101, 120, 133, 134, 150, 200]) {
    limitTrialsLargeParam.push(await limitTrial(cves250.slice(0, count), '&limit=1000'));
  }

  // 4. CVE tanpa skor dan respons kosong.
  const unknown = await get(cveParam([UNKNOWN_CVE]));
  const mixed = await get(cveParam([SINGLE_CVE, UNKNOWN_CVE]));
  const malformed = await get('?cve=not-a-cve');
  const emptyParam = await get('?cve=&limit=1');
  const noParam = await get('?limit=1');
  const notFound = await get('/tidak-ada?cve=CVE-2021-44228');

  const missingCases = {
    unknownCve: {
      cve: UNKNOWN_CVE,
      status: unknown.status,
      total: unknown.json?.total ?? null,
      dataLength: unknown.json?.data?.length ?? null,
      record: toRecord(UNKNOWN_CVE, unknown.json?.data ?? []),
    },
    mixedKnownUnknown: {
      status: mixed.status,
      total: mixed.json?.total ?? null,
      records: [SINGLE_CVE, UNKNOWN_CVE].map((cve) => toRecord(cve, mixed.json?.data ?? [])),
    },
    malformedCve: {
      status: malformed.status,
      total: malformed.json?.total ?? null,
      dataLength: malformed.json?.data?.length ?? null,
      textPreview: malformed.textPreview,
    },
    emptyCveParam: {
      status: emptyParam.status,
      total: emptyParam.json?.total ?? null,
      dataLength: emptyParam.json?.data?.length ?? null,
      limit: emptyParam.json?.limit ?? null,
    },
    noCveParam: {
      status: noParam.status,
      total: noParam.json?.total ?? null,
      dataLength: noParam.json?.data?.length ?? null,
      limit: noParam.json?.limit ?? null,
    },
    invalidPath: {
      status: notFound.status,
      textPreview: notFound.textPreview,
    },
  };

  const summary = {
    probedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    endpoint: API,
    single: {
      status: single.status,
      bytes: single.bytes,
      durationMs: single.durationMs,
      headers: single.headers,
      response: single.json,
      record: singleRecord,
    },
    batch3: {
      status: batch3.status,
      bytes: batch3.bytes,
      durationMs: batch3.durationMs,
      total: batch3.json?.total ?? null,
      dataLength: batch3.json?.data?.length ?? null,
      records: batch3Records,
    },
    limitTrials,
    limitTrialsLargeParam,
    missingCases,
    outputFormat: {
      epssType: 'string desimal 0-1 (contoh "0.999990000")',
      percentileType: 'string desimal 0-1 (contoh "1.000000000")',
      date: 'YYYY-MM-DD',
      missingRecord: 'Tidak ada entri di data → epss=null, percentile=null, available=false',
    },
    cacheDecision: {
      basis: 'Cache-Control: public, max-age=86400, s-maxage=86400 pada respons nyata',
      ttlSeconds: 86400,
      policy:
        'Cache per CVE selama 24 jam; hasil kosong juga disimpan sebagai negatif. Jika request gagal dan cache ada, pakai nilai cache + tandai parsial; jika tidak ada cache, epss=null + epssAvailable=false.',
    },
    rateLimit: {
      status429Observed: false,
      note: 'Tidak ada header rate-limit khusus; 429 tidak terpicu selama probe normal. Perlakukan 429/5xx sebagai error sementara dengan backoff.',
    },
  };

  await writeFile(path.join(OUT_DIR, 'single.json'), `${JSON.stringify(summary.single, null, 2)}\n`);
  await writeFile(path.join(OUT_DIR, 'batch-3.json'), `${JSON.stringify(summary.batch3, null, 2)}\n`);
  await writeFile(path.join(OUT_DIR, 'batch-limits.json'), `${JSON.stringify({ limitTrials, limitTrialsLargeParam }, null, 2)}\n`);
  await writeFile(path.join(OUT_DIR, 'missing.json'), `${JSON.stringify(missingCases, null, 2)}\n`);
  await writeFile(path.join(OUT_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  console.log(
    `single ${SINGLE_CVE} status=${single.status} bytes=${single.bytes} epss=${singleRecord.epss} percentile=${singleRecord.percentile}`,
  );
  console.log(`batch3 status=${batch3.status} total=${summary.batch3.total} data=${summary.batch3.dataLength}`);
  for (const trial of limitTrials) {
    console.log(
      `limit ${trial.requested}: status=${trial.status} total=${trial.total} data=${trial.dataLength} limit=${trial.limit} url=${trial.urlLength} missing=${trial.missingFromResponse}`,
    );
  }
  for (const trial of limitTrialsLargeParam) {
    console.log(
      `limit ${trial.requested} +limit=1000: status=${trial.status} total=${trial.total} data=${trial.dataLength} limit=${trial.limit}`,
    );
  }
  console.log(
    `unknown status=${missingCases.unknownCve.status} total=${missingCases.unknownCve.total} data=${missingCases.unknownCve.dataLength} record=${JSON.stringify(missingCases.unknownCve.record)}`,
  );
  console.log(`invalidPath status=${missingCases.invalidPath.status}`);
}

main().catch((error) => {
  console.error('Probe gagal:', error.message);
  process.exitCode = 1;
});
