/**
 * Utilitas kontras WCAG untuk pemeriksaan token tema.
 *
 * Hanya memproses heksadesimal opak (`#RGB`/`#RRGGBB`); permukaan transparan
 * perlu dikaburkan dengan latar dulu sebelum dibandingkan.
 */

function parseHex(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.trim().replace(/^#/, '');

  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized[0]! + normalized[0]!, 16),
      g: Number.parseInt(normalized[1]! + normalized[1]!, 16),
      b: Number.parseInt(normalized[2]! + normalized[2]!, 16),
    };
  }

  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return {
      r: Number.parseInt(normalized.slice(0, 2), 16),
      g: Number.parseInt(normalized.slice(2, 4), 16),
      b: Number.parseInt(normalized.slice(4, 6), 16),
    };
  }

  throw new Error(`Format warna tidak didukung: ${hex}`);
}

/** Relatif luminansi WCAG dari heksadesimal opak. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);

  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rasio kontras WCAG antara dua heksadesimal opak; 1–21. */
export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}
