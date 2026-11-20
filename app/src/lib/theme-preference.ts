import type { SecureStorage } from '@/storage/secure';

/** Dua pilihan tema yang tersedia; tidak ada mode "Ikuti sistem". */
export type ThemeMode = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'patchradar.theme.mode';
export const DEFAULT_THEME_MODE: ThemeMode = 'dark';

/** Nilai selain `'light'` sengaja jatuh ke tema gelap. */
export function normalizeThemeMode(value: string | null | undefined): ThemeMode {
  return value === 'light' ? 'light' : DEFAULT_THEME_MODE;
}

export async function readThemeMode(storage: SecureStorage): Promise<ThemeMode> {
  return normalizeThemeMode(await storage.getItem(THEME_STORAGE_KEY));
}

export async function saveThemeMode(
  storage: SecureStorage,
  mode: ThemeMode,
): Promise<void> {
  await storage.setItem(THEME_STORAGE_KEY, mode);
}
