import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildFindingRecords,
  buildScanRecord,
  CLOUD_PERSIST_WARNING,
  markCloudPersistFailed,
  persistScanResult,
} from './persist.ts';
import type { ScanSuccessResponse } from './response.ts';
import { createMemoryScanStore } from './store.ts';

const USER_ID = '00000000-0000-4000-8000-0000000000aa';

function sampleResponse(): ScanSuccessResponse {
  return {
    scanId: '10000000-0000-4000-8000-0000000000aa',
    repo: {
      owner: 'lodash',
      name: 'lodash',
      url: 'https://github.com/lodash/lodash',
      defaultBranch: 'main',
    },
    scannedAt: '2026-11-15T10:00:00.000Z',
    status: 'PARTIAL',
    manifest: { source: 'PACKAGE_JSON', lockfileFormat: null, estimated: true },
    summary: { totalPackages: 27, affectedPackages: 1, findingCount: 1 },
    findings: [
      {
        findingId: '20000000-0000-4000-8000-0000000000aa',
        osvId: 'GHSA-test-0001',
        cveIds: ['CVE-2026-0001'],
        package: {
          name: 'lodash',
          installedVersion: '4.0.0',
          direct: true,
          devOnly: false,
          parentPackage: null,
        },
        severity: { level: 'HIGH', cvss: 7.5, source: 'OSV' },
        exploitation: { kev: true, epss: 0.5, epssPercentile: 0.9, epssAvailable: true },
        priority: { label: 'FIX_NOW', score: 62.5, reason: 'Ada di katalog KEV.' },
        fix: {
          safeVersion: '4.17.21',
          command: 'npm install lodash@4.17.21',
          suggestion: null,
        },
        summary: 'Contoh advisory.',
        references: [{ label: 'Advisory', url: 'https://example.test/advisory' }],
      },
    ],
    partial: true,
    persisted: false,
    warnings: [{ code: 'EPSS_UNAVAILABLE', message: 'EPSS tidak tersedia.' }],
    sourceStatus: { github: 'OK', osv: 'OK', kev: 'OK', epss: 'FAILED' },
    timings: { githubMs: 10, osvMs: 20, enrichmentMs: 5, totalMs: 40 },
    requestId: 'req_test',
  };
}

test('pemetaan scan memakai kolom dan nilai kontrak final', () => {
  const response = sampleResponse();
  const scan = buildScanRecord(response, USER_ID);

  assert.equal(scan.id, response.scanId);
  assert.equal(scan.userId, USER_ID);
  assert.equal(scan.repoOwner, 'lodash');
  assert.equal(scan.status, 'PARTIAL');
  assert.equal(scan.manifestSource, 'PACKAGE_JSON');
  assert.equal(scan.lockfileFormat, null);
  assert.equal(scan.totalPackages, 27);
  assert.equal(scan.findingCount, 1);
  assert.equal(scan.engineVersion, '1.0.0');
  assert.equal(scan.durationMs, 40);
  assert.equal(scan.createdAt, response.scannedAt);
});

test('pemetaan finding memakai field paket, severity, label, dan fix', () => {
  const response = sampleResponse();
  const [finding] = buildFindingRecords(response);

  assert.ok(finding);
  assert.equal(finding.id, '20000000-0000-4000-8000-0000000000aa');
  assert.equal(finding.scanId, response.scanId);
  assert.equal(finding.osvId, 'GHSA-test-0001');
  assert.deepEqual(finding.cveIds, ['CVE-2026-0001']);
  assert.equal(finding.packageName, 'lodash');
  assert.equal(finding.severity, 'HIGH');
  assert.equal(finding.cvssScore, 7.5);
  assert.equal(finding.epss, 0.5);
  assert.equal(finding.kev, true);
  assert.equal(finding.label, 'FIX_NOW');
  assert.equal(finding.score, 62.5);
  assert.equal(finding.fixVersion, '4.17.21');
  assert.equal(finding.fixCommand, 'npm install lodash@4.17.21');
  assert.deepEqual(finding.references, [
    { label: 'Advisory', url: 'https://example.test/advisory' },
  ]);
});

test('penyimpanan berhasil menulis satu scan dan findings terkait', async () => {
  const response = sampleResponse();
  const store = createMemoryScanStore();

  const result = await persistScanResult(response, USER_ID, store);

  assert.equal(result, true);
  assert.equal(response.persisted, true);
  assert.equal(response.warnings.length, 1);
  assert.equal(store.scans.length, 1);
  assert.equal(store.findings.length, 1);
  assert.equal(store.scans[0]?.id, response.scanId);
  assert.equal(store.findings[0]?.scanId, response.scanId);
});

test('kegagalan simpan menghasilkan persisted=false dan satu warning tanpa ubah label', async () => {
  const response = sampleResponse();
  const store = createMemoryScanStore();
  store.failWith = new Error('cloud mati');

  const result = await persistScanResult(response, USER_ID, store);

  assert.equal(result, false);
  assert.equal(response.persisted, false);
  assert.equal(store.scans.length, 0);
  assert.deepEqual(
    response.warnings.filter((warning) => warning.code === 'CLOUD_PERSIST_FAILED'),
    [{ ...CLOUD_PERSIST_WARNING }],
  );
  assert.equal(response.findings[0]?.priority.label, 'FIX_NOW');
  assert.equal(response.findings[0]?.priority.score, 62.5);
  assert.equal(response.findings[0]?.priority.reason, 'Ada di katalog KEV.');
});

test('markCloudPersistFailed tidak menggandakan warning', () => {
  const response = sampleResponse();
  markCloudPersistFailed(response);
  markCloudPersistFailed(response);

  assert.equal(response.persisted, false);
  assert.equal(
    response.warnings.filter((warning) => warning.code === 'CLOUD_PERSIST_FAILED').length,
    1,
  );
});
