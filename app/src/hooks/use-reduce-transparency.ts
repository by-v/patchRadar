import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Mengikuti setelan "kurangi transparansi" sistem.
 * Dipakai untuk mengganti panel kaca dengan permukaan opaque.
 */
export function useReduceTransparency() {
  const [reduced, setReduced] = useState(false);

  const handleChange = useCallback((enabled: boolean) => {
    setReduced(enabled);
  }, []);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (isMounted) {
          setReduced(enabled);
        }
      })
      .catch(() => {
        // Perangkat tidak mendukung kueri ini; anggap transparansi aktif.
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      handleChange,
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [handleChange]);

  return reduced;
}
