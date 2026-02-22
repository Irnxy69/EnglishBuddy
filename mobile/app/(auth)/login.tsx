import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (tab === "login") {
        res = await authApi.login(email, password);
      } else {
        if (!name) { Alert.alert("Error", "Please enter your name"); setLoading(false); return; }
        res = await authApi.register(email, password, name);
      }
      const { access_token, user_id, email: userEmail } = res.data;
      await login(access_token, { user_id, email: userEmail });
      router.replace("/(app)/chat");
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Authentication failed";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        {/* Logo */}
        <Text style={styles.logo}>🎙️ EnglishBuddy</Text>
        <Text style={styles.subtitle}>AI-powered speaking practice</Text>

        {/* Tab */}
        <View style={styles.tabRow}>
          {(["login", "register"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "login" ? "Sign In" : "Sign Up"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fields */}
        {tab === "register" && (
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor="#555"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#555"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {/* Submit */}
        <TouchableOpacity
          style={styles.btn}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {tab === "login" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f1117",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#1a1d2e",
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: "#2a2d3e",
  },
  logo: { fontSize: 28, fontWeight: "700", color: "#fff", textAlign: "center" },
  subtitle: { color: "#888", textAlign: "center", marginTop: 6, marginBottom: 24, fontSize: 13 },
  tabRow: { flexDirection: "row", backgroundColor: "#0f1117", borderRadius: 10, marginBottom: 20, padding: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#6366f1" },
  tabText: { color: "#666", fontWeight: "600", fontSize: 14 },
  tabTextActive: { color: "#fff" },
  input: {
    backgroundColor: "#0f1117",
    borderWidth: 1,
    borderColor: "#2a2d3e",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: "#fff",
    fontSize: 15,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
