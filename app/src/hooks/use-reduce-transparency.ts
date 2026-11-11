import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { isReduceTransparencySupported } from '@/lib/reduce-transparency';

const supported = isReduceTransparencySupported(Platform.OS, AccessibilityInfo);

/**
 * Mengikuti setelan "kurangi transparansi" sistem.
 * Dipakai untuk mengganti panel kaca dengan permukaan opaque.
 *
 * Di web API ini tidak tersedia; hook mengembalikan `false` tanpa memanggil
 * apa pun sehingga panel tetap memakai fallback semi-opaque.
 */
export function useReduceTransparency() {
  const [reduced, setReduced] = useState(false);

  const handleChange = useCallback((enabled: boolean) => {
    setReduced(enabled);
  }, []);

  useEffect(() => {
    if (!supported) {
      return;
    }

    let isMounted = true;
    let subscription: { remove: () => void } | undefined;

    try {
      AccessibilityInfo.isReduceTransparencyEnabled()
        .then((enabled) => {
          if (isMounted) {
            setReduced(enabled);
          }
        })
        .catch(() => {
          // Perangkat tidak mendukung kueri ini; anggap transparansi aktif.
        });

      subscription = AccessibilityInfo.addEventListener(
        'reduceTransparencyChanged',
        handleChange,
      );
    } catch {
      // Runtime tanpa dukungan penuh: biarkan panel memakai fallback opaque.
    }

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [handleChange]);

  return reduced;
}
