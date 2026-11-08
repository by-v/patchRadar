/**
 * Parser manifest PatchRadar: lockfile v2/v3 + fallback package.json.
 *
 * Satu lintasan atas `packages`, tanpa menyalin objek lockfile besar. Hanya
 * field yang dibutuhkan yang diekstrak. Tidak memakai API Node agar aman
 * dijalankan pada Deno Edge Function.
 */

import { dedupePackages } from './dedupe.ts';
import type { PackageEntry, ParseWarning, ParsedPackage } from './dedupe.ts';
import { buildFallbackEntries, parsePackageJson } from './package-json.ts';
import type { PackageJson } from './package-json.ts';

export interface ManifestInput {
  packageJsonText?: string | null;
  lockfileText?: string | null;
}

export interface ParseOptions {
  /**
   * Versi hasil resolver registry per nama paket. Bila tidak diisi, fallback
   * memakai batas bawah range (FR-05) dan caller menandai estimated=true.
   */
  resolvedVersions?: Readonly<Record<string, string>>;
}

export interface ParseSuccess {
  source: 'LOCKFILE' | 'PACKAGE_JSON';
  estimated: boolean;
  lockfileVersion: number | null;
  totalPackages: number;
  packages: ParsedPackage[];
  warnings: ParseWarning[];
}

export interface ParseFailure {
  error: {
    code: 'NO_PACKAGE_JSON' | 'INVALID_PACKAGE_JSON' | 'INVALID_MANIFEST_INPUT';
    message: string;
    retryable: boolean;
  };
}

export type ParseOutcome = ParseSuccess | ParseFailure;

interface LockfileShape {
  lockfileVersion?: unknown;
  packages?: unknown;
  dependencies?: unknown;
}

interface RawPackageEntry {
  name?: unknown;
  version?: unknown;
  link?: unknown;
  dev?: unknown;
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asVersion(value: unknown): number | null {
  return typeof value === 'number' ? value : null;
}

/** Turunkan nama paket dan parent langsung dari path lockfile. */
export function namesFromLockfileKey(key: string): { name: string; parent: string | null } | null {
  if (!key.startsWith('node_modules/')) return null;
  const parts = key
    .split('node_modules/')
    .filter((part) => part.length > 0)
    .map((part) => part.replace(/\/$/, ''));
  const name = parts.at(-1);
  if (!name) return null;
  const parent = parts.length > 1 ? (parts.at(-2) ?? null) : null;
  return { name, parent };
}

function directNames(packageJson: PackageJson, rootPackage: Record<string, unknown> | null): Set<string> {
  const names = new Set<string>();
  for (const block of [packageJson.dependencies, packageJson.devDependencies]) {
    if (block) for (const name of Object.keys(block)) names.add(name);
  }
  for (const blockName of ['dependencies', 'devDependencies']) {
    const block = rootPackage ? asObject(rootPackage[blockName]) : null;
    if (block) for (const name of Object.keys(block)) names.add(name);
  }
  return names;
}

function parseV2V3(
  lockfile: LockfileShape,
  packageJson: PackageJson,
  lockfileVersion: number | null,
): { packages: ParsedPackage[]; warnings: ParseWarning[] } {
  const packagesObject = asObject(lockfile.packages);
  if (!packagesObject) {
    return { packages: [], warnings: [] };
  }

  const warnings: ParseWarning[] = [];
  const direct = directNames(packageJson, asObject(packagesObject['']));
  const entries: PackageEntry[] = [];

  for (const key of Object.keys(packagesObject)) {
    if (key === '') continue;
    const raw = packagesObject[key];
    const entry = asObject(raw) as RawPackageEntry | null;
    if (!entry) {
      warnings.push({
        code: 'LOCKFILE_ENTRY_SKIPPED',
        message: `Entri lockfile ${key} bukan objek dan dilewati.`,
      });
      continue;
    }

    if (entry.link === true) {
      warnings.push({
        code: 'LOCKFILE_ENTRY_SKIPPED',
        message: `Entri link/workspace ${key} dilewati.`,
      });
      continue;
    }

    const derived = namesFromLockfileKey(key);
    if (!derived) {
      warnings.push({
        code: 'LOCKFILE_ENTRY_SKIPPED',
        message: `Entri non-node_modules ${key} dilewati.`,
      });
      continue;
    }

    const name = typeof entry.name === 'string' && entry.name.length > 0 ? entry.name : derived.name;
    const version = typeof entry.version === 'string' ? entry.version : '';

    if (!name || !version) {
      warnings.push({
        code: 'LOCKFILE_ENTRY_SKIPPED',
        message: `Entri ${key} tidak punya nama/versi dan dilewati.`,
      });
      continue;
    }

    entries.push({
      name,
      version,
      direct: direct.has(name),
      devOnly: entry.dev === true,
      parentPackage: derived.parent,
    });
  }

  return { packages: dedupePackages(entries), warnings };
}

function failure(
  code: ParseFailure['error']['code'],
  message: string,
): ParseFailure {
  return { error: { code, message, retryable: false } };
}

function fallback(
  packageJson: PackageJson,
  warnings: ParseWarning[],
  options: ParseOptions,
): ParseSuccess {
  const built = buildFallbackEntries(packageJson, options.resolvedVersions ?? {});
  return {
    source: 'PACKAGE_JSON',
    estimated: true,
    lockfileVersion: null,
    totalPackages: built.entries.length,
    packages: built.entries,
    warnings: [...warnings, ...built.warnings],
  };
}

/**
 * Parse manifest menjadi daftar paket unik.
 *
 * Lockfile v1, rusak, atau tidak ada → warning + fallback package.json.
 * package.json tidak ada/rusak → error terklasifikasi (bukan exception).
 */
export function parseManifest(input: ManifestInput, options: ParseOptions = {}): ParseOutcome {
  if (!input || typeof input !== 'object') {
    return failure('INVALID_MANIFEST_INPUT', 'Input manifest tidak valid.');
  }

  if (typeof input.packageJsonText !== 'string' || input.packageJsonText.trim().length === 0) {
    return failure('NO_PACKAGE_JSON', 'package.json tidak ditemukan pada root repositori.');
  }

  const parsedPackageJson = parsePackageJson(input.packageJsonText);
  if (!parsedPackageJson.ok) {
    return failure(parsedPackageJson.code, parsedPackageJson.message);
  }
  const packageJson = parsedPackageJson.packageJson;

  const lockfileText = typeof input.lockfileText === 'string' ? input.lockfileText : '';
  if (lockfileText.trim().length === 0) {
    return fallback(
      packageJson,
      [{ code: 'LOCKFILE_MISSING', message: 'package-lock.json tidak ditemukan; memakai package.json.' }],
      options,
    );
  }

  let lockfile: LockfileShape;
  try {
    lockfile = JSON.parse(lockfileText) as LockfileShape;
  } catch {
    return fallback(
      packageJson,
      [{ code: 'LOCKFILE_INVALID_JSON', message: 'package-lock.json rusak; memakai package.json.' }],
      options,
    );
  }

  if (!lockfile || typeof lockfile !== 'object' || Array.isArray(lockfile)) {
    return fallback(
      packageJson,
      [{ code: 'LOCKFILE_INVALID_JSON', message: 'package-lock.json bukan objek; memakai package.json.' }],
      options,
    );
  }

  const lockfileVersion = asVersion(lockfile.lockfileVersion);
  if (lockfileVersion === 1) {
    return fallback(
      packageJson,
      [{ code: 'LOCKFILE_V1', message: 'package-lock.json v1 tidak didukung; memakai package.json.' }],
      options,
    );
  }

  if (!asObject(lockfile.packages)) {
    return fallback(
      packageJson,
      [{ code: 'LOCKFILE_UNSUPPORTED', message: 'package-lock.json tidak memiliki field packages; memakai package.json.' }],
      options,
    );
  }

  const parsed = parseV2V3(lockfile, packageJson, lockfileVersion);
  return {
    source: 'LOCKFILE',
    estimated: false,
    lockfileVersion,
    totalPackages: parsed.packages.length,
    packages: parsed.packages,
    warnings: parsed.warnings,
  };
}
