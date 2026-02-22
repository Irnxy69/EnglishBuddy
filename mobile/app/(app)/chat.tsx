import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
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
  const { logout } = useAuthStore();

  const [mode, setMode] = useState<Mode>("ielts");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking" | "speaking">("idle");
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const messagesRef = useRef<Message[]>([]);

  // Keep ref in sync
  const updateMessages = (msgs: Message[]) => {
    messagesRef.current = msgs;
    setMessages(msgs);
  };

  // ── Session ──────────────────────────────────────────────────────────────
  const createSession = useCallback(async (m: Mode) => {
    setSessionLoading(true);
    setError(null);
    try {
      const { data } = await sessionApi.create(m);
      setSessionId(data.session_id);
      updateMessages([]);
      setReport(null);
    } catch {
      setError("Failed to start session. Is the backend running?");
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // Create initial session on first render
  const initialized = useRef(false);
  if (!initialized.current) {
    initialized.current = true;
    createSession("ielts");
  }

  // ── Send Message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !sessionId || status !== "idle") return;

    setInputText("");
    setError(null);
    const newMessages: Message[] = [
      ...messagesRef.current,
      { role: "user", content: text },
    ];
    updateMessages(newMessages);
    setStatus("thinking");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const { data } = await chatApi.send(
        sessionId,
        text,
        messagesRef.current.slice(0, -1), // history without current
        mode
      );
      const aiReply: string = data.reply;
      const updated: Message[] = [...newMessages, { role: "assistant", content: aiReply }];
      updateMessages(updated);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

      // TTS via device native (expo-speech)
      setStatus("speaking");
      await new Promise<void>((resolve) => {
        Speech.speak(aiReply, {
          language: "en-US",
          rate: 0.9,
          onDone: resolve,
          onError: () => resolve(),
          onStopped: () => resolve(),
        });
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setStatus("idle");
    }
  }, [inputText, sessionId, status, mode]);

  // ── Report ───────────────────────────────────────────────────────────────
  const handleReport = async () => {
    if (messages.length < 4) {
      setError("Have a longer conversation first (at least 2 exchanges)");
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
    setInputText("");
    createSession(mode);
  };

  const handleModeSelect = (m: Mode) => {
    setMode(m);
    setShowModeMenu(false);
    createSession(m);
  };

  const currentMode = MODES.find((m) => m.key === mode)!;
  const isDisabled = status !== "idle" || sessionLoading || !sessionId;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.container}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => setShowModeMenu(true)}
            style={[styles.modeBadge, { borderColor: `${currentMode.color}55`, backgroundColor: `${currentMode.color}18` }]}
          >
            <Text style={[styles.modeBadgeText, { color: currentMode.color }]}>
              {currentMode.icon} {currentMode.label} ▾
            </Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={handleNewTopic} style={styles.iconBtn}>
              <Text style={styles.iconBtnText}>🔄</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReport}
              style={[styles.iconBtn, (reportLoading || messages.length < 4) && { opacity: 0.4 }]}
              disabled={reportLoading || messages.length < 4}
            >
              {reportLoading
                ? <ActivityIndicator color="#888" size="small" />
                : <Text style={styles.iconBtnText}>📊</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={async () => { Speech.stop(); await logout(); router.replace("/(auth)/login"); }}
              style={styles.iconBtn}
            >
              <Text style={styles.iconBtnText}>🚪</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Status Indicator ── */}
        {(status !== "idle" || sessionLoading) && (
          <View style={styles.statusBar}>
            <ActivityIndicator color="#6366f1" size="small" />
            <Text style={styles.statusBarText}>
              {sessionLoading ? "Starting session..." : status === "thinking" ? "Echo is thinking..." : "Echo is speaking..."}
            </Text>
          </View>
        )}

        {/* ── Messages ── */}
        <ScrollView
          ref={scrollRef}
          style={styles.messageArea}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        >
          {messages.length === 0 && !sessionLoading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎙️</Text>
              <Text style={styles.emptyTitle}>Ready to practice!</Text>
              <Text style={styles.emptySubtitle}>
                Type your message below and tap Send.{"\n"}Echo will reply and read it aloud.
              </Text>
            </View>
          )}
          {messages.map((msg, i) => (
            <View key={i} style={{ alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              {msg.role === "assistant" && <Text style={styles.senderLabel}>Echo</Text>}
              <View style={msg.role === "user" ? styles.bubbleUser : styles.bubbleAI}>
                <Text style={styles.bubbleText}>{msg.content}</Text>
              </View>
            </View>
          ))}
          {status === "thinking" && (
            <View style={{ alignItems: "flex-start" }}>
              <Text style={styles.senderLabel}>Echo</Text>
              <View style={[styles.bubbleAI, { paddingVertical: 14 }]}>
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

        {/* ── Input ── */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your message in English..."
            placeholderTextColor="#444"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isDisabled}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isDisabled) && { opacity: 0.4 }]}
            onPress={sendMessage}
            disabled={!inputText.trim() || isDisabled}
          >
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>

        {/* ── Mode Menu Modal ── */}
        <Modal transparent visible={showModeMenu} animationType="slide" onRequestClose={() => setShowModeMenu(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowModeMenu(false)}>
            <View style={styles.modeSheet}>
              <Text style={styles.modeSheetTitle}>Select Practice Mode</Text>
              {MODES.map((m) => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.modeOption, mode === m.key && { backgroundColor: `${m.color}18`, borderColor: `${m.color}55` }]}
                  onPress={() => handleModeSelect(m.key)}
                >
                  <Text style={styles.modeOptionIcon}>{m.icon}</Text>
                  <View>
                    <Text style={[styles.modeOptionLabel, mode === m.key && { color: m.color }]}>{m.label}</Text>
                    <Text style={styles.modeOptionDesc}>
                      {m.key === "ielts" ? "IELTS examiner-style feedback"
                        : m.key === "daily" ? "Casual everyday conversation"
                        : "Professional interview practice"}
                    </Text>
                  </View>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f1117" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: "#1e2130",
  },
  modeBadge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  modeBadgeText: { fontWeight: "700", fontSize: 13 },
  headerRight: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8, borderRadius: 10 },
  iconBtnText: { fontSize: 18 },
  statusBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#1a1d2e",
  },
  statusBarText: { color: "#888", fontSize: 13 },
  messageArea: { flex: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyIcon: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: "#fff" },
  emptySubtitle: { fontSize: 14, color: "#888", textAlign: "center", lineHeight: 22 },
  senderLabel: { fontSize: 11, color: "#666", marginBottom: 4, paddingLeft: 6 },
  bubbleUser: {
    backgroundColor: "#6366f1", borderRadius: 18, borderBottomRightRadius: 4,
    paddingHorizontal: 16, paddingVertical: 10, maxWidth: "80%",
  },
  bubbleAI: {
    backgroundColor: "#1e2130", borderRadius: 18, borderBottomLeftRadius: 4,
    paddingHorizontal: 16, paddingVertical: 10, maxWidth: "80%", minWidth: 48,
  },
  bubbleText: { color: "#fff", fontSize: 15, lineHeight: 22 },
  errorBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.12)", borderTopWidth: 1,
    borderTopColor: "rgba(239,68,68,0.25)", paddingHorizontal: 16, paddingVertical: 10,
    marginHorizontal: 12, borderRadius: 10, marginBottom: 6,
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },
  errorClose: { color: "#fca5a5", fontSize: 18, paddingLeft: 10 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: "#1e2130",
    paddingBottom: Platform.OS === "ios" ? 28 : 12,
  },
  textInput: {
    flex: 1, backgroundColor: "#1e2130", borderRadius: 20, borderWidth: 1,
    borderColor: "#2a2d3e", paddingHorizontal: 16, paddingVertical: 10,
    color: "#fff", fontSize: 15, maxHeight: 100, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "#6366f1",
    justifyContent: "center", alignItems: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 22, fontWeight: "700", lineHeight: 26 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modeSheet: { backgroundColor: "#1a1d2e", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modeSheetTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 16, textAlign: "center" },
  modeOption: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    borderRadius: 12, borderWidth: 1, borderColor: "#2a2d3e", marginBottom: 10,
  },
  modeOptionIcon: { fontSize: 24 },
  modeOptionLabel: { color: "#ccc", fontSize: 15, fontWeight: "600" },
  modeOptionDesc: { color: "#555", fontSize: 12, marginTop: 2 },
  reportOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  reportSheet: {
    backgroundColor: "#1a1d2e", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, maxHeight: "80%",
  },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  reportTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  reportClose: { color: "#888", fontSize: 22 },
  reportContent: { color: "#ccc", fontSize: 14, lineHeight: 22 },
});
