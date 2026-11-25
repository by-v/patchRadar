import '@/global.css';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTheme } from '@/hooks/use-theme';
import { ThemeModeProvider, useThemeMode } from '@/providers/theme-mode-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <RootLayoutContent />
    </ThemeModeProvider>
  );
}

function RootLayoutContent() {
  const theme = useTheme();
  const { mode } = useThemeMode();
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;
  const statusBarStyle = mode === 'dark' ? 'light' : 'dark';
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: theme.text,
      background: theme.canvasTop,
      card: theme.canvasTop,
      text: theme.text,
      border: 'transparent',
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={statusBarStyle} />
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.canvasTop },
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" />
        <Stack.Screen name="saved-repos" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
