#!/usr/bin/env node
/**
 * Probe CISA KEV untuk PatchRadar (T-W1-04).
 *
 * Mengunduh katalog nyata, mencatat URL/ukuran/waktu/lisensi, memverifikasi
 * field wajib, menghitung cakupan CVE-only, dan menyimpan subset fixture.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FEED = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const LICENSE = 'https://www.cisa.gov/sites/default/files/licenses/kev/license.txt';
const SCHEMA = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities_schema.json';
const OUT_DIR = path.resolve('fixtures/kev');
const USER_AGENT = 'PatchRadar-Probe/1.0';
const REQUIRED_FIELDS = [
  'cveID',
  'vendorProject',
  'product',
  'dateAdded',
  'knownRansomwareCampaignUse',
];
const SUBSET_SIZE = 25;
const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/;

function h(content) {
  return createHash('sha256').update(content).digest('hex');
}

function countBy(items, pick) {
  const counts = {};
  for (const item of items) {
    const key = pick(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function fetchText(url, accept = 'application/json, text/plain;q=0.9, */*;q=0.8') {
  const started = performance.now();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept } });
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    url,
    finalUrl: res.url,
    status: res.status,
    contentType: res.headers.get('content-type'),
    contentLength: res.headers.get('content-length'),
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
    bytes: buffer.length,
    sha256: h(buffer),
    durationMs: Math.round(performance.now() - started),
    text: buffer.toString('utf8'),
  };
}

function pickSubset(entries) {
  const picked = [];
  const seen = new Set();
  const add = (entry) => {
    if (picked.length >= SUBSET_SIZE || seen.has(entry.cveID)) return;
    seen.add(entry.cveID);
    picked.push(entry);
  };
  // Sebar: awal katalog, ransomware Known, ransomware Unknown, dan vendor berbeda.
  for (const entry of entries) {
    if (entry.knownRansomwareCampaignUse === 'Known') add(entry);
    if (picked.length >= 10) break;
  }
  for (const entry of entries) {
    if (entry.knownRansomwareCampaignUse === 'Unknown') add(entry);
    if (picked.length >= 20) break;
  }
  for (const entry of entries) add(entry);
  return picked;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const feed = await fetchText(FEED);
  if (feed.status !== 200) {
    throw new Error(`Feed KEV status ${feed.status}`);
  }
  const catalog = JSON.parse(feed.text);
  const entries = catalog.vulnerabilities ?? [];

  const missingFields = [];
  const invalidCve = [];
  for (const entry of entries) {
    const missing = REQUIRED_FIELDS.filter((field) => !entry[field]);
    if (missing.length > 0) missingFields.push({ cveID: entry.cveID ?? null, missing });
    if (!CVE_PATTERN.test(entry.cveID ?? '')) invalidCve.push(entry.cveID ?? null);
  }

  const dates = entries.map((entry) => entry.dateAdded).filter(Boolean).sort();
  const subset = pickSubset(entries);

  const license = await fetchText(LICENSE, 'text/plain, */*;q=0.8');
  const schema = await fetchText(SCHEMA);

  const summary = {
    fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    feed: {
      url: FEED,
      finalUrl: feed.finalUrl,
      status: feed.status,
      contentType: feed.contentType,
      contentLength: feed.contentLength,
      etag: feed.etag,
      lastModified: feed.lastModified,
      bytes: feed.bytes,
      sha256: feed.sha256,
      durationMs: feed.durationMs,
    },
    catalog: {
      title: catalog.title ?? null,
      catalogVersion: catalog.catalogVersion ?? null,
      dateReleased: catalog.dateReleased ?? null,
      declaredCount: catalog.count ?? null,
      actualCount: entries.length,
      countMatches: catalog.count === entries.length,
      dateRange: { first: dates[0] ?? null, last: dates.at(-1) ?? null },
    },
    fields: {
      required: REQUIRED_FIELDS,
      presentInAll:
        missingFields.length === 0 && entries.every((entry) => REQUIRED_FIELDS.every((f) => Boolean(entry[f]))),
      missingFieldEntries: missingFields,
      allFieldsObserved: [...new Set(entries.flatMap((entry) => Object.keys(entry)))].sort(),
    },
    cveOnly: {
      total: entries.length,
      matchingPattern: invalidCve.length === 0 ? entries.length : entries.length - invalidCve.length,
      nonMatching: invalidCve,
      coverageRatio: entries.length === 0 ? null : (entries.length - invalidCve.length) / entries.length,
    },
    ransomware: countBy(entries, (entry) => entry.knownRansomwareCampaignUse),
    vendors: {
      uniqueVendors: new Set(entries.map((entry) => entry.vendorProject)).size,
      uniqueProducts: new Set(entries.map((entry) => `${entry.vendorProject}::${entry.product}`)).size,
    },
    license: {
      url: LICENSE,
      status: license.status,
      contentType: license.contentType,
      bytes: license.bytes,
      sha256: license.sha256,
      firstLine: license.text.split(/\r?\n/)[0] ?? null,
      summary:
        'KEV database distributed under Creative Commons 0 1.0 (CC0 1.0 Universal); third-party links remain under their own policies; CISA/DHS logo and seal not authorized.',
    },
    schema: {
      url: SCHEMA,
      status: schema.status,
      contentType: schema.contentType,
      bytes: schema.bytes,
    },
    stalePolicy: {
      decision: 'Refresh lazy bila salinan lebih tua dari 24 jam; jika refresh gagal dan salinan ada, pakai salinan lama + STALE; jika belum ada salinan, lanjut dengan kev=false + warning parsial.',
      basis: {
        fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        catalogVersion: catalog.catalogVersion ?? null,
        dateReleased: catalog.dateReleased ?? null,
        note: 'dateReleased adalah tanggal rilis katalog CISA, bukan waktu unduh; TTL dihitung dari fetched_at/updated_at salinan lokal.',
      },
    },
    subset: subset.map((entry) => ({
      cveID: entry.cveID,
      vendorProject: entry.vendorProject,
      product: entry.product,
      dateAdded: entry.dateAdded,
      knownRansomwareCampaignUse: entry.knownRansomwareCampaignUse,
      vulnerabilityName: entry.vulnerabilityName,
      shortDescription: entry.shortDescription,
      requiredAction: entry.requiredAction,
      dueDate: entry.dueDate,
    })),
  };

  await writeFile(path.join(OUT_DIR, 'subset.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(
    path.join(OUT_DIR, 'license.txt'),
    `Sumber: ${LICENSE}\nDiunduh: ${summary.fetchedAt}\n\n${license.text}`,
  );

  console.log(`KEV status=${feed.status} bytes=${feed.bytes} ms=${feed.durationMs} sha=${feed.sha256.slice(0, 12)}`);
  console.log(
    `catalogVersion=${summary.catalog.catalogVersion} dateReleased=${summary.catalog.dateReleased} ` +
      `count=${entries.length} (declared ${summary.catalog.declaredCount})`,
  );
  console.log(`fieldsPresentInAll=${summary.fields.presentInAll} missing=${missingFields.length}`);
  console.log(
    `cveOnly=${summary.cveOnly.matchingPattern}/${entries.length} ransomware=${JSON.stringify(summary.ransomware)} ` +
      `vendors=${summary.vendors.uniqueVendors}`,
  );
  console.log(`license status=${license.status} firstLine=${JSON.stringify(summary.license.firstLine)}`);
  console.log(`subset entries=${subset.length}`);
}

main().catch((error) => {
  console.error('Probe gagal:', error.message);
  process.exitCode = 1;
});
