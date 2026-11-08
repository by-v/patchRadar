import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildFallbackEntries, lowerBoundForRange, parsePackageJson } from './package-json.ts';

test('lowerBoundForRange menangani caret, tilde, exact, dan range majemuk', () => {
  assert.equal(lowerBoundForRange('^4.18.0'), '4.18.0');
  assert.equal(lowerBoundForRange('~1.2'), '1.2.0');
  assert.equal(lowerBoundForRange('1.2.x'), '1.2.0');
  assert.equal(lowerBoundForRange('>=2.0.0 <3.0.0'), '2.0.0');
  assert.equal(lowerBoundForRange('^1.2.3-beta.1'), '1.2.3-beta.1');
});

test('lowerBoundForRange mengembalikan null untuk range tanpa batas atau non-registry', () => {
  assert.equal(lowerBoundForRange('*'), null);
  assert.equal(lowerBoundForRange('latest'), null);
  assert.equal(lowerBoundForRange(''), null);
  assert.equal(lowerBoundForRange('git+https://github.com/a/b.git'), null);
  assert.equal(lowerBoundForRange('file:../lokal'), null);
  assert.equal(lowerBoundForRange('workspace:*'), null);
});

test('parsePackageJson menolak JSON rusak dan non-objek', () => {
  const broken = parsePackageJson('{');
  assert.equal(broken.ok, false);
  if (!broken.ok) assert.equal(broken.code, 'INVALID_PACKAGE_JSON');

  const array = parsePackageJson('[]');
  assert.equal(array.ok, false);
});

test('buildFallbackEntries hanya dependensi langsung dan melewati spesifikasi non-registry', () => {
  const result = buildFallbackEntries({
    dependencies: {
      alpha: '^1.2.3',
      beta: 'file:../beta',
      gamma: '*',
      delta: '1.0.0',
    },
    devDependencies: {
      epsilon: '~2.0.0',
      alpha: '^9.0.0',
    },
  });

  assert.deepEqual(
    result.entries.map((entry) => `${entry.name}@${entry.version}:${entry.devOnly}:${entry.direct}`),
    ['alpha@1.2.3:false:true', 'delta@1.0.0:false:true', 'epsilon@2.0.0:true:true'],
  );
  assert.deepEqual(
    result.warnings.map((warning) => warning.code),
    ['NON_REGISTRY_SPEC', 'UNRESOLVED_RANGE'],
  );
});

test('buildFallbackEntries memakai resolvedVersions bila diberikan', () => {
  const result = buildFallbackEntries(
    { dependencies: { alpha: '^1.2.3', beta: '~2.0.0' } },
    { alpha: '1.9.9' },
  );

  assert.deepEqual(
    result.entries.map((entry) => `${entry.name}@${entry.version}`),
    ['alpha@1.9.9', 'beta@2.0.0'],
  );
});

test('buildFallbackEntries mencatat spesifikasi yang bukan string', () => {
  const result = buildFallbackEntries({
    dependencies: { alpha: 123 as unknown as string },
  });

  assert.equal(result.entries.length, 0);
  assert.equal(result.warnings[0]?.code, 'INVALID_DEPENDENCY_SPEC');
});
