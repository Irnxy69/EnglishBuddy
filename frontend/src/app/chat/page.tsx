"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuthStore } from "@/store/authStore";
import { sessionApi, chatApi, speechApi, reportApi } from "@/lib/api";

// ── Browser native TTS (Web Speech API) ─────────────────────────────────────
function speakText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.95;
    utter.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Samantha") || v.name.includes("Karen") ||
          v.name.includes("Aria") || v.name.includes("Female") ||
          v.name.includes("Google US English"))
    ) || voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utter.voice = preferred;

    utter.onend = () => resolve();
    utter.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") resolve();
      else reject(new Error(e.error));
    };
    window.speechSynthesis.speak(utter);
  });
}

type Message = { role: "user" | "assistant"; content: string };
type Mode = "ielts" | "daily" | "interview";

const MODE_INFO: Record<Mode, { label: string; icon: string; color: string; desc: string }> = {
  ielts:     { label: "IELTS",     icon: "🎓", color: "#6366f1", desc: "IELTS speaking practice" },
  daily:     { label: "Daily",     icon: "☕", color: "#06b6d4", desc: "Casual English chat" },
  interview: { label: "Interview", icon: "💼", color: "#f59e0b", desc: "Job interview prep" },
};

type SessionItem = {
  id: string;
  mode: string;
  created_at: string;
  ended_at: string | null;
};

export default function ChatPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [mode, setMode] = useState<Mode>("ielts");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [report, setReport] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "recording" | "thinking" | "speaking">("idle");
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Text input
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Sidebar & history
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) router.replace("/login");
  }, [router]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Responsive: collapse sidebar on small screens
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    if (mq.matches) setSidebarOpen(false);
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Create session on mount / mode change
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await sessionApi.create(mode);
        setSessionId(data.session_id);
        setMessages([]);
        setReport(null);
        setShowReport(false);
      } catch {
        setError("Failed to start session. Is the backend running?");
      }
    };
    init();
  }, [mode]);

  // Load history
  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const { data } = await sessionApi.list();
      setSessions(data.sessions || []);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load a past session
  const loadSession = useCallback(async (sid: string) => {
    try {
      const { data } = await sessionApi.get(sid);
      const session = data.session;
      setSessionId(sid);
      setMode(session.mode as Mode);
      setMessages(
        (data.messages || []).map((m: any) => ({ role: m.role, content: m.content }))
      );
      if (data.report) {
        setReport(data.report.content);
      } else {
        setReport(null);
      }
      setShowReport(false);
      setShowHistory(false);
      if (window.innerWidth <= 768) setSidebarOpen(false);
    } catch {
      setError("Failed to load session.");
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setStatus("recording");
    } catch {
      setError("Microphone access denied. Please allow mic permissions.");
    }
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;

    recorder.onstop = async () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
      await processAudio(audioBlob);
    };
    recorder.stop();
  }, [sessionId, messages, mode]);

  const processAudio = async (audioBlob: Blob) => {
    if (!sessionId) return;
    setStatus("thinking");

    try {
      const { data: sttData } = await speechApi.transcribe(audioBlob);
      const userText = sttData.text;
      if (!userText.trim()) { setStatus("idle"); return; }

      const newMessages: Message[] = [...messages, { role: "user", content: userText }];
      setMessages(newMessages);

      const { data: chatData } = await chatApi.send(sessionId, userText, messages, mode);
      const aiReply = chatData.reply;
      const updatedMessages: Message[] = [...newMessages, { role: "assistant", content: aiReply }];
      setMessages(updatedMessages);

      setStatus("speaking");
      await speakText(aiReply);
      setStatus("idle");
    } catch (e: any) {
      if (e?.message?.includes("TTS") || e?.message?.includes("speech")) {
        console.warn("TTS warning (non-fatal):", e.message);
        setStatus("idle");
      } else {
        setError(e.response?.data?.detail || "Something went wrong. Please try again.");
        setStatus("idle");
      }
    }
  };

  // Send text message
  const sendTextMessage = async () => {
    const text = inputText.trim();
    if (!text || !sessionId || isSending) return;
    setInputText("");
    setIsSending(true);
    setError(null);

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);

    try {
      const { data: chatData } = await chatApi.send(sessionId, text, messages, mode);
      const aiReply = chatData.reply;
      const updatedMessages: Message[] = [...newMessages, { role: "assistant", content: aiReply }];
      setMessages(updatedMessages);

      setStatus("speaking");
      await speakText(aiReply);
      setStatus("idle");
    } catch (e: any) {
      if (e?.message?.includes("TTS") || e?.message?.includes("speech")) {
        console.warn("TTS warning (non-fatal):", e.message);
        setStatus("idle");
      } else {
        setError(e.response?.data?.detail || "Something went wrong. Please try again.");
        setMessages(messages);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateReport = async () => {
    if (messages.length < 4) { setError("Talk a bit more before generating a report!"); return; }
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

  const handleNewTopic = async () => {
    window.speechSynthesis?.cancel();
    setMessages([]);
    setReport(null);
    setShowReport(false);
    setError(null);
    setStatus("idle");
    setInputText("");
    try {
      const { data } = await sessionApi.create(mode);
      setSessionId(data.session_id);
    } catch { /**/ }
  };

  const modeColors = MODE_INFO[mode].color;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`glass sidebar ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
              <span className="gradient-text">EnglishBuddy</span>
            </div>
            <button
              className="btn-icon sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            {user?.email}
          </div>
        </div>

        {/* Mode selector */}
        <div style={{ marginBottom: "1.2rem" }}>
          <div className="sidebar-label">Practice Mode</div>
          {(Object.entries(MODE_INFO) as [Mode, typeof MODE_INFO[Mode]][]).map(([m, info]) => (
            <button
              key={m}
              onClick={() => { setMode(m); if (window.innerWidth <= 768) setSidebarOpen(false); }}
              className="mode-btn"
              style={{
                borderColor: mode === m ? `${info.color}55` : "transparent",
                background: mode === m ? `${info.color}15` : "transparent",
                color: mode === m ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: mode === m ? 600 : 400,
              }}
            >
              <span>{info.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div>{info.label}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 400 }}>{info.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <button className="btn-ghost sidebar-btn" onClick={handleNewTopic}>
            🔄 New Topic
          </button>
          <button
            className="btn-ghost sidebar-btn"
            onClick={handleGenerateReport}
            disabled={reportLoading || messages.length < 4}
          >
            {reportLoading ? <><div className="spinner" /> Analyzing...</> : "📊 Get Report"}
          </button>
          <button
            className="btn-ghost sidebar-btn"
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadHistory(); }}
          >
            📚 {showHistory ? "Hide History" : "History"}
          </button>
        </div>

        {/* History panel in sidebar */}
        {showHistory && (
          <div className="history-panel">
            {loadingHistory ? (
              <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)" }}>
                <div className="spinner" style={{ margin: "0 auto", borderTopColor: "var(--brand-400)", borderColor: "rgba(99,102,241,0.2)" }} />
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "1rem", color: "var(--text-muted)", fontSize: "0.82rem" }}>
                No past sessions yet.
              </div>
            ) : (
              sessions.slice(0, 15).map((s) => (
                <button
                  key={s.id}
                  className="history-item"
                  onClick={() => loadSession(s.id)}
                  style={{
                    background: sessionId === s.id ? "var(--bg-hover)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>{MODE_INFO[s.mode as Mode]?.icon || "💬"}</span>
                    <span style={{ fontWeight: 500 }}>{MODE_INFO[s.mode as Mode]?.label || s.mode}</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                    {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        <div style={{ marginTop: "auto", paddingTop: "1rem" }}>
          <button
            className="btn-ghost sidebar-btn"
            style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}
            onClick={() => { logout(); router.replace("/login"); }}
          >
            🚪 Log Out
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {/* Header */}
        <div className="chat-header">
          <button
            className="btn-icon hamburger-btn"
            onClick={() => setSidebarOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 4.5h16M2 10h16M2 15.5h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>

          <span className="mode-badge" style={{ borderColor: `${modeColors}55`, color: modeColors, background: `${modeColors}15` }}>
            {MODE_INFO[mode].icon} {MODE_INFO[mode].label} Mode
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
            {messages.length === 0 ? "Start your practice session" : `${Math.ceil(messages.length / 2)} turns`}
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {messages.length === 0 && (
            <div
              className="glass animate-fade-in"
              style={{ margin: "auto", textAlign: "center", padding: "2.5rem", maxWidth: 440 }}
            >
              <div style={{ fontSize: "3rem" }}>🎙️</div>
              <h2 style={{ margin: "1rem 0 0.5rem", fontSize: "1.2rem" }}>Ready to practice!</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: 0, lineHeight: 1.6 }}>
                Hold the mic button to speak, or type a message below.<br />
                Echo is here to help you improve your English.
              </p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "1.2rem", flexWrap: "wrap" }}>
                {["Tell me about yourself", "What's your hobby?", "Describe your hometown"].map((q) => (
                  <button
                    key={q}
                    className="suggestion-chip"
                    onClick={() => { setInputText(q); inputRef.current?.focus(); }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}
              className="animate-fade-in"
            >
              {msg.role === "assistant" && (
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem", paddingLeft: "0.5rem" }}>
                  Echo
                </div>
              )}
              <div className={msg.role === "user" ? "bubble-user" : "bubble-ai"}>
                {msg.role === "assistant" ? (
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "assistant" && (
                <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem", paddingLeft: "0.5rem" }}>
                  <button
                    className="msg-action-btn"
                    title="Replay speech"
                    onClick={() => speakText(msg.content)}
                  >
                    🔊
                  </button>
                  <button
                    className="msg-action-btn"
                    title="Copy text"
                    onClick={() => navigator.clipboard.writeText(msg.content)}
                  >
                    📋
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Thinking indicator */}
          {(status === "thinking" || isSending) && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }} className="animate-fade-in">
              <div className="bubble-ai" style={{ display: "flex", gap: "5px", alignItems: "center", padding: "0.9rem 1.1rem" }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "var(--brand-400)",
                      animation: `recordPulse 1.2s ease-in-out ${d}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error */}
        {error && (
          <div className="error-bar">
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
          </div>
        )}

        {/* Report panel */}
        {showReport && report && (
          <div className="glass animate-fade-in report-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <span style={{ fontWeight: 600 }}>📊 Your Assessment Report</span>
              <button onClick={() => setShowReport(false)} className="btn-ghost" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}>
                Close
              </button>
            </div>
            <div className="markdown-content" style={{ fontSize: "0.88rem" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Bottom input bar */}
        <div className="input-bar">
          {/* Status text */}
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.75rem", minWidth: 80 }}>
            {status === "idle" && !isSending && "Ready"}
            {status === "recording" && <span style={{ color: "#ef4444" }}>● Recording...</span>}
            {(status === "thinking" || isSending) && <span style={{ color: "var(--brand-400)" }}>Thinking...</span>}
            {status === "speaking" && <span style={{ color: "var(--green)" }}>Speaking...</span>}
          </div>

          {/* Record button */}
          <button
            className={`btn-record ${status === "recording" ? "recording" : ""}`}
            onMouseDown={status === "idle" && !isSending ? startRecording : undefined}
            onMouseUp={status === "recording" ? stopRecording : undefined}
            onTouchStart={status === "idle" && !isSending ? startRecording : undefined}
            onTouchEnd={status === "recording" ? stopRecording : undefined}
            disabled={status === "thinking" || status === "speaking" || isSending}
            title="Hold to record"
            style={{ width: 56, height: 56, flexShrink: 0 }}
          >
            {status === "recording" ? (
              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z" />
              </svg>
            )}
          </button>

          {/* Text input */}
          <div className="text-input-wrapper">
            <input
              ref={inputRef}
              className="input chat-input"
              type="text"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendTextMessage();
                }
              }}
              disabled={status === "recording" || status === "thinking" || status === "speaking" || isSending}
            />
            <button
              className="btn-send"
              onClick={sendTextMessage}
              disabled={!inputText.trim() || isSending || status !== "idle"}
              title="Send message"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
