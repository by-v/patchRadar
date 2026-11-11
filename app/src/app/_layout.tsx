import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.text,
    background: Colors.light.canvasTop,
    card: Colors.light.canvasTop,
    text: Colors.light.text,
    border: 'transparent',
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="dark" />
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.light.canvasTop },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" />
      </Stack>
    </ThemeProvider>
  );
}
