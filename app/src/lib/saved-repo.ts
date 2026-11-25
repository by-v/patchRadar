/**
 * Aturan daftar repo tersimpan lokal (fitur di luar MVP).
 *
 * Fungsi di sini murni agar normalisasi tautan, batas catatan, dan deteksi
 * duplikat dapat diuji tanpa SQLite maupun React Native.
 */

import { parseRepoLink } from './url';

export const SAVED_REPO_NOTE_MAX_LENGTH = 280;
export const SAVED_REPO_LIMIT = 50;

export type SavedRepo = {
  id: string;
  repoFullName: string;
  repoUrl: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedRepoFields = Pick<SavedRepo, 'repoFullName' | 'repoUrl' | 'note'>;

export type SavedRepoParseResult =
  | { ok: true; value: SavedRepoFields }
  | { ok: false; error: string };

/** Validasi tautan repo dan rapikan catatan sebelum disimpan. */
export function parseSavedRepoFields(url: string, note: string): SavedRepoParseResult {
  const link = parseRepoLink(url);
  if (!link.ok) {
    return { ok: false, error: link.error.message };
  }

  const trimmedNote = note.trim();
  if (trimmedNote.length > SAVED_REPO_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Catatan maksimal ${SAVED_REPO_NOTE_MAX_LENGTH} karakter.`,
    };
  }

  return {
    ok: true,
    value: {
      repoFullName: `${link.value.owner}/${link.value.repo}`,
      repoUrl: link.value.url,
      note: trimmedNote,
    },
  };
}

/**
 * Cari repo dengan tautan yang sama. `exceptId` dipakai saat mengubah item
 * agar item itu sendiri tidak dianggap duplikat.
 */
export function findDuplicateSavedRepo(
  repos: readonly SavedRepo[],
  repoUrl: string,
  exceptId?: string,
): SavedRepo | null {
  const target = repoUrl.toLowerCase();
  return (
    repos.find(
      (repo) => repo.repoUrl.toLowerCase() === target && repo.id !== exceptId,
    ) ?? null
  );
}

/** ID lokal unik tanpa ketergantungan modul kriptografi native. */
export function createSavedRepoId(
  nowMs = Date.now(),
  random: () => number = Math.random,
): string {
  return `saved-${nowMs.toString(36)}-${random().toString(36).slice(2, 8)}`;
}
