#!/usr/bin/env node
/**
 * Hitung paket unik (nama, versi) pada package-lock.json.
 *
 * Pemakaian:
 *   node scripts/count-packages.mjs fixtures/lockfiles/medium-500
 *   node scripts/count-packages.mjs fixtures/lockfiles/medium-500/package-lock.json
 *
 * Mendukung lockfile v1 (`dependencies`) dan v2/v3 (`packages`).
 * Entri root dan `link` tidak dihitung.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

function resolveLockPath(input) {
  const candidate = path.resolve(input);
  if (candidate.toLowerCase().endsWith('.json')) return candidate;
  return path.join(candidate, 'package-lock.json');
}

function nameFromKey(key) {
  const marker = 'node_modules/';
  const index = key.lastIndexOf(marker);
  return index === -1 ? key : key.slice(index + marker.length);
}

function collectPackages(lockfile) {
  const unique = new Set();
  let entries = 0;

  if (lockfile.packages) {
    for (const [key, value] of Object.entries(lockfile.packages)) {
      if (key === '') continue;
      if (!value || value.link) continue;
      entries += 1;
      const name = value.name || nameFromKey(key);
      if (name && value.version) unique.add(`${name}@${value.version}`);
    }
  } else if (lockfile.dependencies) {
    const walk = (dependencies) => {
      for (const [name, value] of Object.entries(dependencies)) {
        if (!value) continue;
        entries += 1;
        if (value.version) unique.add(`${name}@${value.version}`);
        if (value.dependencies) walk(value.dependencies);
      }
    };
    walk(lockfile.dependencies);
  }

  return { unique, entries };
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Pemakaian: node scripts/count-packages.mjs <folder-atau-package-lock.json>');
    process.exitCode = 1;
    return;
  }

  const lockPath = resolveLockPath(input);
  let lockfile;
  try {
    lockfile = JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch (error) {
    console.error(`Gagal membaca ${lockPath}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const { unique, entries } = collectPackages(lockfile);
  console.log(
    JSON.stringify(
      {
        file: path.relative(process.cwd(), lockPath).replaceAll('\\', '/'),
        lockfileVersion: lockfile.lockfileVersion ?? null,
        entries,
        uniquePackages: unique.size,
      },
      null,
      2,
    ),
  );
}

main();
