import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Shadows } from '@/constants/theme';
import { useReduceTransparency } from '@/hooks/use-reduce-transparency';
import { useTheme } from '@/hooks/use-theme';

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
  const theme = useTheme();

  if (supportsNativeGlass && !reduceTransparency) {
    return (
      <GlassView
        glassEffectStyle="regular"
        tintColor={variant === 'strong' ? theme.glassFillStrong : theme.glassFill}
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
            ? theme.backgroundElement
            : variant === 'strong'
              ? theme.glassFillStrong
              : theme.glassFill,
          borderColor: opaque ? theme.hairline : theme.glassBorder,
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
