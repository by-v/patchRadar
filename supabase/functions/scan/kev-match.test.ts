import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildKevCveSet,
  matchKevFindings,
  matchKevWithTiming,
} from './kev-match.ts';
import { createStageTimings } from './lib/timing.ts';

const ENTRIES = [
  { cveId: 'CVE-2021-44228' },
  { cveId: 'cve-2020-28500' },
];

const FINDINGS = [
  { findingKey: 'a', cveIds: ['CVE-2021-44228'] },
  { findingKey: 'b', cveIds: ['CVE-2025-0001', 'CVE-2020-28500'] },
  { findingKey: 'c', cveIds: [] },
  { findingKey: 'd', cveIds: ['CVE-2019-9999'] },
];

test('set CVE dinormalisasi huruf besar dan deduplikasi', () => {
  const set = buildKevCveSet([...ENTRIES, { cveId: ' CVE-2021-44228 ' }, { cveId: '' }]);
  assert.deepEqual([...set].sort(), ['CVE-2020-28500', 'CVE-2021-44228']);
});

test('temuan cocok lewat alias CVE mana pun; tanpa CVE tidak pernah kev=true', () => {
  const matched = matchKevFindings(FINDINGS, ENTRIES);

  assert.deepEqual(
    matched.map((finding) => ({ key: finding.findingKey, kev: finding.kev })),
    [
      { key: 'a', kev: true },
      { key: 'b', kev: true },
      { key: 'c', kev: false },
      { key: 'd', kev: false },
    ],
  );
});

test('pencocokan tidak mengubah objek masukan', () => {
  const input = [{ findingKey: 'a', cveIds: ['CVE-2021-44228'] }];
  const matched = matchKevFindings(input, ENTRIES);
  assert.equal('kev' in input[0]!, false);
  assert.equal(matched[0]?.kev, true);
});

test('katalog kosong menghasilkan kev=false untuk semua temuan', () => {
  assert.deepEqual(
    matchKevFindings(FINDINGS, []).map((finding) => finding.kev),
    [false, false, false, false],
  );
});

test('matchKevWithTiming mencatat tahap pencocokan alias sebagai sinkron', async () => {
  const timings = createStageTimings();
  const result = await matchKevWithTiming(FINDINGS, ENTRIES, timings);
  assert.equal(result.findings[0]?.kev, true);
  assert.ok('kev.match' in timings.sync);
  assert.equal(Object.keys(timings.async).length, 0);
});
