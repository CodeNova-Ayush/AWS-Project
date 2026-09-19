import { Tabs } from 'expo-router';
import FloatingPillNav from '../../src/components/FloatingPillNav';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingPillNav {...props} />}
      screenOptions={{ headerShown: false }}
    />
  );
}
