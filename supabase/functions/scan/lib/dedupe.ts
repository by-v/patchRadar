/**
 * Deduplikasi paket berdasarkan pasangan (nama, versi).
 *
 * Fungsi murni ini dipakai setelah ekstraksi lockfile/package.json dan tidak
 * menyentuh API runtime tertentu (aman untuk Deno Edge Function).
 */

export interface PackageEntry {
  name: string;
  version: string;
  direct: boolean;
  devOnly: boolean;
  parentPackage: string | null;
}

export interface ParsedPackage extends PackageEntry {}

export interface ParseWarning {
  code: string;
  message: string;
}

/**
 * Gabungkan entri dengan nama+versi sama.
 *
 * - `direct`: true bila salah satu kemunculan langsung.
 * - `devOnly`: true hanya bila semua kemunculan dev-only.
 * - `parentPackage`: parent pertama yang ditemukan (null untuk paket langsung).
 */
export function dedupePackages(entries: readonly PackageEntry[]): ParsedPackage[] {
  const merged = new Map<string, ParsedPackage>();

  for (const entry of entries) {
    const key = `${entry.name}@${entry.version}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        name: entry.name,
        version: entry.version,
        direct: entry.direct,
        devOnly: entry.devOnly,
        parentPackage: entry.parentPackage,
      });
      continue;
    }

    existing.direct = existing.direct || entry.direct;
    existing.devOnly = existing.devOnly && entry.devOnly;
    if (existing.parentPackage === null && entry.parentPackage !== null) {
      existing.parentPackage = entry.parentPackage;
    }
  }

  return [...merged.values()].sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    if (a.version === b.version) return 0;
    return a.version < b.version ? -1 : 1;
  });
}
