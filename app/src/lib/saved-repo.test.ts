import {
  createSavedRepoId,
  findDuplicateSavedRepo,
  parseSavedRepoFields,
  SAVED_REPO_NOTE_MAX_LENGTH,
  type SavedRepo,
} from './saved-repo';

function savedRepo(overrides: Partial<SavedRepo> = {}): SavedRepo {
  return {
    id: 'saved-1',
    repoFullName: 'expressjs/express',
    repoUrl: 'https://github.com/expressjs/express',
    note: '',
    createdAt: '2026-11-14T10:00:00.000Z',
    updatedAt: '2026-11-14T10:00:00.000Z',
    ...overrides,
  };
}

describe('parseSavedRepoFields', () => {
  it('menormalkan tautan dan memangkas catatan', () => {
    const result = parseSavedRepoFields(
      'https://github.com/ExpressJS/Express.git/',
      '  Repo latihan  ',
    );

    expect(result).toEqual({
      ok: true,
      value: {
        repoFullName: 'ExpressJS/Express',
        repoUrl: 'https://github.com/ExpressJS/Express',
        note: 'Repo latihan',
      },
    });
  });

  it('meneruskan pesan galat tautan dari parseRepoLink', () => {
    const result = parseSavedRepoFields('https://gitlab.com/pemilik/repo', '');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('github.com');
    }
  });

  it('menolak catatan yang melebihi batas', () => {
    const result = parseSavedRepoFields(
      'https://github.com/pemilik/repo',
      'a'.repeat(SAVED_REPO_NOTE_MAX_LENGTH + 1),
    );

    expect(result).toEqual({
      ok: false,
      error: `Catatan maksimal ${SAVED_REPO_NOTE_MAX_LENGTH} karakter.`,
    });
  });
});

describe('findDuplicateSavedRepo', () => {
  const repos = [
    savedRepo(),
    savedRepo({
      id: 'saved-2',
      repoUrl: 'https://github.com/lain/repo',
      repoFullName: 'lain/repo',
    }),
  ];

  it('menemukan tautan yang sama tanpa membedakan huruf besar-kecil', () => {
    expect(findDuplicateSavedRepo(repos, 'https://github.com/LAIN/repo')?.id).toBe('saved-2');
  });

  it('mengabaikan item yang sedang diubah', () => {
    expect(
      findDuplicateSavedRepo(repos, 'https://github.com/expressjs/express', 'saved-1'),
    ).toBeNull();
  });

  it('mengembalikan null bila tautan belum ada', () => {
    expect(findDuplicateSavedRepo(repos, 'https://github.com/baru/repo')).toBeNull();
  });
});

describe('createSavedRepoId', () => {
  it('menghasilkan ID berawalan saved dan berbeda untuk waktu berbeda', () => {
    const first = createSavedRepoId(1_700_000_000_000, () => 0.123456);
    const second = createSavedRepoId(1_700_000_000_001, () => 0.654321);

    expect(first).toMatch(/^saved-[a-z0-9]+-[a-z0-9]+$/);
    expect(first).not.toBe(second);
  });
});
