import { isReduceTransparencySupported } from '@/lib/reduce-transparency';

const fullApi = {
  isReduceTransparencyEnabled: () => Promise.resolve(false),
  addEventListener: () => ({ remove: () => undefined }),
};

describe('isReduceTransparencySupported', () => {
  it('menolak web meski API lengkap', () => {
    expect(isReduceTransparencySupported('web', fullApi)).toBe(false);
  });

  it('menerima iOS dan Android dengan API lengkap', () => {
    expect(isReduceTransparencySupported('ios', fullApi)).toBe(true);
    expect(isReduceTransparencySupported('android', fullApi)).toBe(true);
  });

  it('menolak platform tanpa isReduceTransparencyEnabled (kasus React Native Web)', () => {
    expect(
      isReduceTransparencySupported('ios', {
        addEventListener: fullApi.addEventListener,
      }),
    ).toBe(false);
  });

  it('menolak platform tanpa addEventListener', () => {
    expect(
      isReduceTransparencySupported('ios', {
        isReduceTransparencyEnabled: fullApi.isReduceTransparencyEnabled,
      }),
    ).toBe(false);
  });
});
