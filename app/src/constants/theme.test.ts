import { Colors } from '@/constants/theme';
import { contrastRatio } from '@/lib/contrast';

const AA_MINIMUM = 4.5;

describe('palet tema', () => {
  it('tidak mengubah token terang yang sudah terdokumentasi', () => {
    expect(Colors.light).toMatchObject({
      text: '#1E1E1E',
      textSecondary: '#544B45',
      textOnDark: '#F2EDE8',
      canvasTop: '#DDD3CC',
      canvasMid: '#CABEB5',
      canvasBottom: '#A2958B',
      darkCard: '#1E1E1E',
      darkAccent: '#2A2725',
      severityCritical: '#B3261E',
      severityHigh: '#C2410C',
      severityMedium: '#92690B',
      severityLow: '#4D7C0F',
      severityUnknown: '#544B45',
    });
  });

  it('menyediakan palet gelap yang benar-benar berbeda dari palet terang', () => {
    expect(Colors.dark.text).not.toBe(Colors.light.text);
    expect(Colors.dark.canvasTop).not.toBe(Colors.light.canvasTop);
    expect(Colors.dark.darkCard).not.toBe(Colors.light.darkCard);
    expect(Colors.dark.textOnStatus).not.toBe(Colors.light.textOnStatus);
  });

  it.each([
    ['teks utama di canvasTop', Colors.dark.text, Colors.dark.canvasTop],
    ['teks utama di canvasMid', Colors.dark.text, Colors.dark.canvasMid],
    ['teks utama di canvasBottom', Colors.dark.text, Colors.dark.canvasBottom],
    ['teks sekunder di canvasTop', Colors.dark.textSecondary, Colors.dark.canvasTop],
    ['teks di permukaan kaca opaque', Colors.dark.text, Colors.dark.backgroundElement],
    ['teks di aksen gelap', Colors.dark.text, Colors.dark.darkAccent],
    ['teks di kartu gelap', Colors.dark.textOnDark, Colors.dark.darkCard],
    ['teks muda di kartu gelap', Colors.dark.textMutedOnDark, Colors.dark.darkCard],
    ['tautan di canvasTop', Colors.dark.linkPrimary, Colors.dark.canvasTop],
    ['teks pada status kritikal', Colors.dark.textOnStatus, Colors.dark.severityCritical],
    ['teks pada status tinggi', Colors.dark.textOnStatus, Colors.dark.severityHigh],
    ['teks pada status sedang', Colors.dark.textOnStatus, Colors.dark.severityMedium],
    ['teks pada status rendah', Colors.dark.textOnStatus, Colors.dark.severityLow],
    ['teks pada status tidak diketahui', Colors.dark.textOnStatus, Colors.dark.severityUnknown],
  ])('kontras gelap %s lulus AA', (_label, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_MINIMUM);
  });

  it.each([
    ['teks utama di canvasTop', Colors.light.text, Colors.light.canvasTop],
    ['teks sekunder di canvasTop', Colors.light.textSecondary, Colors.light.canvasTop],
    ['teks sekunder di canvasMid', Colors.light.textSecondary, Colors.light.canvasMid],
    ['teks di kartu gelap', Colors.light.textOnDark, Colors.light.darkCard],
    ['tautan di canvasTop', Colors.light.linkPrimary, Colors.light.canvasTop],
    ['teks pada status kritikal', Colors.light.textOnStatus, Colors.light.severityCritical],
    ['teks pada status tinggi', Colors.light.textOnStatus, Colors.light.severityHigh],
    ['teks pada status sedang', Colors.light.textOnStatus, Colors.light.severityMedium],
    ['teks pada status rendah', Colors.light.textOnStatus, Colors.light.severityLow],
    ['teks pada status tidak diketahui', Colors.light.textOnStatus, Colors.light.severityUnknown],
  ])('kontras terang %s lulus AA', (_label, foreground, background) => {
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(AA_MINIMUM);
  });

  it('menghitung rasio hitam-putih sesuai WCAG', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 2);
  });
});
