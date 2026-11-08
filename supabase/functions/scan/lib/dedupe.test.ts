import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { dedupePackages } from './dedupe.ts';

test('dedupePackages menggabungkan nama+versi dan menggabungkan flag', () => {
  const result = dedupePackages([
    { name: 'alpha', version: '1.0.0', direct: false, devOnly: true, parentPackage: 'induk-a' },
    { name: 'alpha', version: '1.0.0', direct: true, devOnly: false, parentPackage: null },
    { name: 'alpha', version: '1.0.0', direct: false, devOnly: true, parentPackage: 'induk-b' },
    { name: 'beta', version: '2.0.0', direct: false, devOnly: true, parentPackage: 'induk-a' },
  ]);

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], {
    name: 'alpha',
    version: '1.0.0',
    direct: true,
    devOnly: false,
    parentPackage: 'induk-a',
  });
  assert.deepEqual(result[1], {
    name: 'beta',
    version: '2.0.0',
    direct: false,
    devOnly: true,
    parentPackage: 'induk-a',
  });
});

test('dedupePackages mengurutkan nama lalu versi', () => {
  const result = dedupePackages([
    { name: 'zeta', version: '1.0.0', direct: false, devOnly: false, parentPackage: null },
    { name: 'alpha', version: '2.0.0', direct: false, devOnly: false, parentPackage: null },
    { name: 'alpha', version: '1.0.0', direct: false, devOnly: false, parentPackage: null },
  ]);

  assert.deepEqual(
    result.map((entry) => `${entry.name}@${entry.version}`),
    ['alpha@1.0.0', 'alpha@2.0.0', 'zeta@1.0.0'],
  );
});
