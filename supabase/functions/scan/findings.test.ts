import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { assembleBaseFindings, buildBaseFindings, findingKey } from './findings.ts';
import type { ParsedPackage } from './lib/dedupe.ts';
import { createStageTimings } from './lib/timing.ts';
import type { OsvEnrichmentResult } from './osv.ts';

const PACKAGES: ParsedPackage[] = [
  { name: 'lodash', version: '4.17.15', direct: true, devOnly: false, parentPackage: null },
  { name: 'express', version: '4.18.2', direct: true, devOnly: false, parentPackage: null },
];

const ADVISORIES = {
  'GHSA-29mw-wpgm-hmr9': {
    id: 'GHSA-29mw-wpgm-hmr9',
    aliases: ['CVE-2020-28500'],
    summary: 'ReDoS pada lodash',
  },
  'GHSA-xxjr-mmjv-4gpg': {
    id: 'GHSA-xxjr-mmjv-4gpg',
    aliases: ['CVE-2025-13465', 'cve-2025-13466'],
  },
};

test('findings dasar memuat ID advisory, alias CVE, paket, dan versi terpasang', () => {
  const findings = buildBaseFindings(
    PACKAGES,
    [
      {
        name: 'lodash',
        version: '4.17.15',
        vulns: [
          { id: 'GHSA-29mw-wpgm-hmr9', modified: '' },
          { id: 'GHSA-xxjr-mmjv-4gpg', modified: '' },
        ],
      },
      { name: 'express', version: '4.18.2', vulns: [] },
    ],
    ADVISORIES,
  );

  assert.equal(findings.length, 2);
  assert.deepEqual(findings[0], {
    findingKey: findingKey('GHSA-29mw-wpgm-hmr9', 'lodash', '4.17.15'),
    osvId: 'GHSA-29mw-wpgm-hmr9',
    cveIds: ['CVE-2020-28500'],
    ghsaIds: ['GHSA-29MW-WPGM-HMR9'],
    packageName: 'lodash',
    installedVersion: '4.17.15',
    direct: true,
    devOnly: false,
    parentPackage: null,
  });
  assert.deepEqual(findings[1]?.cveIds, ['CVE-2025-13465', 'CVE-2025-13466']);
});

test('paket tanpa temuan tidak muncul di findings', () => {
  const findings = buildBaseFindings(
    PACKAGES,
    [
      { name: 'lodash', version: '4.17.15', vulns: [] },
      { name: 'express', version: '4.18.2', vulns: [] },
    ],
    ADVISORIES,
  );
  assert.deepEqual(findings, []);
});

test('advisory tanpa detail tetap memakai ID OSV dan metadata paket transitif', () => {
  const findings = buildBaseFindings(
    [
      {
        name: 'safe-buffer',
        version: '5.1.2',
        direct: false,
        devOnly: true,
        parentPackage: 'basic-auth',
      },
    ],
    [{ name: 'safe-buffer', version: '5.1.2', vulns: [{ id: 'GHSA-xxxx-yyyy-zzzz', modified: '' }] }],
    {},
  );

  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0]?.ghsaIds, ['GHSA-XXXX-YYYY-ZZZZ']);
  assert.deepEqual(findings[0]?.cveIds, []);
  assert.equal(findings[0]?.direct, false);
  assert.equal(findings[0]?.devOnly, true);
  assert.equal(findings[0]?.parentPackage, 'basic-auth');
});

test('finding ganda untuk paket+advisory yang sama dideduplikasi', () => {
  const findings = buildBaseFindings(
    [{ name: 'lodash', version: '4.17.15', direct: true, devOnly: false, parentPackage: null }],
    [
      { name: 'lodash', version: '4.17.15', vulns: [{ id: 'GHSA-29mw-wpgm-hmr9', modified: '' }] },
      { name: 'lodash', version: '4.17.15', vulns: [{ id: 'GHSA-29mw-wpgm-hmr9', modified: '' }] },
    ],
    ADVISORIES,
  );
  assert.equal(findings.length, 1);
});

test('assembleBaseFindings mencatat tahap penyusunan findings sebagai sinkron', async () => {
  const timings = createStageTimings();
  const enrichment: OsvEnrichmentResult = {
    packageResults: [
      { name: 'lodash', version: '4.17.15', vulns: [{ id: 'GHSA-29mw-wpgm-hmr9', modified: '' }] },
    ],
    advisories: ADVISORIES,
    warnings: [],
    partial: false,
    sourceStatus: 'OK',
    cacheHits: 0,
    cacheMisses: 1,
    detailCacheHits: 0,
    batchRequests: 1,
    detailRequests: 1,
    timings,
  };

  const result = await assembleBaseFindings({ packages: PACKAGES, enrichment, timings });

  assert.equal(result.findings.length, 1);
  assert.ok('findings.assembly' in timings.sync);
  assert.equal(Object.keys(timings.async).length, 0);
});
