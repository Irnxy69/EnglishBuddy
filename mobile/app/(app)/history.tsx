import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { sessionApi } from "@/lib/api";

interface Session {
  session_id: string;
  mode: string;
  created_at: string;
  message_count?: number;
}

const MODE_ICON: Record<string, string> = {
  ielts: "🎓",
  daily: "☕",
  interview: "💼",
};

const MODE_COLOR: Record<string, string> = {
  ielts: "#6366f1",
  daily: "#06b6d4",
  interview: "#f59e0b",
};

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await sessionApi.list();
      setSessions(data.sessions ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color="#6366f1" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Practice History</Text>
        <Text style={styles.headerSub}>{sessions.length} sessions</Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySubtitle}>Start practicing and your sessions will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.session_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const color = MODE_COLOR[item.mode] ?? "#6366f1";
            const icon = MODE_ICON[item.mode] ?? "🎙️";
            const date = new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            });
            return (
              <View style={[styles.card, { borderLeftColor: color, borderLeftWidth: 3 }]}>
                <View style={styles.cardLeft}>
                  <Text style={styles.cardIcon}>{icon}</Text>
                  <View>
                    <Text style={[styles.cardMode, { color }]}>
                      {item.mode.charAt(0).toUpperCase() + item.mode.slice(1)} Mode
                    </Text>
                    <Text style={styles.cardDate}>{date}</Text>
                  </View>
                </View>
                {item.message_count != null && (
                  <View style={[styles.countBadge, { backgroundColor: `${color}18` }]}>
                    <Text style={[styles.countText, { color }]}>{item.message_count} msgs</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1117" },
  header: { paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#1e2130" },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "700" },
  headerSub: { color: "#666", fontSize: 13, marginTop: 2 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { color: "#888", fontSize: 13, textAlign: "center" },
  card: { backgroundColor: "#1a1d2e", borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#2a2d3e" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { fontSize: 24 },
  cardMode: { fontSize: 15, fontWeight: "600" },
  cardDate: { color: "#666", fontSize: 12, marginTop: 2 },
  countBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { fontSize: 12, fontWeight: "600" },
});
