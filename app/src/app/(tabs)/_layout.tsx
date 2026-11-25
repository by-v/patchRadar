import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { FloatingHelpWidget } from '@/components/floating-help-widget';
import { TabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} />}>
        <Tabs.Screen name="index" options={{ title: 'Pindai' }} />
        <Tabs.Screen name="riwayat" options={{ title: 'Riwayat' }} />
        <Tabs.Screen name="tentang" options={{ title: 'Tentang' }} />
      </Tabs>
      <FloatingHelpWidget />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
