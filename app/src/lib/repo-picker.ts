/**
 * Penampung sementara antara layar Repo Tersimpan dan layar Pindai.
 *
 * Nilai hanya hidup di memori dan langsung diambil sekali agar pemilihan repo
 * tidak mengubah state saat render atau memicu efek berantai.
 */

let pendingRepoUrl: string | null = null;

export function setPendingRepoUrl(repoUrl: string): void {
  pendingRepoUrl = repoUrl;
}

/** Ambil tautan yang menunggu; `null` bila tidak ada. */
export function takePendingRepoUrl(): string | null {
  const repoUrl = pendingRepoUrl;
  pendingRepoUrl = null;
  return repoUrl;
}
