/**
 * Token desain PatchRadar.
 *
 * Acuan lengkap: `docs/ui-design.md` §3–§5.
 * Tema dipilih pengguna lewat `ThemeModeProvider`; `useTheme` memilih
 * `Colors.light`/`Colors.dark` tanpa mengikuti pengaturan sistem.
 */

import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

const lightColors = {
  // Teks
  text: '#1E1E1E',
  textSecondary: '#544B45',
  textOnDark: '#F2EDE8',
  textMutedOnDark: '#A2958B',
  /** Teks pada pil status berwarna; putih murni sesuai `docs/ui-design.md` §3.3. */
  textOnStatus: '#FFFFFF',
  /** Tautan berwarna pada permukaan terang (rasio ≥4,5:1 di `canvasTop`). */
  linkPrimary: '#1E40AF',

  // Permukaan
  background: '#DDD3CC',
  backgroundElement: '#CABEB5',
  backgroundSelected: '#2A2725',
  canvasTop: '#DDD3CC',
  canvasMid: '#CABEB5',
  canvasBottom: '#A2958B',
  glassFill: 'rgba(255, 255, 255, 0.22)',
  glassFillStrong: 'rgba(255, 255, 255, 0.38)',
  glassBorder: 'rgba(255, 255, 255, 0.40)',
  inputFill: 'rgba(255, 255, 255, 0.30)',
  inputBorder: 'rgba(255, 255, 255, 0.45)',
  inputBorderFocus: 'rgba(255, 255, 255, 0.75)',
  hairline: '#6B605A',
  darkCard: '#1E1E1E',
  darkAccent: '#2A2725',

  // Status
  success: '#3F6212',
  warning: '#92690B',
  danger: '#B3261E',
  successSurface: 'rgba(63, 98, 18, 0.12)',
  warningSurface: 'rgba(146, 105, 11, 0.12)',
  dangerSurface: 'rgba(179, 38, 30, 0.12)',
  infoSurface: 'rgba(30, 30, 30, 0.06)',

  // Severity
  severityCritical: '#B3261E',
  severityHigh: '#C2410C',
  severityMedium: '#92690B',
  severityLow: '#4D7C0F',
  severityUnknown: '#544B45',
} as const;

/**
 * Palet gelap. Nilai teks/aksen lebih terang agar rasio kontras terhadap
 * permukaan gelap tetap ≥4,5:1; kartu tanda tangan (`darkCard`) tetap gelap
 * dengan teks `textOnDark`. Pemeriksaan rasio otomatis: `theme.test.ts`.
 */
const darkColors = {
  // Teks
  text: '#F2EDE8',
  textSecondary: '#C0B2A7',
  textOnDark: '#F2EDE8',
  textMutedOnDark: '#A2958B',
  /** Teks pada pil status berwarna terang di mode gelap. */
  textOnStatus: '#1E1E1E',
  linkPrimary: '#9CC4FF',

  // Permukaan
  background: '#171412',
  backgroundElement: '#221E1B',
  backgroundSelected: '#F2EDE8',
  canvasTop: '#1B1714',
  canvasMid: '#141110',
  canvasBottom: '#0C0A09',
  glassFill: 'rgba(255, 255, 255, 0.05)',
  glassFillStrong: 'rgba(255, 255, 255, 0.10)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  inputFill: 'rgba(255, 255, 255, 0.07)',
  inputBorder: 'rgba(255, 255, 255, 0.18)',
  inputBorderFocus: 'rgba(255, 255, 255, 0.38)',
  hairline: '#4A443F',
  darkCard: '#0B0908',
  darkAccent: '#2C2723',

  // Status
  success: '#A3E635',
  warning: '#FACC15',
  danger: '#FF8A80',
  successSurface: 'rgba(163, 230, 53, 0.14)',
  warningSurface: 'rgba(250, 204, 21, 0.14)',
  dangerSurface: 'rgba(255, 138, 128, 0.14)',
  infoSurface: 'rgba(255, 255, 255, 0.06)',

  // Severity
  severityCritical: '#FF8A80',
  severityHigh: '#FB923C',
  severityMedium: '#FACC15',
  severityLow: '#A3E635',
  severityUnknown: '#C0B2A7',
} as const;

export const Colors = {
  light: lightColors,
  dark: darkColors,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  /** Jarak antar kartu pada daftar. */
  gap: 12,
} as const;

export const Radius = {
  card: 28,
  panel: 28,
  banner: 20,
  pill: 999,
} as const;

export const Typography = {
  screenTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  darkCardTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '400',
    letterSpacing: -0.4,
  },
  displayNumber: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
  },
  code: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: Fonts?.mono,
  },
} satisfies Record<string, TextStyle>;

export const Shadows = {
  glass: Platform.select({
    ios: {
      shadowColor: '#1E1E1E',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 32,
    },
    web: { boxShadow: '0px 12px 32px rgba(30, 30, 30, 0.12)' },
    default: { elevation: 6 },
  }),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/** Tinggi tab bar mengambang tanpa safe area bawah. */
export const TabBarHeight = 64;
