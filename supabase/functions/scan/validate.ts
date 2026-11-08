/**
 * Validasi masukan `repoUrl` tanpa SSRF (PRD §9.1/§12).
 *
 * Aturan sengaja ketat: hanya `https://github.com/{pemilik}/{repo}` persis.
 * Query, fragmen, path tambahan, port, userinfo, host lain, host unicode,
 * encoding persen, dan karakter di luar daftar aman ditolak.
 */

export const MAX_REPO_URL_LENGTH = 2048;
const OWNER_MAX = 39;
const REPO_MAX = 100;
const SAFE_NAME = /^[A-Za-z0-9_.-]+$/;

export type RepoValidationReason =
  | 'EMPTY'
  | 'INVALID_FORMAT'
  | 'WRONG_HOST'
  | 'EXTRA_PATH';

export type RepoValidation =
  | {
      ok: true;
      owner: string;
      repo: string;
      canonicalUrl: string;
    }
  | {
      ok: false;
      reason: RepoValidationReason;
      message: string;
    };

function fail(reason: RepoValidationReason, message: string): RepoValidation {
  return { ok: false, reason, message };
}

/** Validasi URL repo GitHub menjadi owner/repo yang aman dipakai di URL API. */
export function validateRepoUrl(input: unknown): RepoValidation {
  if (typeof input !== 'string' || input.trim().length === 0) {
    return fail('EMPTY', 'Tempel tautan repo GitHub terlebih dahulu.');
  }

  // Tolak karakter kontrol/newline sebelum trim agar newline tidak lolos.
  if (/[\u0000-\u001f\u007f]/.test(input)) {
    return fail('INVALID_FORMAT', 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repo.');
  }

  const value = input.trim();
  if (value.length > MAX_REPO_URL_LENGTH) {
    return fail('INVALID_FORMAT', 'Tautan terlalu panjang.');
  }

  // Tolak spasi/karakter kontrol di mana pun, termasuk newline.
  if (/[\s\u0000-\u001f\u007f]/.test(value)) {
    return fail('INVALID_FORMAT', 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repo.');
  }

  const scheme = 'https://';
  if (!value.startsWith(scheme)) {
    return fail('INVALID_FORMAT', 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repo.');
  }

  const afterScheme = value.slice(scheme.length);
  const slashIndex = afterScheme.indexOf('/');
  const authority = slashIndex === -1 ? afterScheme : afterScheme.slice(0, slashIndex);

  if (authority !== 'github.com') {
    return fail('WRONG_HOST', 'Hanya tautan github.com yang didukung.');
  }

  if (slashIndex === -1) {
    return fail('INVALID_FORMAT', 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repo.');
  }

  const path = afterScheme.slice(slashIndex);
  if (path.includes('?') || path.includes('#')) {
    return fail(
      'EXTRA_PATH',
      'Gunakan tautan halaman utama repo, tanpa /tree, /blob, atau parameter.',
    );
  }

  const match = /^\/([^/]+)\/([^/]+)$/.exec(path);
  if (!match) {
    return fail(
      'EXTRA_PATH',
      'Gunakan tautan halaman utama repo, tanpa /tree, /blob, atau parameter.',
    );
  }

  const owner = match[1] ?? '';
  const repo = match[2] ?? '';

  if (
    owner.length === 0 ||
    owner.length > OWNER_MAX ||
    repo.length === 0 ||
    repo.length > REPO_MAX ||
    !SAFE_NAME.test(owner) ||
    !SAFE_NAME.test(repo) ||
    owner === '.' ||
    owner === '..' ||
    repo === '.' ||
    repo === '..'
  ) {
    return fail('INVALID_FORMAT', 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repo.');
  }

  return {
    ok: true,
    owner,
    repo,
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}
