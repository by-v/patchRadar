import type { SecureStorage } from '@/storage/secure';

import {
  DEFAULT_THEME_MODE,
  THEME_STORAGE_KEY,
  normalizeThemeMode,
  readThemeMode,
  saveThemeMode,
} from './theme-preference';

function createMemoryStorage(initial?: string): SecureStorage & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(THEME_STORAGE_KEY, initial);

  return {
    raw,
    async getItem(key) {
      return raw.get(key) ?? null;
    },
    async setItem(key, value) {
      raw.set(key, value);
    },
    async removeItem(key) {
      raw.delete(key);
    },
  };
}

describe('preferensi tema', () => {
  it.each([
    ['dark', 'dark'],
    ['light', 'light'],
    [null, 'dark'],
    [undefined, 'dark'],
    ['', 'dark'],
    ['DARK', 'dark'],
    ['system', 'dark'],
    ['{"mode":"light"}', 'dark'],
  ])('menormalkan %p menjadi %p', (input, expected) => {
    expect(normalizeThemeMode(input)).toBe(expected);
  });

  it('memakai tema gelap sebagai default', () => {
    expect(DEFAULT_THEME_MODE).toBe('dark');
  });

  it('membaca preferensi tersimpan', async () => {
    const storage = createMemoryStorage('light');

    await expect(readThemeMode(storage)).resolves.toBe('light');
  });

  it('jatuh ke tema gelap bila penyimpanan kosong atau berisi nilai rusak', async () => {
    await expect(readThemeMode(createMemoryStorage())).resolves.toBe('dark');
    await expect(readThemeMode(createMemoryStorage('system'))).resolves.toBe('dark');
  });

  it('menyimpan pilihan ke kunci yang sama', async () => {
    const storage = createMemoryStorage();

    await saveThemeMode(storage, 'light');

    expect(storage.raw.get(THEME_STORAGE_KEY)).toBe('light');
    await expect(readThemeMode(storage)).resolves.toBe('light');
  });
});
