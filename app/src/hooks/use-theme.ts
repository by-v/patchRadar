import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/providers/theme-mode-provider';

export type Theme = (typeof Colors)[keyof typeof Colors];

/** Palet aktif berdasarkan pilihan pengguna, bukan pengaturan sistem. */
export function useTheme(): Theme {
  const { mode } = useThemeMode();
  return Colors[mode];
}
