import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { usePalette } from '../../src/ui/shell.tsx';
export default function TabLayout() {
  const colors = usePalette();
  const names = [['index', 'Home', 'H'], ['learn', 'Learn', 'L'], ['practice', 'Practice', 'P'], ['exams', 'Exams', 'E'], ['progress', 'Progress', 'G']] as const;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border }, tabBarLabelStyle: { fontWeight: '600' } }}>
    {names.map(([name, title, icon]) => <Tabs.Screen key={name} name={name} options={{ title, tabBarAccessibilityLabel: title, tabBarIcon: ({ color }) => <Text accessible={false} style={{ color, fontWeight: '700', fontSize: 18 }}>{icon}</Text> }} />)}
  </Tabs>;
}
