/**
 * Parser package.json dan pembentuk fallback dependensi langsung.
 *
 * Tidak memakai API Node (fs/path/Buffer) agar dapat berjalan di Deno.
 */

import type { PackageEntry, ParseWarning } from './dedupe.ts';

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export type PackageJsonParseResult =
  | { ok: true; packageJson: PackageJson }
  | { ok: false; code: 'INVALID_PACKAGE_JSON'; message: string };

const NON_REGISTRY_PREFIX = /^(?:git\+|git:|github:|gitlab:|bitbucket:|file:|link:|workspace:|https?:|ssh:)/i;
const VERSION_IN_RANGE = /(\d+)\.(\d+)(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/;

export function parsePackageJson(text: string): PackageJsonParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      ok: false,
      code: 'INVALID_PACKAGE_JSON',
      message: 'package.json bukan JSON yang valid.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      code: 'INVALID_PACKAGE_JSON',
      message: 'package.json harus berupa objek JSON.',
    };
  }

  return { ok: true, packageJson: parsed as PackageJson };
}

export function isNonRegistrySpec(spec: string): boolean {
  return NON_REGISTRY_PREFIX.test(spec.trim());
}

/**
 * Batas bawah range untuk fallback saat registry tidak tersedia.
 * Contoh: `^4.18.0` -> `4.18.0`, `~1.2` -> `1.2.0`, `1.2.x` -> `1.2.0`.
 * Range tanpa versi bermakna (`*`, `latest`, kosong) mengembalikan null.
 */
export function lowerBoundForRange(spec: string): string | null {
  const trimmed = spec.trim();
  if (!trimmed || trimmed === '*' || trimmed.toLowerCase() === 'latest') return null;
  if (isNonRegistrySpec(trimmed)) return null;

  const match = VERSION_IN_RANGE.exec(trimmed);
  if (!match) return null;

  const major = match[1];
  const minor = match[2];
  const patch = match[3] ?? '0';
  const prerelease = match[4];
  if (major === undefined || minor === undefined || patch === undefined) return null;

  return `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ''}`;
}

function dependencyBlock(
  value: unknown,
  field: 'dependencies' | 'devDependencies',
  warnings: ParseWarning[],
): Map<string, string> {
  const result = new Map<string, string>();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;

  for (const [name, spec] of Object.entries(value)) {
    if (typeof spec !== 'string') {
      warnings.push({
        code: 'INVALID_DEPENDENCY_SPEC',
        message: `Spesifikasi ${field}.${name} bukan string dan dilewati.`,
      });
      continue;
    }
    result.set(name, spec);
  }
  return result;
}

/**
 * Bangun daftar paket fallback hanya dari dependensi langsung.
 *
 * `resolvedVersions` diisi pemanggil setelah resolver registry berhasil.
 * Bila tidak ada, dipakai batas bawah range (FR-05) dan hasil tetap
 * `estimated=true` di lapisan pemanggil.
 */
export function buildFallbackEntries(
  packageJson: PackageJson,
  resolvedVersions: Readonly<Record<string, string>> = {},
): { entries: PackageEntry[]; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const dependencies = dependencyBlock(packageJson.dependencies, 'dependencies', warnings);
  const devDependencies = dependencyBlock(packageJson.devDependencies, 'devDependencies', warnings);
  const entries: PackageEntry[] = [];
  const seen = new Set<string>();

  const add = (name: string, spec: string, devOnly: boolean) => {
    if (seen.has(name)) return;
    seen.add(name);

    if (isNonRegistrySpec(spec)) {
      warnings.push({
        code: 'NON_REGISTRY_SPEC',
        message: `Spesifikasi non-registry untuk ${name} dilewati: ${spec}`,
      });
      return;
    }

    const resolved = resolvedVersions[name];
    const version = typeof resolved === 'string' && resolved.length > 0
      ? resolved
      : lowerBoundForRange(spec);

    if (!version) {
      warnings.push({
        code: 'UNRESOLVED_RANGE',
        message: `Range ${name}@${spec} tidak punya batas bawah yang dapat dipakai.`,
      });
      return;
    }

    entries.push({
      name,
      version,
      direct: true,
      devOnly,
      parentPackage: null,
    });
  };

  for (const [name, spec] of dependencies) add(name, spec, false);
  for (const [name, spec] of devDependencies) add(name, spec, true);
  entries.sort((a, b) => (a.name === b.name ? 0 : a.name < b.name ? -1 : 1));

  return { entries, warnings };
}
