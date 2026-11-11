import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Pindai' }} />
      <Tabs.Screen name="riwayat" options={{ title: 'Riwayat' }} />
      <Tabs.Screen name="tentang" options={{ title: 'Tentang' }} />
    </Tabs>
  );
}
