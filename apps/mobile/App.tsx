import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { theme } from "@englishbuddy/design-system";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.hero}>
        <Text style={styles.badge}>EnglishBuddy Mobile</Text>
        <Text style={styles.title}>Speak English in realistic scenarios</Text>
        <Text style={styles.subtitle}>
          This Expo scaffold shares design tokens with web and backend roadmap. Next step is wiring auth + chat APIs.
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Phase Ready</Text>
        <Text style={styles.cardText}>- Shared theme package connected</Text>
        <Text style={styles.cardText}>- React Native runtime scaffolded</Text>
        <Text style={styles.cardText}>- API integration can start immediately</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.navy900,
    paddingHorizontal: theme.spacing.s4,
    paddingVertical: theme.spacing.s8
  },
  hero: {
    marginTop: theme.spacing.s8,
    gap: theme.spacing.s3
  },
  badge: {
    alignSelf: "flex-start",
    color: theme.colors.blue600,
    backgroundColor: theme.colors.sky100,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.s3,
    paddingVertical: theme.spacing.s1,
    overflow: "hidden",
    fontWeight: "700"
  },
  title: {
    color: theme.colors.white,
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38
  },
  subtitle: {
    color: "#BFD7EE",
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    marginTop: theme.spacing.s8,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.md,
    padding: theme.spacing.s4,
    gap: theme.spacing.s2
  },
  cardTitle: {
    color: theme.colors.ink900,
    fontSize: 18,
    fontWeight: "800"
  },
  cardText: {
    color: theme.colors.ink900,
    fontSize: 14,
    lineHeight: 20
  }
});
