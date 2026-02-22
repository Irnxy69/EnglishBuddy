"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuthStore } from "@/store/authStore";
import { sessionApi, chatApi, speechApi, reportApi } from "@/lib/api";

// ── 浏览器原生 TTS (Web Speech API) ─────────────────────────────────────────
// 原因：edge-tts 依赖微软 WebSocket 服务器，在中国大陆网络下会 'Server disconnected'
// Web Speech API 完全在本地运行，零网络请求，兼容 Chrome / Edge / Safari
function speakText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) { resolve(); return; }
    window.speechSynthesis.cancel(); // 停止之前的朗读

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.rate = 0.95;
    utter.pitch = 1.0;

    // 优先选择英文女声
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
      // 'interrupted' 是正常的（用户开始新录音时），不算错误
      if (e.error === "interrupted" || e.error === "canceled") resolve();
      else reject(new Error(e.error));
    };
    window.speechSynthesis.speak(utter);
  });
}

type Message = { role: "user" | "assistant"; content: string };
type Mode = "ielts" | "daily" | "interview";

const MODE_INFO: Record<Mode, { label: string; icon: string; color: string }> = {
  ielts:     { label: "IELTS",     icon: "🎓", color: "#6366f1" },
  daily:     { label: "Daily",     icon: "☕", color: "#06b6d4" },
  interview: { label: "Interview", icon: "💼", color: "#f59e0b" },
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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) router.replace("/login");
  }, [router]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      // 1. STT
      const { data: sttData } = await speechApi.transcribe(audioBlob);
      const userText = sttData.text;
      if (!userText.trim()) { setStatus("idle"); return; }

      const newMessages: Message[] = [...messages, { role: "user", content: userText }];
      setMessages(newMessages);

      // 2. LLM
      const { data: chatData } = await chatApi.send(sessionId, userText, messages, mode);
      const aiReply = chatData.reply;
      const updatedMessages: Message[] = [...newMessages, { role: "assistant", content: aiReply }];
      setMessages(updatedMessages);

      // 3. TTS — 使用浏览器原生 Web Speech API（不依赖网络，不受 GFW 影响）
      setStatus("speaking");
      await speakText(aiReply);
      setStatus("idle");
    } catch (e: any) {
      // TTS 报错不影响对话本身，只记录日志，不显示给用户
      if (e?.message?.includes("TTS") || e?.message?.includes("speech")) {
        console.warn("TTS warning (non-fatal):", e.message);
        setStatus("idle");
      } else {
        setError(e.response?.data?.detail || "Something went wrong. Please try again.");
        setStatus("idle");
      }
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
    window.speechSynthesis?.cancel(); // 停止当前朗读
    setMessages([]);
    setReport(null);
    setShowReport(false);
    setError(null);
    setStatus("idle");
    try {
      const { data } = await sessionApi.create(mode);
      setSessionId(data.session_id);
    } catch { /**/ }
  };

  const modeColors = MODE_INFO[mode].color;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>

      {/* Sidebar */}
      <aside
        className="glass"
        style={{
          width: 240,
          minWidth: 240,
          display: "flex",
          flexDirection: "column",
          padding: "1.5rem 1.2rem",
          borderRadius: 0,
          borderTop: "none",
          borderBottom: "none",
          borderLeft: "none",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            <span className="gradient-text">EnglishBuddy</span>
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            {user?.email}
          </div>
        </div>

        {/* Mode selector */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Practice Mode
          </div>
          {(Object.entries(MODE_INFO) as [Mode, typeof MODE_INFO[Mode]][]).map(([m, info]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                width: "100%",
                padding: "0.6rem 0.8rem",
                borderRadius: 8,
                border: "1px solid",
                borderColor: mode === m ? `${info.color}55` : "transparent",
                background: mode === m ? `${info.color}15` : "transparent",
                color: mode === m ? "var(--text-primary)" : "var(--text-secondary)",
                cursor: "pointer",
                fontSize: "0.88rem",
                fontWeight: mode === m ? 600 : 400,
                marginBottom: "0.3rem",
                transition: "all 0.15s",
                textAlign: "left",
              }}
            >
              <span>{info.icon}</span>
              {info.label}
            </button>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button className="btn-ghost" style={{ width: "100%", justifyContent: "flex-start" }} onClick={handleNewTopic}>
            🔄 New Topic
          </button>
          <button
            className="btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start" }}
            onClick={handleGenerateReport}
            disabled={reportLoading || messages.length < 4}
          >
            {reportLoading ? <><div className="spinner" /> Analyzing...</> : "📊 Get Report"}
          </button>
        </div>

        <div style={{ marginTop: "auto" }}>
          <button
            className="btn-ghost"
            style={{ width: "100%", justifyContent: "flex-start", color: "var(--text-muted)", fontSize: "0.82rem" }}
            onClick={() => { logout(); router.replace("/login"); }}
          >
            🚪 Log Out
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <span className="mode-badge" style={{ borderColor: `${modeColors}55`, color: modeColors, background: `${modeColors}15` }}>
            {MODE_INFO[mode].icon} {MODE_INFO[mode].label} Mode
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
            {messages.length === 0 ? "Start speaking to begin your practice session" : `${Math.ceil(messages.length / 2)} turns`}
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {messages.length === 0 && (
            <div
              className="glass animate-fade-in"
              style={{ margin: "auto", textAlign: "center", padding: "2.5rem", maxWidth: 400 }}
            >
              <div style={{ fontSize: "3rem" }}>🎙️</div>
              <h2 style={{ margin: "1rem 0 0.5rem", fontSize: "1.2rem" }}>Ready to practice!</h2>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", margin: 0, lineHeight: 1.6 }}>
                Hold the button below and speak. Echo is listening.
              </p>
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
                {msg.content}
              </div>
            </div>
          ))}

          {/* Status indicators */}
          {status === "thinking" && (
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
          <div
            style={{
              margin: "0 1.5rem 0.5rem",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
              borderRadius: 8,
              padding: "0.6rem 1rem",
              fontSize: "0.85rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {error}
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: "#fca5a5", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
          </div>
        )}

        {/* Report panel */}
        {showReport && report && (
          <div
            className="glass animate-fade-in"
            style={{ margin: "0 1.5rem 0.5rem", padding: "1.2rem 1.5rem", maxHeight: 280, overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
              <span style={{ fontWeight: 600 }}>📊 Your Assessment Report</span>
              <button onClick={() => setShowReport(false)} className="btn-ghost" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}>
                Close
              </button>
            </div>
            <div style={{ fontSize: "0.88rem" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Record button bar */}
        <div
          style={{
            padding: "1.2rem 1.5rem",
            borderTop: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
          }}
        >
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem", minWidth: 100 }}>
            {status === "idle" && "Hold to speak"}
            {status === "recording" && <span style={{ color: "#ef4444" }}>● Recording...</span>}
            {status === "thinking" && <span style={{ color: "var(--brand-400)" }}>Echo is thinking...</span>}
            {status === "speaking" && <span style={{ color: "var(--green)" }}>Echo is speaking...</span>}
          </div>

          <button
            className={`btn-record ${status === "recording" ? "recording" : ""}`}
            onMouseDown={status === "idle" ? startRecording : undefined}
            onMouseUp={status === "recording" ? stopRecording : undefined}
            onTouchStart={status === "idle" ? startRecording : undefined}
            onTouchEnd={status === "recording" ? stopRecording : undefined}
            disabled={status === "thinking" || status === "speaking"}
            title="Hold to record"
          >
            {status === "recording" ? (
              <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z" />
              </svg>
            )}
          </button>

          <div style={{ minWidth: 100 }} />
        </div>
      </main>
    </div>
  );
}
