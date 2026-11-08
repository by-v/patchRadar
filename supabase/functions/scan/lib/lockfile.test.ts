import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { namesFromLockfileKey, parseManifest } from './lockfile.ts';

const FIXTURES = new URL('../../../../fixtures/lockfiles/', import.meta.url);

function fixture(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, FIXTURES)), 'utf8');
}

function expectSuccess(result: ReturnType<typeof parseManifest>) {
  if ('error' in result) assert.fail(`Parse gagal: ${result.error.code} ${result.error.message}`);
  return result;
}

test('lockfile v3: jumlah paket unik sama dengan count-packages.mjs', () => {
  const expected: Array<[string, number]> = [
    ['small-100', 107],
    ['medium-500', 491],
    ['large-1500', 1409],
  ];

  for (const [directory, count] of expected) {
    const result = expectSuccess(
      parseManifest({
        packageJsonText: fixture(`${directory}/package.json`),
        lockfileText: fixture(`${directory}/package-lock.json`),
      }),
    );

    assert.equal(result.source, 'LOCKFILE');
    assert.equal(result.estimated, false);
    assert.equal(result.lockfileVersion, 3);
    assert.equal(result.totalPackages, count);
    assert.equal(new Set(result.packages.map((entry) => `${entry.name}@${entry.version}`)).size, count);
  }
});

test('lockfile v3: flag direct, devOnly, dan parentPackage benar', () => {
  const small = expectSuccess(
    parseManifest({
      packageJsonText: fixture('small-100/package.json'),
      lockfileText: fixture('small-100/package-lock.json'),
    }),
  );
  const find = (name: string) => small.packages.find((entry) => entry.name === name);

  assert.equal(find('express')?.direct, true);
  assert.equal(find('express')?.devOnly, false);
  assert.equal(find('nodemon')?.direct, true);
  assert.equal(find('nodemon')?.devOnly, true);
  assert.equal(find('body-parser')?.direct, false);
  const nestedSafeBuffer = small.packages.find(
    (entry) => entry.name === 'safe-buffer' && entry.version === '5.1.2',
  );
  assert.equal(nestedSafeBuffer?.parentPackage, 'basic-auth');

  const medium = expectSuccess(
    parseManifest({
      packageJsonText: fixture('medium-500/package.json'),
      lockfileText: fixture('medium-500/package-lock.json'),
    }),
  );
  const webpack = medium.packages.find((entry) => entry.name === 'webpack');
  assert.equal(webpack?.direct, true);
  assert.equal(webpack?.devOnly, true);

  const large = expectSuccess(
    parseManifest({
      packageJsonText: fixture('large-1500/package.json'),
      lockfileText: fixture('large-1500/package-lock.json'),
    }),
  );
  assert.equal(large.packages.find((entry) => entry.name === 'vite')?.devOnly, true);
  assert.equal(large.packages.find((entry) => entry.name === 'react-scripts')?.devOnly, false);
});

test('lockfile v2: field packages diparse dengan flag yang sama', () => {
  const packageJsonText = JSON.stringify({
    name: 'contoh',
    dependencies: { alpha: '1.0.0' },
    devDependencies: { beta: '2.0.0' },
  });
  const lockfileText = JSON.stringify({
    name: 'contoh',
    lockfileVersion: 2,
    packages: {
      '': {
        name: 'contoh',
        dependencies: { alpha: '1.0.0' },
        devDependencies: { beta: '2.0.0' },
      },
      'node_modules/alpha': { version: '1.0.1' },
      'node_modules/beta': { version: '2.0.1', dev: true },
      'node_modules/alpha/node_modules/gamma': { version: '3.0.0' },
    },
  });

  const result = expectSuccess(parseManifest({ packageJsonText, lockfileText }));
  assert.equal(result.source, 'LOCKFILE');
  assert.equal(result.lockfileVersion, 2);
  assert.deepEqual(
    result.packages.map((entry) => `${entry.name}@${entry.version}:${entry.devOnly}:${entry.parentPackage ?? '-'}`),
    ['alpha@1.0.1:false:-', 'beta@2.0.1:true:-', 'gamma@3.0.0:false:alpha'],
  );
});

test('lockfile v1 memakai fallback package.json dengan warning', () => {
  const result = expectSuccess(
    parseManifest({
      packageJsonText: fixture('lockfile-v1/package.json'),
      lockfileText: fixture('lockfile-v1/package-lock.json'),
    }),
  );

  assert.equal(result.source, 'PACKAGE_JSON');
  assert.equal(result.estimated, true);
  assert.equal(result.lockfileVersion, null);
  assert.equal(result.totalPackages, 2);
  assert.ok(result.warnings.some((warning) => warning.code === 'LOCKFILE_V1'));
  assert.deepEqual(
    result.packages.map((entry) => `${entry.name}@${entry.version}`),
    ['express@4.21.2', 'lodash@4.17.21'],
  );
});

test('lockfile rusak memakai fallback package.json, bukan crash', () => {
  const result = expectSuccess(
    parseManifest({
      packageJsonText: fixture('malformed-lockfile/package.json'),
      lockfileText: fixture('malformed-lockfile/package-lock.json'),
    }),
  );

  assert.equal(result.source, 'PACKAGE_JSON');
  assert.equal(result.estimated, true);
  assert.deepEqual(
    result.packages.map((entry) => `${entry.name}@${entry.version}`),
    ['express@4.21.2'],
  );
  assert.ok(result.warnings.some((warning) => warning.code === 'LOCKFILE_INVALID_JSON'));
});

test('tanpa lockfile memakai package.json dengan estimated=true', () => {
  const result = expectSuccess(
    parseManifest({
      packageJsonText: fixture('no-lockfile/package.json'),
      lockfileText: null,
    }),
  );

  assert.equal(result.source, 'PACKAGE_JSON');
  assert.equal(result.estimated, true);
  assert.equal(result.totalPackages, 3);
  assert.deepEqual(
    result.packages.map((entry) => `${entry.name}@${entry.version}:${entry.devOnly}`),
    ['express@4.18.0:false', 'jest@29.7.0:true', 'lodash@4.17.0:false'],
  );
  assert.ok(result.warnings.some((warning) => warning.code === 'LOCKFILE_MISSING'));
});

test('tanpa package.json menghasilkan error terklasifikasi', () => {
  const result = parseManifest({
    packageJsonText: null,
    lockfileText: fixture('no-package-json/package-lock.json'),
  });

  assert.ok('error' in result);
  if ('error' in result) {
    assert.equal(result.error.code, 'NO_PACKAGE_JSON');
    assert.equal(result.error.retryable, false);
  }
});

test('package.json rusak menghasilkan error terklasifikasi', () => {
  const result = parseManifest({ packageJsonText: '{', lockfileText: null });
  assert.ok('error' in result);
  if ('error' in result) assert.equal(result.error.code, 'INVALID_PACKAGE_JSON');
});

test('entri link/workspace dan entri tanpa versi dilewati dengan warning', () => {
  const packageJsonText = JSON.stringify({ name: 'contoh', dependencies: { alpha: '1.0.0' } });
  const lockfileText = JSON.stringify({
    lockfileVersion: 3,
    packages: {
      '': { name: 'contoh', dependencies: { alpha: '1.0.0' } },
      'node_modules/alpha': { version: '1.0.1' },
      'node_modules/tautan': { link: true, resolved: '../tautan' },
      'node_modules/tanpa-versi': {},
      'packages/workspace': { version: '1.0.0' },
    },
  });

  const result = expectSuccess(parseManifest({ packageJsonText, lockfileText }));
  assert.equal(result.totalPackages, 1);
  const codes = result.warnings.map((warning) => warning.code);
  assert.equal(codes.filter((code) => code === 'LOCKFILE_ENTRY_SKIPPED').length, 3);
});

test('namesFromLockfileKey menangani scoped dan nested', () => {
  assert.deepEqual(namesFromLockfileKey('node_modules/@scope/pkg'), {
    name: '@scope/pkg',
    parent: null,
  });
  assert.deepEqual(namesFromLockfileKey('node_modules/induk/node_modules/@scope/anak'), {
    name: '@scope/anak',
    parent: 'induk',
  });
  assert.equal(namesFromLockfileKey('packages/workspace'), null);
});
