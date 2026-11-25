import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Shadows, Spacing, TabBarHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Tombol mengambang tetap di kanan atas tab bar untuk membuka daftar repo
 * tersimpan. Fitur ini di luar MVP dan hanya menyimpan data di perangkat.
 */
export function FloatingHelpWidget() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrapper,
        {
          bottom: TabBarHeight + Math.max(insets.bottom, Spacing.two) + Spacing.two,
        },
      ]}>
      <Pressable
        accessibilityHint="Membuka daftar repo yang tersimpan di perangkat"
        accessibilityLabel="Buka repo tersimpan"
        accessibilityRole="button"
        hitSlop={4}
        onPress={() => router.push('/saved-repos')}
        style={({ pressed }) => [
          styles.button,
          Shadows.glass,
          {
            backgroundColor: theme.darkAccent,
            borderColor: theme.glassBorder,
          },
          pressed && styles.pressed,
        ]}>
        <Image
          accessibilityIgnoresInvertColors
          contentFit="cover"
          source={require('@/assets/images/patchradar-logo.jpg')}
          style={styles.logo}
        />
      </Pressable>
    </View>
  );
}

const FAB_SIZE = 56;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    right: Spacing.four,
    zIndex: 10,
    alignItems: 'flex-end',
  },
  button: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: Radius.pill,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.75,
  },
});
