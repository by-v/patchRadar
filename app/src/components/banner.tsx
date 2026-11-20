import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme, type Theme } from '@/hooks/use-theme';

export type BannerVariant = 'info' | 'warning' | 'error' | 'success';

type BannerProps = {
  message: string;
  variant?: BannerVariant;
  title?: string;
};

type BannerVariantConfig = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  surface: string;
};

/**
 * Pemberitahuan dalam aplikasi. Dipakai sebagai pengganti `Alert.alert`,
 * yang tidak diimplementasikan oleh React Native Web.
 */
export function Banner({ message, variant = 'info', title }: BannerProps) {
  const theme = useTheme();
  const config = variantConfig(theme)[variant];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={variant === 'error' ? 'alert' : 'text'}
      style={[styles.container, { backgroundColor: config.surface }]}>
      <Ionicons color={config.accent} name={config.icon} size={20} style={styles.icon} />
      <View style={styles.texts}>
        {title ? <Text style={[styles.title, { color: theme.text }]}>{title}</Text> : null}
        <Text style={[styles.message, { color: theme.text }]}>{message}</Text>
      </View>
    </View>
  );
}

function variantConfig(theme: Theme): Record<BannerVariant, BannerVariantConfig> {
  return {
    info: { icon: 'information-circle-outline', accent: theme.text, surface: theme.infoSurface },
    warning: {
      icon: 'warning-outline',
      accent: theme.warning,
      surface: theme.warningSurface,
    },
    error: { icon: 'alert-circle-outline', accent: theme.danger, surface: theme.dangerSurface },
    success: {
      icon: 'checkmark-circle-outline',
      accent: theme.success,
      surface: theme.successSurface,
    },
  };
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
  },
  message: {
    ...Typography.body,
  },
});
