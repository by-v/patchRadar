import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';

import {
  DEFAULT_THEME_MODE,
  readThemeMode,
  saveThemeMode,
  type ThemeMode,
} from '@/lib/theme-preference';
import { secureStorage } from '@/storage/secure';

type ThemeModeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue | null>(null);

/**
 * Sumber kebenaran tema aplikasi. Pengaturan sistem sengaja tidak dipakai;
 * override `Appearance` menjaga elemen native tetap mengikuti pilihan pengguna.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME_MODE);

  const applyNativeAppearance = useCallback((next: ThemeMode) => {
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(next);
    }
  }, []);

  useEffect(() => {
    let active = true;
    applyNativeAppearance(DEFAULT_THEME_MODE);

    void readThemeMode(secureStorage)
      .then((stored) => {
        if (active) {
          setModeState(stored);
          applyNativeAppearance(stored);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [applyNativeAppearance]);

  const setMode = useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      applyNativeAppearance(next);
      void saveThemeMode(secureStorage, next).catch(() => undefined);
    },
    [applyNativeAppearance],
  );

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode(): ThemeModeContextValue {
  const value = useContext(ThemeModeContext);
  if (!value) {
    throw new Error('useThemeMode harus dipakai di dalam ThemeModeProvider');
  }
  return value;
}
