import { Tabs } from 'expo-router';
import FloatingPillNav from '../../src/components/FloatingPillNav';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingPillNav {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="sessions" options={{ title: 'Sessions' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="profile" options={{ title: 'Account' }} />
    </Tabs>
  );
}
