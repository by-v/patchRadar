import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyPackage, classifyPackages, packageTags } from './classify.ts';
import { parseManifest } from './lockfile.ts';

const FIXTURES = new URL('../../../../fixtures/lockfiles/', import.meta.url);

function fixture(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, FIXTURES)), 'utf8');
}

function mediumPackages() {
  const result = parseManifest({
    packageJsonText: fixture('medium-500/package.json'),
    lockfileText: fixture('medium-500/package-lock.json'),
  });
  if ('error' in result) assert.fail(`Parse gagal: ${result.error.code}`);
  return result.packages;
}

test('flag direct/transitive/dev benar pada fixture 500 paket', () => {
  const packages = mediumPackages();
  const find = (name: string) => packages.find((entry) => entry.name === name);

  const express = find('express');
  assert.ok(express);
  assert.deepEqual(classifyPackage(express), { direct: true, transitive: false, devOnly: false });

  const jest = find('jest');
  assert.ok(jest);
  assert.deepEqual(classifyPackage(jest), { direct: true, transitive: false, devOnly: true });

  const bodyParser = find('body-parser');
  assert.ok(bodyParser);
  assert.deepEqual(classifyPackage(bodyParser), {
    direct: false,
    transitive: true,
    devOnly: false,
  });

  const webpack = find('webpack');
  assert.ok(webpack);
  assert.deepEqual(classifyPackage(webpack), { direct: true, transitive: false, devOnly: true });
});

test('tag tampilan: langsung/transitif dan dev', () => {
  assert.deepEqual(packageTags({ direct: true, devOnly: false }), ['langsung']);
  assert.deepEqual(packageTags({ direct: true, devOnly: true }), ['langsung', 'dev']);
  assert.deepEqual(packageTags({ direct: false, devOnly: false }), ['transitif']);
  assert.deepEqual(packageTags({ direct: false, devOnly: true }), ['transitif', 'dev']);
});

test('classifyPackages mempertahankan urutan dan menambahkan klasifikasi', () => {
  const packages = mediumPackages().slice(0, 5);
  const classified = classifyPackages(packages);
  assert.equal(classified.length, packages.length);
  for (let index = 0; index < packages.length; index += 1) {
    assert.equal(classified[index]?.name, packages[index]?.name);
    assert.equal(classified[index]?.direct, packages[index]?.direct);
    assert.equal(classified[index]?.transitive, packages[index]?.direct !== true);
  }
});

test('klasifikasi memakai field parser, bukan menebak dari nama', () => {
  assert.deepEqual(classifyPackage({ direct: false, devOnly: false }), {
    direct: false,
    transitive: true,
    devOnly: false,
  });
  assert.deepEqual(classifyPackage({ direct: true, devOnly: true }), {
    direct: true,
    transitive: false,
    devOnly: true,
  });
});
