/**
 * Klasifikasi paket dari data lockfile/package.json (PRD FR-12).
 *
 * Parser `lockfile.ts` sudah menetapkan `direct` dan `devOnly`; modul ini
 * memberi bentuk klasifikasi yang eksplisit untuk UI/logika label tanpa
 * menebak ulang dari nama paket.
 */

import type { PackageEntry } from './dedupe.ts';

export interface PackageClassification {
  direct: boolean;
  transitive: boolean;
  devOnly: boolean;
}

export interface ClassifiedPackage extends PackageEntry, PackageClassification {}

/** Bentuk klasifikasi dari flag parser: langsung vs transitif, plus dev. */
export function classifyPackage(
  entry: Pick<PackageEntry, 'direct' | 'devOnly'>,
): PackageClassification {
  return {
    direct: entry.direct === true,
    transitive: entry.direct !== true,
    devOnly: entry.devOnly === true,
  };
}

/** Terapkan klasifikasi ke seluruh paket tanpa mengubah urutan masukan. */
export function classifyPackages(entries: readonly PackageEntry[]): ClassifiedPackage[] {
  return entries.map((entry) => ({ ...entry, ...classifyPackage(entry) }));
}

/**
 * Tag tampilan berbahasa Indonesia: `langsung`/`transitif` dan `dev` bila
 * paket hanya dibutuhkan jalur pengembangan.
 */
export function packageTags(entry: Pick<PackageEntry, 'direct' | 'devOnly'>): string[] {
  const tags = [entry.direct === true ? 'langsung' : 'transitif'];
  if (entry.devOnly === true) tags.push('dev');
  return tags;
}
