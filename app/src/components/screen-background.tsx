import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/theme';

/**
 * Latar hangat PatchRadar: gradient tiga titik dengan dua blob cahaya lembut.
 * Blob dibuat dari `View` beradius besar, bukan blur runtime, agar tetap
 * ringan di perangkat Android kelas bawah.
 */
export function ScreenBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[Colors.light.canvasTop, Colors.light.canvasMid, Colors.light.canvasBottom]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTop: {
    width: 360,
    height: 360,
    top: -140,
    right: -110,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  blobBottom: {
    width: 300,
    height: 300,
    bottom: -150,
    left: -120,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
});
