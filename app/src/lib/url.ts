export const REPO_LINK_MESSAGES = {
  empty: 'Tempel tautan repositori GitHub terlebih dahulu.',
  format: 'Tautan tidak valid. Gunakan format https://github.com/pemilik/repositori.',
  host: 'Hanya tautan github.com yang didukung.',
  path: 'Gunakan tautan halaman utama repositori, tanpa /tree, /blob, atau parameter.',
} as const;

export type RepoLinkErrorCode = 'EMPTY' | 'FORMAT' | 'HOST' | 'PATH';

export type RepoLinkError = {
  code: RepoLinkErrorCode;
  message: string;
};

export type RepoLink = {
  owner: string;
  repo: string;
  /** Bentuk kanonis tanpa `.git`, garis miring di ujung, query, atau fragmen. */
  url: string;
};

export type RepoLinkResult =
  | { ok: true; value: RepoLink }
  | { ok: false; error: RepoLinkError };

const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

const ERROR_MESSAGES: Record<RepoLinkErrorCode, string> = {
  EMPTY: REPO_LINK_MESSAGES.empty,
  FORMAT: REPO_LINK_MESSAGES.format,
  HOST: REPO_LINK_MESSAGES.host,
  PATH: REPO_LINK_MESSAGES.path,
};

function fail(code: RepoLinkErrorCode): RepoLinkResult {
  return { ok: false, error: { code, message: ERROR_MESSAGES[code] } };
}

/**
 * Memvalidasi dan menormalkan tautan repo sesuai PRD FR-01.
 *
 * Menerima `https://github.com/pemilik/repo` dengan akhiran `/` atau `.git`.
 * Menolak skema selain https, host lain, query, fragmen, dan path tambahan.
 */
export function parseRepoLink(input: string): RepoLinkResult {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return fail('EMPTY');
  }

  const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*):\/\//.exec(trimmed);
  if (!schemeMatch || schemeMatch[1]?.toLowerCase() !== 'https') {
    return fail('FORMAT');
  }

  const rest = trimmed.slice(schemeMatch[0].length);

  const queryIndex = rest.indexOf('?');
  const fragmentIndex = rest.indexOf('#');
  const cutIndexes = [queryIndex, fragmentIndex].filter((index) => index >= 0);
  const cutIndex = cutIndexes.length > 0 ? Math.min(...cutIndexes) : rest.length;
  const pathPart = rest.slice(0, cutIndex);
  const hasQueryOrFragment = cutIndex < rest.length;

  const rawSegments = pathPart.split('/');
  const authority = rawSegments.shift() ?? '';
  if (authority.toLowerCase() !== 'github.com') {
    return fail('HOST');
  }

  const segments = rawSegments.filter((segment) => segment.length > 0);
  if (segments.length < 2) {
    return fail('FORMAT');
  }
  if (segments.length > 2 || hasQueryOrFragment) {
    return fail('PATH');
  }

  const owner = segments[0] ?? '';
  let repo = segments[1] ?? '';
  if (repo.toLowerCase().endsWith('.git')) {
    repo = repo.slice(0, -4);
  }

  if (!SEGMENT_PATTERN.test(owner) || !SEGMENT_PATTERN.test(repo) || repo === '.' || repo === '..') {
    return fail('FORMAT');
  }

  return {
    ok: true,
    value: {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
    },
  };
}
