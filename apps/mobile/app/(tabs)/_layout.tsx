import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.primary }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="car" color={color} size={size} /> }} />
      <Tabs.Screen name="log" options={{ title: 'Servicios',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="wrench" color={color} size={size} /> }} />
      <Tabs.Screen name="parts" options={{ title: 'Piezas',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" color={color} size={size} /> }} />
      <Tabs.Screen name="docs" options={{ title: 'Docs',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="file-document" color={color} size={size} /> }} />
      <Tabs.Screen name="guard" options={{ title: 'Guardia',
        tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="shield-check" color={color} size={size} /> }} />
    </Tabs>
  );
}
