"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ConversationScore = {
  pronunciation: number;
  grammar: number;
  vocabulary: number;
  fluency: number;
};

type ReplyMeta = {
  provider: "deepseek" | "qwen" | "mock";
  model: string;
  routeReason: string;
};

function resolveApiBase() {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();

  if (typeof window !== "undefined") {
    if (!configured) {
      return window.location.origin;
    }

    // Avoid mixed-content failures: if site is HTTPS, force API base to HTTPS.
    if (window.location.protocol === "https:" && configured.startsWith("http://")) {
      return configured.replace("http://", "https://");
    }

    return configured;
  }

  return configured || "http://127.0.0.1:8001";
}

function resolveWsBase(apiBase: string) {
  const configured = (process.env.NEXT_PUBLIC_WS_BASE_URL ?? "").trim();
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined") {
    const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    if (!isLocalHost) {
      return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
    }
  }

  return apiBase.replace("http://", "ws://").replace("https://", "wss://");
}

const API_BASE = resolveApiBase();
const WS_BASE = resolveWsBase(API_BASE);

export default function HomePage() {
  const [email, setEmail] = useState("demo@englishbuddy.ai");
  const [password, setPassword] = useState("123456");
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingReply, setStreamingReply] = useState("");
  const [score, setScore] = useState<ConversationScore | null>(null);
  const [meta, setMeta] = useState<ReplyMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const canSend = useMemo(() => Boolean(token && sessionId && text.trim() && wsReady && !sending), [token, sessionId, text, wsReady, sending]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const socket = new WebSocket(`${WS_BASE}/api/v1/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsReady(true);
      setError(null);
    };

    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        event: string;
        chunk?: string;
        message?: Message | string;
        score?: ConversationScore;
        meta?: ReplyMeta;
      };

      if (payload.event === "reply.chunk") {
        setStreamingReply((prev) => prev + (payload.chunk ?? ""));
        return;
      }

      if (payload.event === "reply.done") {
        const doneMessage = payload.message;
        if (doneMessage && typeof doneMessage !== "string") {
          setMessages((prev) => [...prev, doneMessage]);
        }
        setStreamingReply("");
        if (payload.meta) {
          setMeta(payload.meta);
        }
        setSending(false);
        return;
      }

      if (payload.event === "score.result") {
        if (payload.score) {
          setScore(payload.score);
        }
        return;
      }

      if (payload.event === "error") {
        setError(typeof payload.message === "string" ? payload.message : "WebSocket error");
        setSending(false);
      }
    };

    socket.onerror = () => {
      setError("WebSocket connection failed");
      setSending(false);
    };

    socket.onclose = () => {
      setWsReady(false);
    };

    return () => {
      socket.close();
      wsRef.current = null;
      setWsReady(false);
    };
  }, [token]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Login failed");
      setToken(data.accessToken);

      const sessionRes = await fetch(`${API_BASE}/api/v1/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.accessToken}`
        },
        body: JSON.stringify({ scenarioId: "scn_coffee" })
      });
      const session = await sessionRes.json();
      if (!sessionRes.ok) throw new Error(session.message ?? "Create session failed");
      setSessionId(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;

    const userText = text.trim();
    setText("");
    setSending(true);
    setStreamingReply("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setError(null);

    try {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        throw new Error("Connection is not ready");
      }

      socket.send(
        JSON.stringify({
          event: "message.send",
          sessionId,
          text: userText
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSending(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">EnglishBuddy MVP</p>
        <h1>Practice real English conversations with AI</h1>
        <p className="sub">Fast API-first prototype based on your project spec. Login to start a coffee-shop roleplay now.</p>
      </section>

      <section className="panel">
        <form onSubmit={login} className="authForm">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
          <button disabled={loading}>{loading ? "Preparing..." : token ? "Connected" : "Login & Start Session"}</button>
        </form>

        <p className="status">Socket: {wsReady ? "online" : "offline"}</p>

        <div className="chatBox">
          <div className="messages">
            {messages.length === 0 ? <p className="placeholder">No messages yet. Send your first sentence.</p> : null}
            {messages.map((msg, index) => (
              <article key={`${msg.role}-${index}`} className={msg.role === "user" ? "msg user" : "msg assistant"}>
                <span>{msg.role === "user" ? "You" : "Coach"}</span>
                <p>{msg.content}</p>
              </article>
            ))}
            {streamingReply ? (
              <article className="msg assistant">
                <span>Coach</span>
                <p>{streamingReply}</p>
              </article>
            ) : null}
          </div>
          <form onSubmit={sendMessage} className="sendForm">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your answer in English..."
              disabled={!sessionId}
            />
            <button disabled={!canSend}>{sending ? "Streaming..." : "Send"}</button>
          </form>
        </div>

        {score ? (
          <div className="scoreGrid">
            <p>Pronunciation: {score.pronunciation}</p>
            <p>Grammar: {score.grammar}</p>
            <p>Vocabulary: {score.vocabulary}</p>
            <p>Fluency: {score.fluency}</p>
          </div>
        ) : null}

        {meta ? <p className="meta">Model: {meta.provider} / {meta.model} ({meta.routeReason})</p> : null}

        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
