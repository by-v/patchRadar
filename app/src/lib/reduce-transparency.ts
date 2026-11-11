type AccessibilityInfoLike = {
  isReduceTransparencyEnabled?: unknown;
  addEventListener?: unknown;
};

/**
 * React Native Web tidak menyediakan `isReduceTransparencyEnabled`, sehingga
 * pemanggilan langsung melempar `TypeError` dan mematikan seluruh subtree.
 * Deteksi ini memastikan hook hanya memanggil API yang benar-benar ada.
 */
export function isReduceTransparencySupported(
  platform: string,
  accessibilityInfo: AccessibilityInfoLike,
): boolean {
  return (
    platform !== 'web' &&
    typeof accessibilityInfo.isReduceTransparencyEnabled === 'function' &&
    typeof accessibilityInfo.addEventListener === 'function'
  );
}
