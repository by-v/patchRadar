import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenBackground } from '@/components/screen-background';
import { MaxContentWidth, Spacing, TabBarHeight } from '@/constants/theme';

type ScreenProps = {
  children: ReactNode;
  /** Matikan bila layar mengelola scroll sendiri (mis. daftar panjang). */
  scroll?: boolean;
  /** Aktifkan pada layar dengan input teks. */
  avoidKeyboard?: boolean;
  /** Layar tab perlu ruang bawah untuk tab bar mengambang. */
  hasTabBar?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = true,
  avoidKeyboard = false,
  hasTabBar = true,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const paddingBottom = (hasTabBar ? TabBarHeight + Spacing.three : 0) + insets.bottom + Spacing.four;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, { paddingBottom }, contentStyle]}>{children}</View>
  );

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView edges={['top']} style={styles.fill}>
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.fill}>
            {body}
          </KeyboardAvoidingView>
        ) : (
          body
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
});
