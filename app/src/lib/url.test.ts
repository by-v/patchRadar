import { parseRepoLink, REPO_LINK_MESSAGES } from '@/lib/url';

function errorCodeOf(input: string) {
  const result = parseRepoLink(input);
  return result.ok ? null : result.error.code;
}

describe('parseRepoLink — input kosong (§12 baris 1)', () => {
  it('menolak string kosong', () => {
    expect(errorCodeOf('')).toBe('EMPTY');
    expect(parseRepoLink('')).toEqual({
      ok: false,
      error: { code: 'EMPTY', message: REPO_LINK_MESSAGES.empty },
    });
  });

  it('menolak spasi saja', () => {
    expect(errorCodeOf('   ')).toBe('EMPTY');
  });
});

describe('parseRepoLink — tautan valid', () => {
  it('menerima bentuk dasar', () => {
    expect(parseRepoLink('https://github.com/a/b')).toEqual({
      ok: true,
      value: { owner: 'a', repo: 'b', url: 'https://github.com/a/b' },
    });
  });

  it('menerima garis miring di ujung', () => {
    const result = parseRepoLink('https://github.com/a/b/');
    expect(result.ok && result.value.url).toBe('https://github.com/a/b');
  });

  it('menormalkan akhiran .git dari tombol Code GitHub', () => {
    const result = parseRepoLink('https://github.com/o/r.git');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.owner).toBe('o');
      expect(result.value.repo).toBe('r');
      expect(result.value.url).toBe('https://github.com/o/r');
    }
  });

  it('menormalkan .git yang diikuti garis miring', () => {
    const result = parseRepoLink('https://github.com/o/r.git/');
    expect(result.ok && result.value.url).toBe('https://github.com/o/r');
  });

  it('mengabaikan spasi di awal dan akhir', () => {
    const result = parseRepoLink('  https://github.com/a/b  ');
    expect(result.ok && result.value.url).toBe('https://github.com/a/b');
  });

  it('menerima host dengan huruf besar', () => {
    const result = parseRepoLink('https://GitHub.com/Owner/Repo');
    expect(result.ok && result.value.owner).toBe('Owner');
    expect(result.ok && result.value.repo).toBe('Repo');
  });

  it('menerima nama repo dengan titik, garis bawah, dan tanda hubung', () => {
    expect(errorCodeOf('https://github.com/my-org/next.js')).toBeNull();
    expect(errorCodeOf('https://github.com/my_org/my_repo')).toBeNull();
  });
});

describe('parseRepoLink — format bukan https://github.com/pemilik/repo (§12 baris 2)', () => {
  it('menolak tanpa skema', () => {
    expect(errorCodeOf('github.com/a/b')).toBe('FORMAT');
  });

  it('menolak http://', () => {
    expect(errorCodeOf('http://github.com/a/b')).toBe('FORMAT');
  });

  it('menolak skema lain', () => {
    expect(errorCodeOf('ftp://github.com/a/b')).toBe('FORMAT');
  });

  it('menolak repo tanpa pemilik', () => {
    expect(errorCodeOf('https://github.com/a')).toBe('FORMAT');
  });

  it('menolak karakter yang tidak sah', () => {
    expect(errorCodeOf('https://github.com/a/b c')).toBe('FORMAT');
  });

  it('memakai pesan §12 baris 2', () => {
    const result = parseRepoLink('github.com/a/b');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe(
        'Tautan tidak valid. Gunakan format https://github.com/pemilik/repositori.',
      );
    }
  });
});

describe('parseRepoLink — host selain github.com (§12 baris 3)', () => {
  it('menolak gitlab', () => {
    expect(errorCodeOf('https://gitlab.com/a/b')).toBe('HOST');
  });

  it('menolak subdomain github', () => {
    expect(errorCodeOf('https://www.github.com/a/b')).toBe('HOST');
  });

  it('menolak alamat IP', () => {
    expect(errorCodeOf('https://192.168.0.1/a/b')).toBe('HOST');
  });

  it('memakai pesan §12 baris 3', () => {
    const result = parseRepoLink('https://gitlab.com/a/b');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Hanya tautan github.com yang didukung.');
    }
  });
});

describe('parseRepoLink — path tambahan, query, atau fragmen (§12 baris 4)', () => {
  it('menolak /tree', () => {
    expect(errorCodeOf('https://github.com/a/b/tree/main')).toBe('PATH');
  });

  it('menolak /blob', () => {
    expect(errorCodeOf('https://github.com/a/b/blob/main/package.json')).toBe('PATH');
  });

  it('menolak query', () => {
    expect(errorCodeOf('https://github.com/a/b?tab=readme')).toBe('PATH');
  });

  it('menolak fragmen', () => {
    expect(errorCodeOf('https://github.com/a/b#readme')).toBe('PATH');
  });

  it('memakai pesan §12 baris 4', () => {
    const result = parseRepoLink('https://github.com/a/b/tree/main');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe(
        'Gunakan tautan halaman utama repositori, tanpa /tree, /blob, atau parameter.',
      );
    }
  });
});
