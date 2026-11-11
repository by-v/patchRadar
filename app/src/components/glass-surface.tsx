import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadows } from '@/constants/theme';
import { useReduceTransparency } from '@/hooks/use-reduce-transparency';

type GlassSurfaceProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'strong';
  radius?: number;
};

const supportsNativeGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

/**
 * Panel kaca PatchRadar.
 *
 * iOS 26 memakai efek kaca native; platform lain memakai panel semi-opaque
 * dengan border terang. Setelan "kurangi transparansi" selalu memaksa
 * panel opaque agar teks tetap terbaca.
 */
export function GlassSurface({
  children,
  style,
  variant = 'default',
  radius = Radius.card,
}: GlassSurfaceProps) {
  const reduceTransparency = useReduceTransparency();

  if (supportsNativeGlass && !reduceTransparency) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={variant === 'strong' ? Colors.light.glassFillStrong : Colors.light.glassFill}
        style={[{ borderRadius: radius }, style]}>
        {children}
      </GlassView>
    );
  }

  const opaque = reduceTransparency;

  return (
    <View
      style={[
        styles.base,
        Shadows.glass,
        {
          borderRadius: radius,
          backgroundColor: opaque
            ? Colors.light.backgroundElement
            : variant === 'strong'
              ? Colors.light.glassFillStrong
              : Colors.light.glassFill,
          borderColor: opaque ? Colors.light.hairline : Colors.light.glassBorder,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
});
