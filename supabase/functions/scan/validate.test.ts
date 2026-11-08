import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { validateRepoUrl } from './validate.ts';

test('URL repo GitHub valid menghasilkan owner/repo dan URL kanonik', () => {
  assert.deepEqual(validateRepoUrl('https://github.com/lodash/lodash'), {
    ok: true,
    owner: 'lodash',
    repo: 'lodash',
    canonicalUrl: 'https://github.com/lodash/lodash',
  });

  assert.deepEqual(validateRepoUrl('  https://github.com/ExpressJS/express  '), {
    ok: true,
    owner: 'ExpressJS',
    repo: 'express',
    canonicalUrl: 'https://github.com/ExpressJS/express',
  });

  assert.deepEqual(validateRepoUrl('https://github.com/a/b.c_d-e'), {
    ok: true,
    owner: 'a',
    repo: 'b.c_d-e',
    canonicalUrl: 'https://github.com/a/b.c_d-e',
  });
});

test('masukan kosong dan bukan string ditolak', () => {
  for (const value of [undefined, null, '', '   ', 42, {}]) {
    const result = validateRepoUrl(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'EMPTY');
  }
});

test('skema selain HTTPS ditolak', () => {
  for (const value of [
    'http://github.com/a/b',
    'ftp://github.com/a/b',
    'git://github.com/a/b',
    'ssh://github.com/a/b',
    '//github.com/a/b',
  ]) {
    const result = validateRepoUrl(value);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'INVALID_FORMAT', value);
  }
});

test('host selain github.com ditolak, termasuk trik userinfo/port/huruf unicode', () => {
  const cases = [
    'https://gitlab.com/a/b',
    'https://www.github.com/a/b',
    'https://github.com.evil.com/a/b',
    'https://github.com@evil.com/a/b',
    'https://user:pass@github.com/a/b',
    'https://github.com:443/a/b',
    'https://GitHub.com/a/b',
    'https://gіthub.com/a/b', // "і" Cyrillic
    'https://localhost/a/b',
    'https://127.0.0.1/a/b',
    'https://169.254.169.254/a/b',
    'https://[::1]/a/b',
  ];
  for (const value of cases) {
    const result = validateRepoUrl(value);
    assert.equal(result.ok, false, value);
    if (!result.ok) assert.equal(result.reason, 'WRONG_HOST', value);
  }
});

test('path tambahan, query, fragmen, dan trailing slash ditolak', () => {
  const cases = [
    'https://github.com/a/b/tree/main',
    'https://github.com/a/b/blob/main/package.json',
    'https://github.com/a/b?tab=readme',
    'https://github.com/a/b#readme',
    'https://github.com/a/b/',
    'https://github.com/a',
    'https://github.com/',
    'https://github.com//b',
    'https://github.com/a//b',
  ];
  for (const value of cases) {
    const result = validateRepoUrl(value);
    assert.equal(result.ok, false, value);
    if (!result.ok) assert.ok(result.reason === 'EXTRA_PATH' || result.reason === 'INVALID_FORMAT');
  }
});

test('karakter aneh, encoding persen, spasi, dan newline ditolak', () => {
  const cases = [
    'https://github.com/a/b c',
    'https://github.com/a/b\n',
    'https://github.com/a/%2e%2e',
    'https://github.com/a/b%2Fc',
    'https://github.com/a/b<script>',
    'https://github.com/a/b\\c',
    'https://github.com/a/b\u0000',
    'https://github.com/a/b?x=%0a',
  ];
  for (const value of cases) {
    assert.equal(validateRepoUrl(value).ok, false, value);
  }
});

test('owner/repo dot dan panjang berlebih ditolak', () => {
  assert.equal(validateRepoUrl('https://github.com/./b').ok, false);
  assert.equal(validateRepoUrl('https://github.com/a/..').ok, false);
  assert.equal(validateRepoUrl(`https://github.com/${'a'.repeat(40)}/b`).ok, false);
  assert.equal(validateRepoUrl(`https://github.com/a/${'b'.repeat(101)}`).ok, false);
  assert.equal(validateRepoUrl(`https://github.com/a/${'b'.repeat(2048)}`).ok, false);
});
