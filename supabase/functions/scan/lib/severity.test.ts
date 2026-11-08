import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  advisoryMatchesId,
  cvssV3BaseScore,
  normalizeAdvisoryAliases,
  normalizeSeverity,
  normalizeSeverityLabel,
  severityFromScore,
} from './severity.ts';

const OSV_FIXTURES = new URL('../../../../fixtures/osv/', import.meta.url);

function rawAdvisories(): Record<string, Record<string, unknown>> {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL('advisory-raw.json', OSV_FIXTURES)), 'utf8'),
  ) as Record<string, Record<string, unknown>>;
}

test('pemetaan skor CVSS menguji setiap level sesuai PRD FR-11', () => {
  const cases: Array<[number, string]> = [
    [9.8, 'CRITICAL'],
    [9.0, 'CRITICAL'],
    [8.9, 'HIGH'],
    [7.5, 'HIGH'],
    [7.0, 'HIGH'],
    [6.9, 'MEDIUM'],
    [5.0, 'MEDIUM'],
    [4.0, 'MEDIUM'],
    [3.9, 'LOW'],
    [2.0, 'LOW'],
    [0.1, 'LOW'],
    [0, 'UNKNOWN'],
  ];

  for (const [score, expected] of cases) {
    assert.equal(severityFromScore(score), expected, `skor ${score}`);
    const normalized = normalizeSeverity({
      severity: [{ type: 'CVSS_V3', score: String(score) }],
    });
    assert.equal(normalized.level, expected, `advisory skor ${score}`);
    assert.equal(normalized.source, 'CVSS_V3');
  }
});

test('vektor CVSS v3 nyata dihitung lalu dipetakan ke level', () => {
  const vector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H';
  assert.equal(cvssV3BaseScore(vector), 9.8);
  assert.deepEqual(
    normalizeSeverity({ severity: [{ type: 'CVSS_V3', score: vector }] }),
    {
      level: 'CRITICAL',
      source: 'CVSS_V3',
      cvssV3Score: 9.8,
      cvssV3Vector: vector,
      databaseSpecificSeverity: null,
    },
  );
});

test('hanya CVSS_V4 memakai database_specific dan MODERATE menjadi MEDIUM', () => {
  const normalized = normalizeSeverity({
    severity: [{ type: 'CVSS_V4', score: 'CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:L/SC:H/SI:H/SA:H/E:P' }],
    database_specific: { severity: 'MODERATE' },
  });

  assert.equal(normalized.level, 'MEDIUM');
  assert.equal(normalized.source, 'CVSS_V4_DATABASE_SPECIFIC');
  assert.equal(normalized.cvssV3Score, null);
  assert.equal(normalized.databaseSpecificSeverity, 'MODERATE');
});

test('CVSS_V3 diutamakan di atas database_specific', () => {
  const normalized = normalizeSeverity({
    severity: [{ type: 'CVSS_V3', score: '7.5' }],
    database_specific: { severity: 'CRITICAL' },
  });
  assert.equal(normalized.level, 'HIGH');
  assert.equal(normalized.source, 'CVSS_V3');
});

test('advisory tanpa severity menjadi UNKNOWN, bukan ditebak', () => {
  assert.equal(normalizeSeverity({}).level, 'UNKNOWN');
  assert.equal(normalizeSeverity({ severity: [] }).level, 'UNKNOWN');
  assert.equal(
    normalizeSeverity({ severity: [{ type: 'CVSS_V4', score: 'CVSS:4.0/AV:N' }] }).level,
    'UNKNOWN',
  );
  assert.equal(normalizeSeverityLabel('unknown-string'), null);
  assert.equal(normalizeSeverityLabel('moderate'), 'MEDIUM');
});

test('advisory hanya CVSS_V4 pada fixture memakai database_specific.severity', () => {
  const advisories = rawAdvisories();
  const expected: Array<[string, string]> = [
    ['GHSA-7q8q-rj6j-mhjq', 'MEDIUM'],
    ['GHSA-jr5f-v2jv-69x6', 'HIGH'],
    ['GHSA-m5mm-p8h7-m29v', 'LOW'],
  ];

  for (const [id, level] of expected) {
    const advisory = advisories[id];
    assert.ok(advisory, `fixture ${id} ada`);
    const normalized = normalizeSeverity(advisory);
    assert.equal(normalized.source, 'CVSS_V4_DATABASE_SPECIFIC', id);
    assert.equal(normalized.level, level, id);
  }
});

test('alias GHSA-CVE cocok pada fixture dan tidak peka huruf besar/kecil', () => {
  const advisories = rawAdvisories();
  const advisory = advisories['GHSA-29mw-wpgm-hmr9'];
  assert.ok(advisory);

  const aliases = normalizeAdvisoryAliases(advisory);
  assert.deepEqual(aliases.ghsaIds, ['GHSA-29MW-WPGM-HMR9']);
  assert.deepEqual(aliases.cveIds, ['CVE-2020-28500']);
  assert.equal(advisoryMatchesId(advisory, 'cve-2020-28500'), true);
  assert.equal(advisoryMatchesId(advisory, 'CVE-2020-0000'), false);
});

test('alias dinormalisasi huruf besar dan dideduplikasi', () => {
  const aliases = normalizeAdvisoryAliases({
    id: 'ghsa-aaaa-bbbb-cccc',
    aliases: [
      'GHSA-AAAA-BBBB-CCCC',
      'cve-2024-12345',
      'CVE-2024-12345',
      'RUSTSEC-2024-0001',
      'CVE-BUKAN-VALID',
    ],
  });

  assert.deepEqual(aliases.ghsaIds, ['GHSA-AAAA-BBBB-CCCC']);
  assert.deepEqual(aliases.cveIds, ['CVE-2024-12345']);
  assert.deepEqual(aliases.allIds, ['CVE-2024-12345', 'GHSA-AAAA-BBBB-CCCC']);
});

test('advisory GHSA tanpa CVE tetap punya daftar CVE kosong', () => {
  const advisories = rawAdvisories();
  const advisory = advisories['GHSA-5c6j-r48x-rmvq'];
  assert.ok(advisory);
  const aliases = normalizeAdvisoryAliases(advisory);
  assert.deepEqual(aliases.ghsaIds, ['GHSA-5C6J-R48X-RMVQ']);
  assert.deepEqual(aliases.cveIds, []);
});
