import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: "#1a1d2e", borderTopColor: "#2a2d3e", height: 60, paddingBottom: 8 },
        tabBarActiveTintColor: "#6366f1",
        tabBarInactiveTintColor: "#555",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{ title: "Practice", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>🎙️</Text> }}
      />
      <Tabs.Screen
        name="history"
        options={{ title: "History", tabBarIcon: ({ color }) => <Text style={{ fontSize: 20 }}>📋</Text> }}
      />
    </Tabs>
  );
}
