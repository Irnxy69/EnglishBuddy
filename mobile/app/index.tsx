import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuthStore } from "@/store/authStore";

export default function Index() {
  const router = useRouter();
  const { isLoggedIn } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoggedIn) {
        router.replace("/(app)/chat");
      } else {
        router.replace("/(auth)/login");
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [isLoggedIn]);

  return (
    <View style={{ flex: 1, backgroundColor: "#0f1117", justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator color="#6366f1" size="large" />
    </View>
  );
}
