import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  compareVersions,
  isValidVersion,
  maxSatisfying,
  parseRange,
  satisfies,
} from './semver.ts';

test('perbandingan versi mengikuti urutan semver termasuk prerelease', () => {
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('1.2.3', '1.2.4'), -1);
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0-alpha', '1.0.0'), -1);
  assert.equal(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.2'), -1);
  assert.equal(compareVersions('1.0.0-alpha.10', '1.0.0-alpha.2'), 1);
  assert.equal(compareVersions('1.0.0-beta', '1.0.0-alpha'), 1);
  assert.equal(compareVersions('1.0.0-1', '1.0.0-alpha'), -1);
  assert.throws(() => compareVersions('bukan-versi', '1.0.0'));
});

test('parseVersion menolak versi tidak lengkap dan menerima prefix v', () => {
  assert.equal(isValidVersion('1.2.3'), true);
  assert.equal(isValidVersion('v1.2.3'), true);
  assert.equal(isValidVersion('1.2'), false);
  assert.equal(isValidVersion('1'), false);
  assert.equal(isValidVersion('^1.2.3'), false);
});

test('caret memilih versi tertinggi dalam batas mayor yang benar', () => {
  assert.equal(satisfies('1.9.9', '^1.2.3'), true);
  assert.equal(satisfies('2.0.0', '^1.2.3'), false);
  assert.equal(satisfies('1.2.2', '^1.2.3'), false);
  assert.equal(satisfies('0.2.9', '^0.2.3'), true);
  assert.equal(satisfies('0.3.0', '^0.2.3'), false);
  assert.equal(satisfies('0.0.3', '^0.0.3'), true);
  assert.equal(satisfies('0.0.4', '^0.0.3'), false);
});

test('tilde membatasi pada minor yang sama', () => {
  assert.equal(satisfies('1.2.9', '~1.2.3'), true);
  assert.equal(satisfies('1.3.0', '~1.2.3'), false);
  assert.equal(satisfies('1.2.0', '~1.2'), true);
  assert.equal(satisfies('1.3.0', '~1.2'), false);
});

test('exact, wildcard, range majemuk, hyphen, dan OR bekerja', () => {
  assert.equal(satisfies('1.2.3', '1.2.3'), true);
  assert.equal(satisfies('1.2.4', '1.2.3'), false);
  assert.equal(satisfies('1.2.4', '=1.2.3'), false);
  assert.equal(satisfies('1.2.9', '1.2.x'), true);
  assert.equal(satisfies('1.3.0', '1.2.x'), false);
  assert.equal(satisfies('1.9.9', '1.x'), true);
  assert.equal(satisfies('2.0.0', '1.x'), false);
  assert.equal(satisfies('99.0.0', '*'), true);

  assert.equal(satisfies('1.5.0', '>=1.2.0 <2.0.0'), true);
  assert.equal(satisfies('2.0.0', '>=1.2.0 <2.0.0'), false);
  assert.equal(satisfies('1.1.9', '>=1.2.0 <2.0.0'), false);

  assert.equal(satisfies('1.2.3', '1.2.3 - 2.0.0'), true);
  assert.equal(satisfies('2.0.0', '1.2.3 - 2.0.0'), true);
  assert.equal(satisfies('2.0.1', '1.2.3 - 2.0.0'), false);

  assert.equal(satisfies('2.5.0', '^1.0.0 || ^2.0.0'), true);
  assert.equal(satisfies('3.0.0', '^1.0.0 || ^2.0.0'), false);
});

test('range prerelease hanya menerima tuple yang sama kecuali versi stabil', () => {
  assert.equal(satisfies('1.2.3-beta.2', '^1.2.3-beta.1'), true);
  assert.equal(satisfies('1.2.3-beta.0', '^1.2.3-beta.1'), false);
  assert.equal(satisfies('1.2.3', '^1.2.3-beta.1'), true);
  assert.equal(satisfies('1.2.4-beta.1', '^1.2.3-beta.1'), false);
  assert.equal(satisfies('1.2.3-beta.2', '^1.2.3'), false);
});

test('maxSatisfying memilih versi tertinggi dan melewati versi tidak valid', () => {
  const versions = ['1.0.0', '1.2.0', '1.2.5', '1.3.0', '2.0.0', '2.1.0', 'bukan-versi'];
  assert.equal(maxSatisfying(versions, '^1.2.0'), '1.3.0');
  assert.equal(maxSatisfying(versions, '~1.2.0'), '1.2.5');
  assert.equal(maxSatisfying(versions, '1.2.0'), '1.2.0');
  assert.equal(maxSatisfying(versions, '>=1.2.0 <2.0.0'), '1.3.0');
  assert.equal(maxSatisfying(versions, '^3.0.0'), null);
  assert.equal(maxSatisfying(versions, '3.0.0-beta.1'), null);
});

test('range tidak valid dikembalikan null tanpa exception', () => {
  assert.equal(parseRange('bukan range'), null);
  assert.equal(parseRange('>=1.0.0 -'), null);
  assert.equal(satisfies('1.0.0', 'bukan range'), false);
  assert.equal(maxSatisfying(['1.0.0'], 'bukan range'), null);
});
