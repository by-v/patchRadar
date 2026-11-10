import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createStageTimings } from './lib/timing.ts';
import type { ParseSuccess } from './lib/lockfile.ts';
import type { BaseFinding } from './findings.ts';
import type { EpssResult, EpssScore } from './epss.ts';
import type { KevCatalogResult } from './kev.ts';
import type { OsvAdvisoryDetail, OsvEnrichmentResult } from './osv.ts';
import { buildScanResponse, findSafeVersion, type BuildScanResponseInput } from './response.ts';

const PARSED: ParseSuccess = {
  source: 'LOCKFILE',
  estimated: false,
  lockfileVersion: 3,
  totalPackages: 2,
  packages: [
    { name: 'express', version: '4.21.2', direct: true, devOnly: false, parentPackage: null },
    { name: 'minimist', version: '1.2.5', direct: false, devOnly: false, parentPackage: 'mkdirp' },
  ],
  warnings: [],
};

const ADVISORIES: Record<string, OsvAdvisoryDetail> = {
  'GHSA-aaaa-bbbb-cccc': {
    id: 'GHSA-aaaa-bbbb-cccc',
    aliases: ['CVE-2099-0001'],
    summary: 'Penyerang dapat menjalankan kode saat input diproses.',
    severity: [{ type: 'CVSS_V3', score: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }],
    affected: [
      {
        package: { name: 'express', ecosystem: 'npm' },
        ranges: [
          {
            type: 'SEMVER',
            events: [{ introduced: '0' }, { fixed: '4.21.4' }, { fixed: '4.21.3' }],
          },
        ],
      },
    ],
    references: [{ type: 'ADVISORY', url: 'https://example.test/express' }],
  },
  'GHSA-dddd-eeee-ffff': {
    id: 'GHSA-dddd-eeee-ffff',
    aliases: ['CVE-2099-0002'],
    summary: 'Versi lama memanipulasi data saat memproses input tertentu.',
    database_specific: { severity: 'MODERATE' },
    affected: [
      {
        package: { name: 'minimist', ecosystem: 'npm' },
        ranges: [{ type: 'SEMVER', events: [{ introduced: '0' }, { fixed: '1.2.8' }] }],
      },
    ],
    references: [],
  },
};

const FINDINGS: Array<BaseFinding & { kev: boolean }> = [
  {
    findingKey: 'GHSA-aaaa-bbbb-cccc|express@4.21.2',
    osvId: 'GHSA-aaaa-bbbb-cccc',
    cveIds: ['CVE-2099-0001'],
    ghsaIds: ['GHSA-AAAA-BBBB-CCCC'],
    packageName: 'express',
    installedVersion: '4.21.2',
    direct: true,
    devOnly: false,
    parentPackage: null,
    kev: true,
  },
  {
    findingKey: 'GHSA-dddd-eeee-ffff|minimist@1.2.5',
    osvId: 'GHSA-dddd-eeee-ffff',
    cveIds: ['CVE-2099-0002'],
    ghsaIds: ['GHSA-DDDD-EEEE-FFFF'],
    packageName: 'minimist',
    installedVersion: '1.2.5',
    direct: false,
    devOnly: false,
    parentPackage: 'mkdirp',
    kev: false,
  },
];

function epssScore(cveId: string, value: number, available = true): EpssScore {
  return { cveId, epss: available ? value : null, percentile: available ? 0.9 : null, available };
}

function makeEpss(overrides: Partial<EpssResult> = {}): EpssResult {
  return {
    scores: new Map([
      ['CVE-2099-0001', epssScore('CVE-2099-0001', 0.5)],
      ['CVE-2099-0002', epssScore('CVE-2099-0002', 0.2)],
    ]),
    warnings: [],
    partial: false,
    sourceStatus: 'OK',
    requests: 1,
    timings: createStageTimings(),
    ...overrides,
  };
}

const OSV: OsvEnrichmentResult = {
  packageResults: [
    {
      name: 'express',
      version: '4.21.2',
      vulns: [{ id: 'GHSA-aaaa-bbbb-cccc', modified: '2026-11-10T00:00:00.000Z' }],
    },
    {
      name: 'minimist',
      version: '1.2.5',
      vulns: [{ id: 'GHSA-dddd-eeee-ffff', modified: '2026-11-10T00:00:00.000Z' }],
    },
  ],
  advisories: ADVISORIES,
  warnings: [],
  partial: false,
  sourceStatus: 'OK',
  cacheHits: 0,
  cacheMisses: 2,
  detailCacheHits: 0,
  batchRequests: 1,
  detailRequests: 2,
  timings: createStageTimings(),
};

const KEV: KevCatalogResult = {
  entries: [
    {
      cveId: 'CVE-2099-0001',
      vendor: 'vendor',
      product: 'product',
      name: 'contoh',
      dateAdded: '2026-01-01',
      knownRansomware: false,
      raw: {},
      updatedAt: '2026-11-10T00:00:00.000Z',
    },
  ],
  sourceStatus: 'CACHE',
  warnings: [],
  refreshed: false,
  timings: createStageTimings(),
};

function input(overrides: Partial<BuildScanResponseInput> = {}): BuildScanResponseInput {
  const timings = createStageTimings();
  timings.async['osv.batch'] = 12.4;
  timings.async['kev.catalog.count'] = 1.2;
  timings.async['epss.fetch'] = 8.1;
  timings.sync['kev.match'] = 0.4;
  timings.sync['response.build'] = 2.6;

  let counter = 0;
  return {
    scanId: '6f1c2a9e-3b7d-4c21-9e8a-0d5f7a1b2c34',
    requestId: 'req_uji',
    owner: 'demo-user',
    repo: 'patchradar-demo',
    defaultBranch: 'main',
    scannedAt: '2026-11-10T10:15:30.000Z',
    parsed: PARSED,
    githubMs: 420.4,
    totalMs: 3600.2,
    osv: OSV,
    kev: KEV,
    epss: makeEpss(),
    findings: FINDINGS,
    timings,
    newFindingId: () => `finding-${(counter += 1)}`,
    ...overrides,
  };
}

test('respons final memuat kontrak §9, label, skor, alasan, dan urutan', () => {
  const body = buildScanResponse(input());

  assert.deepEqual(Object.keys(body).sort(), [
    'findings',
    'manifest',
    'partial',
    'persisted',
    'repo',
    'requestId',
    'scanId',
    'scannedAt',
    'sourceStatus',
    'status',
    'summary',
    'timings',
    'warnings',
  ]);
  assert.equal(body.status, 'COMPLETED');
  assert.equal(body.partial, false);
  assert.equal(body.persisted, false);
  assert.deepEqual(body.sourceStatus, { github: 'OK', osv: 'OK', kev: 'CACHE', epss: 'OK' });
  assert.deepEqual(body.timings, {
    githubMs: 420,
    osvMs: 12,
    enrichmentMs: 10,
    totalMs: 3600,
  });
  assert.deepEqual(body.summary, { totalPackages: 2, affectedPackages: 2, findingCount: 2 });
  assert.equal(body.findings.length, 2);

  const [first, second] = body.findings;
  assert.equal(first!.package.name, 'express');
  assert.equal(first!.priority.label, 'FIX_NOW');
  assert.equal(first!.priority.score, 77.5);
  assert.match(first!.priority.reason, /CISA KEV/);
  assert.deepEqual(first!.severity, { level: 'CRITICAL', cvss: 9.8, source: 'OSV' });
  assert.deepEqual(first!.fix, {
    safeVersion: '4.21.3',
    command: 'npm install express@4.21.3',
    suggestion: null,
  });
  assert.deepEqual(first!.exploitation, {
    kev: true,
    epss: 0.5,
    epssPercentile: 0.9,
    epssAvailable: true,
  });

  assert.equal(second!.package.name, 'minimist');
  assert.equal(second!.priority.label, 'SCHEDULE');
  assert.equal(second!.severity.level, 'MEDIUM');
  assert.equal(second!.fix.safeVersion, '1.2.8');
  assert.equal(second!.fix.command, null);
  assert.match(String(second!.fix.suggestion), /paket induk/);
});

test('EPSS gagal dan KEV STALE menghasilkan status PARTIAL + warning publik', () => {
  const body = buildScanResponse(
    input({
      epss: makeEpss({
        scores: new Map([
          ['CVE-2099-0001', epssScore('CVE-2099-0001', 0, false)],
          ['CVE-2099-0002', epssScore('CVE-2099-0002', 0, false)],
        ]),
        warnings: [
          {
            code: 'EPSS_UNAVAILABLE',
            message: 'Data EPSS tidak tersedia; prioritas sementara memakai severity dan KEV.',
          },
        ],
        partial: true,
        sourceStatus: 'FAILED',
      }),
      kev: {
        ...KEV,
        sourceStatus: 'STALE',
        warnings: [
          { code: 'KEV_STALE', message: 'Refresh KEV gagal; memakai salinan lama.' },
        ],
      },
    }),
  );

  assert.equal(body.status, 'PARTIAL');
  assert.equal(body.partial, true);
  assert.equal(typeof body.persisted, 'boolean');
  assert.deepEqual(body.sourceStatus, {
    github: 'OK',
    osv: 'OK',
    kev: 'STALE',
    epss: 'FAILED',
  });
  assert.ok(body.warnings.some((warning) => warning.code === 'EPSS_UNAVAILABLE'));
  assert.ok(body.warnings.some((warning) => warning.code === 'KEV_STALE'));
  assert.equal(body.findings[0]!.exploitation.epss, null);
  assert.equal(body.findings[0]!.exploitation.epssAvailable, false);
  assert.equal(body.findings[0]!.priority.label, 'FIX_NOW');
});

test('warning parser dipetakan ke LOCKFILE_PARTIAL dan deduplikasi', () => {
  const body = buildScanResponse(
    input({
      parsed: {
        ...PARSED,
        estimated: true,
        source: 'PACKAGE_JSON',
        lockfileVersion: null,
        warnings: [
          { code: 'LOCKFILE_MISSING', message: 'package-lock.json tidak ditemukan; memakai package.json.' },
        ],
      },
    }),
  );

  assert.equal(body.partial, true);
  assert.equal(body.status, 'PARTIAL');
  assert.deepEqual(body.warnings, [
    {
      code: 'LOCKFILE_PARTIAL',
      message: 'package-lock.json tidak ditemukan; memakai package.json.',
    },
  ]);
});

test('findSafeVersion memilih fixed terendah yang lebih tinggi dan mengabaikan versi tidak valid', () => {
  const detail: OsvAdvisoryDetail = {
    id: 'GHSA-uji',
    affected: [
      {
        package: { name: 'paket', ecosystem: 'npm' },
        ranges: [
          {
            type: 'SEMVER',
            events: [{ fixed: 'bukan-versi' }, { fixed: '2.0.0' }, { fixed: '1.5.0' }],
          },
        ],
      },
      {
        package: { name: 'paket-lain', ecosystem: 'npm' },
        ranges: [{ type: 'SEMVER', events: [{ fixed: '9.9.9' }] }],
      },
    ],
  };

  assert.equal(findSafeVersion(detail, 'paket', '1.2.0'), '1.5.0');
  assert.equal(findSafeVersion(detail, 'paket', '2.0.0'), null);
  assert.equal(findSafeVersion(null, 'paket', '1.0.0'), null);
});
