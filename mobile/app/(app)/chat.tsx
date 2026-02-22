"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { useAuthStore } from "@/store/authStore";
import { sessionApi, chatApi, reportApi } from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────
type Message = { role: "user" | "assistant"; content: string };
type Mode = "ielts" | "daily" | "interview";

const MODES: { key: Mode; label: string; icon: string; color: string }[] = [
  { key: "ielts",     label: "IELTS",     icon: "🎓", color: "#6366f1" },
  { key: "daily",     label: "Daily",     icon: "☕", color: "#06b6d4" },
  { key: "interview", label: "Interview", icon: "💼", color: "#f59e0b" },
];

export default function ChatScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [mode, setMode] = useState<Mode>("ielts");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const recognizedText = useRef("");
  const messagesRef = useRef<Message[]>([]);

  // Keep ref in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // ── STT Events ──────────────────────────────────────────────────────────
  useSpeechRecognitionEvent("result", (e) => {
    recognizedText.current = e.results[0]?.transcript ?? "";
  });

  useSpeechRecognitionEvent("end", async () => {
    const text = recognizedText.current.trim();
    recognizedText.current = "";
    if (!text || !sessionId) { setStatus("idle"); return; }
    await processMessage(text);
  });

  useSpeechRecognitionEvent("error", (e) => {
    setError(`Recognition error: ${e.error}`);
    setStatus("idle");
  });

  // ── Session ──────────────────────────────────────────────────────────────
  useEffect(() => {
    createSession(mode);
  }, [mode]);

  const createSession = async (m: Mode) => {
    try {
      const { data } = await sessionApi.create(m);
      setSessionId(data.session_id);
      setMessages([]);
      setReport(null);
    } catch {
      setError("Failed to start session. Check your connection.");
    }
  };

  // ── Recording ────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    setError(null);
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError("Microphone permission denied.");
      return;
    }
    setStatus("listening");
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      maxAlternatives: 1,
    });
  }, []);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    setStatus("thinking");
  }, []);

  // ── Process Message ──────────────────────────────────────────────────────
  const processMessage = async (userText: string) => {
    setStatus("thinking");
    const newMessages: Message[] = [
      ...messagesRef.current,
      { role: "user", content: userText },
    ];
    setMessages(newMessages);
    scrollRef.current?.scrollToEnd({ animated: true });

    try {
      const { data } = await chatApi.send(
        sessionId!,
        userText,
        messagesRef.current,
        mode
      );
      const aiReply = data.reply;
      const updated: Message[] = [...newMessages, { role: "assistant", content: aiReply }];
      setMessages(updated);
      scrollRef.current?.scrollToEnd({ animated: true });

      // TTS via device native
      setStatus("speaking");
      await new Promise<void>((resolve) => {
        Speech.speak(aiReply, {
          language: "en-US",
          rate: 0.92,
          onDone: resolve,
          onError: () => resolve(),
          onStopped: () => resolve(),
        });
      });
      setStatus("idle");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Something went wrong.");
      setStatus("idle");
    }
  };

  // ── Report ───────────────────────────────────────────────────────────────
  const handleReport = async () => {
    if (messages.length < 4) {
      Alert.alert("Too early", "Have a longer conversation first!");
      return;
    }
    if (!sessionId) return;
    setReportLoading(true);
    try {
      const { data } = await reportApi.generate(sessionId, messages);
      setReport(data.content);
      setShowReport(true);
    } catch {
      setError("Failed to generate report.");
    } finally {
      setReportLoading(false);
    }
  };

  const handleNewTopic = () => {
    Speech.stop();
    setStatus("idle");
    setError(null);
    createSession(mode);
  };

  const currentMode = MODES.find((m) => m.key === mode)!;

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowModeMenu(true)} style={[styles.modeBadge, { borderColor: `${currentMode.color}55`, backgroundColor: `${currentMode.color}18` }]}>
          <Text style={[styles.modeBadgeText, { color: currentMode.color }]}>
            {currentMode.icon} {currentMode.label} Mode ▾
          </Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleNewTopic} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleReport}
            style={[styles.iconBtn, reportLoading && { opacity: 0.5 }]}
            disabled={reportLoading || messages.length < 4}
          >
            {reportLoading ? <ActivityIndicator color="#888" size="small" /> : <Text style={styles.iconBtnText}>📊</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={async () => { await logout(); router.replace("/(auth)/login"); }} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🚪</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageArea}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎙️</Text>
            <Text style={styles.emptyTitle}>Ready to practice!</Text>
            <Text style={styles.emptySubtitle}>Hold the button and speak. Echo is listening.</Text>
          </View>
        )}
        {messages.map((msg, i) => (
          <View key={i} style={{ alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "assistant" && (
              <Text style={styles.senderLabel}>Echo</Text>
            )}
            <View style={msg.role === "user" ? styles.bubbleUser : styles.bubbleAI}>
              <Text style={styles.bubbleText}>{msg.content}</Text>
            </View>
          </View>
        ))}
        {status === "thinking" && (
          <View style={{ alignItems: "flex-start" }}>
            <Text style={styles.senderLabel}>Echo</Text>
            <View style={styles.bubbleAI}>
              <ActivityIndicator color="#6366f1" size="small" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Error ── */}
      {error && (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.errorClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Controls ── */}
      <View style={styles.controls}>
        <Text style={styles.statusText}>
          {status === "idle" && "Hold to speak"}
          {status === "listening" && "🔴 Listening..."}
          {status === "thinking" && "💭 Echo is thinking..."}
          {status === "speaking" && "🔊 Echo is speaking..."}
        </Text>
        <Pressable
          style={[styles.recordBtn, status === "listening" && styles.recordBtnActive]}
          onPressIn={status === "idle" ? startListening : undefined}
          onPressOut={status === "listening" ? stopListening : undefined}
          disabled={status === "thinking" || status === "speaking"}
        >
          <Text style={styles.recordBtnIcon}>
            {status === "listening" ? "⏹" : "🎤"}
          </Text>
        </Pressable>
        <Text style={styles.statusSub}>
          {messages.length > 0 ? `${Math.ceil(messages.length / 2)} turns` : ""}
        </Text>
      </View>

      {/* ── Mode Menu ── */}
      <Modal transparent visible={showModeMenu} animationType="slide" onRequestClose={() => setShowModeMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModeMenu(false)}>
          <View style={styles.modeSheet}>
            <Text style={styles.modeSheetTitle}>Select Practice Mode</Text>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[styles.modeOption, mode === m.key && { backgroundColor: `${m.color}18`, borderColor: `${m.color}55` }]}
                onPress={() => { setMode(m.key); setShowModeMenu(false); }}
              >
                <Text style={styles.modeOptionIcon}>{m.icon}</Text>
                <Text style={[styles.modeOptionLabel, mode === m.key && { color: m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Report Modal ── */}
      <Modal transparent visible={showReport} animationType="slide" onRequestClose={() => setShowReport(false)}>
        <View style={styles.reportOverlay}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>📊 Assessment Report</Text>
              <TouchableOpacity onPress={() => setShowReport(false)}>
                <Text style={styles.reportClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              <Text style={styles.reportContent}>{report}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1117" },

  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#1e2130" },
  modeBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  modeBadgeText: { fontWeight: "700", fontSize: 13 },
  headerRight: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8, borderRadius: 10 },
  iconBtnText: { fontSize: 18 },

  // Messages
  messageArea: { flex: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center" },
  senderLabel: { fontSize: 11, color: "#666", marginBottom: 4, paddingLeft: 6 },
  bubbleUser: { backgroundColor: "#6366f1", borderRadius: 18, borderBottomRightRadius: 4, paddingHorizontal: 16, paddingVertical: 10, maxWidth: "80%" },
  bubbleAI: { backgroundColor: "#1e2130", borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 10, maxWidth: "80%", minWidth: 48, alignItems: "center" },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 22 },

  // Error
  errorBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "rgba(239,68,68,0.15)", borderTopWidth: 1, borderTopColor: "rgba(239,68,68,0.3)", paddingHorizontal: 16, paddingVertical: 10, marginHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },
  errorClose: { color: "#fca5a5", fontSize: 18, paddingLeft: 10 },

  // Controls
  controls: { paddingVertical: 20, paddingBottom: 36, alignItems: "center", borderTopWidth: 1, borderTopColor: "#1e2130", gap: 12 },
  statusText: { color: "#888", fontSize: 13 },
  statusSub: { color: "#555", fontSize: 12 },
  recordBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#6366f1", justifyContent: "center", alignItems: "center", shadowColor: "#6366f1", shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  recordBtnActive: { backgroundColor: "#ef4444", shadowColor: "#ef4444" },
  recordBtnIcon: { fontSize: 28 },

  // Mode sheet
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modeSheet: { backgroundColor: "#1a1d2e", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modeSheetTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  modeOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#2a2d3e", marginBottom: 10 },
  modeOptionIcon: { fontSize: 22 },
  modeOptionLabel: { color: "#ccc", fontSize: 16, fontWeight: "600" },

  // Report sheet
  reportOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  reportSheet: { backgroundColor: "#1a1d2e", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: "80%" },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  reportTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  reportClose: { color: "#888", fontSize: 22 },
  reportContent: { color: "#ccc", fontSize: 14, lineHeight: 22 },
});
