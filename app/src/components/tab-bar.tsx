import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, IoniconName> = {
  index: 'scan-outline',
  riwayat: 'time-outline',
  tentang: 'information-circle-outline',
};

const FALLBACK_LABELS: Record<string, string> = {
  index: 'Pindai',
  riwayat: 'Riwayat',
  tentang: 'Tentang',
};

/**
 * Tab bar kaca mengambang. Menggantikan `NativeTabs` karena gaya native
 * tidak dapat dibentuk menjadi pill mengambang.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, Spacing.two) }]}>
      <GlassSurface radius={Radius.pill} style={styles.bar} variant="strong">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options;
          const label = options?.title ?? FALLBACK_LABELS[route.name] ?? route.name;
          const icon = ICONS[route.name] ?? 'ellipse-outline';

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigateToTab(route.key);
            }
          };

          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              key={route.key}
              onPress={onPress}
              style={({ pressed }) => [
                styles.item,
                focused && styles.itemActive,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                color={focused ? Colors.light.textOnDark : Colors.light.textSecondary}
                name={icon}
                size={22}
              />
              <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
  bar: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: 6,
  },
  item: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  itemActive: {
    backgroundColor: Colors.light.darkAccent,
  },
  label: {
    ...Typography.tabLabel,
    color: Colors.light.textSecondary,
  },
  labelActive: {
    color: Colors.light.textOnDark,
  },
  pressed: {
    opacity: 0.7,
  },
});
