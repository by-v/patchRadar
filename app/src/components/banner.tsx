import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

export type BannerVariant = 'info' | 'warning' | 'error' | 'success';

type BannerProps = {
  message: string;
  variant?: BannerVariant;
  title?: string;
};

const VARIANTS = {
  info: {
    icon: 'information-circle-outline',
    accent: Colors.light.text,
    surface: Colors.light.infoSurface,
  },
  warning: {
    icon: 'warning-outline',
    accent: Colors.light.warning,
    surface: Colors.light.warningSurface,
  },
  error: {
    icon: 'alert-circle-outline',
    accent: Colors.light.danger,
    surface: Colors.light.dangerSurface,
  },
  success: {
    icon: 'checkmark-circle-outline',
    accent: Colors.light.success,
    surface: Colors.light.successSurface,
  },
} as const;

/**
 * Pemberitahuan dalam aplikasi. Dipakai sebagai pengganti `Alert.alert`,
 * yang tidak diimplementasikan oleh React Native Web.
 */
export function Banner({ message, variant = 'info', title }: BannerProps) {
  const config = VARIANTS[variant];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={variant === 'error' ? 'alert' : 'text'}
      style={[styles.container, { backgroundColor: config.surface }]}>
      <Ionicons color={config.accent} name={config.icon} size={20} style={styles.icon} />
      <View style={styles.texts}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.banner,
  },
  icon: {
    marginTop: 1,
  },
  texts: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    ...Typography.sectionTitle,
    color: Colors.light.text,
  },
  message: {
    ...Typography.body,
    color: Colors.light.text,
  },
});
