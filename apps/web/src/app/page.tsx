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

type AuthMode = "login" | "register";

type AuthUser = {
  id: string;
  email: string;
};

type InvitationItem = {
  code: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  createdAt: string;
  isActive: boolean;
};

function resolveApiBase() {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();

  if (typeof window !== "undefined") {
    if (!configured) {
      return window.location.origin;
    }

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
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("demo@englishbuddy.ai");
  const [password, setPassword] = useState("123456");
  const [invitationCode, setInvitationCode] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingReply, setStreamingReply] = useState("");
  const [score, setScore] = useState<ConversationScore | null>(null);
  const [meta, setMeta] = useState<ReplyMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [liveConversationMode, setLiveConversationMode] = useState(false);
  const [isPlayingReply, setIsPlayingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inviteMaxUses, setInviteMaxUses] = useState("5");
  const [invites, setInvites] = useState<InvitationItem[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const manualCloseRef = useRef(false);
  const speechRecognitionRef = useRef<any>(null);
  const speechSynthesisVoicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const liveConversationModeRef = useRef(false);
  const isPlayingReplyRef = useRef(false);
  const sendingRef = useRef(false);

  const canSend = useMemo(
    () => Boolean(token && sessionId && text.trim() && wsReady && !sending),
    [token, sessionId, text, wsReady, sending]
  );

  const isAdmin = currentUser?.id === "u_1001";

  useEffect(() => {
    sendingRef.current = sending;
  }, [sending]);

  useEffect(() => {
    isPlayingReplyRef.current = isPlayingReply;
  }, [isPlayingReply]);

  function sendTextMessage(userText: string) {
    if (!sessionId || !token) {
      return;
    }

    const content = userText.trim();
    if (!content) {
      return;
    }

    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Connection is not ready");
      return;
    }

    setText("");
    setSending(true);
    setStreamingReply("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setError(null);

    socket.send(
      JSON.stringify({
        event: "message.send",
        sessionId,
        text: content
      })
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if ("speechSynthesis" in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          speechSynthesisVoicesRef.current = voices;
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event?.results?.[0]?.[0]?.transcript;
      if (!transcript) {
        return;
      }

      if (liveConversationModeRef.current) {
        sendTextMessage(transcript);
      } else {
        setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
    };

    recognition.onstart = () => setVoiceListening(true);
    recognition.onend = () => {
      setVoiceListening(false);
      if (liveConversationModeRef.current && !isPlayingReplyRef.current && !sendingRef.current) {
        setTimeout(() => {
          speechRecognitionRef.current?.start();
        }, 300);
      }
    };
    recognition.onerror = () => setVoiceListening(false);

    speechRecognitionRef.current = recognition;
    setVoiceInputSupported(true);

    return () => {
      liveConversationModeRef.current = false;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [sessionId, token]);

  function startVoiceInput() {
    const recognition = speechRecognitionRef.current;
    if (!recognition) {
      setError("当前浏览器不支持语音输入");
      return;
    }
    setError(null);
    recognition.start();
  }

  function speakText(utterance: string, autoStartListening = false) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError("当前浏览器不支持语音朗读");
      return;
    }

    const speech = new SpeechSynthesisUtterance(utterance);
    speech.lang = "en-US";
    speech.pitch = 1.0;
    speech.rate = 0.95;
    speech.volume = 1.0;

    const voices = speechSynthesisVoicesRef.current.length > 0
      ? speechSynthesisVoicesRef.current
      : window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      const preferredVoice =
        voices.find((v) => v.name.includes("Google US English Female")) ||
        voices.find((v) => v.name.includes("Google UK English Female")) ||
        voices.find((v) => v.lang.startsWith("en") && v.name.includes("Female")) ||
        voices.find((v) => v.lang.startsWith("en-US")) ||
        voices.find((v) => v.lang.startsWith("en"));

      if (preferredVoice) {
        speech.voice = preferredVoice;
      }
    }

    window.speechSynthesis.cancel();
    setIsPlayingReply(true);

    speech.onend = () => {
      setIsPlayingReply(false);
      if (autoStartListening && liveConversationModeRef.current && speechRecognitionRef.current) {
        setTimeout(() => {
          speechRecognitionRef.current?.start();
        }, 400);
      }
    };

    speech.onerror = () => {
      setIsPlayingReply(false);
    };

    window.speechSynthesis.speak(speech);
  }

  async function createSession(accessToken: string) {
    const sessionRes = await fetch(`${API_BASE}/api/v1/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ scenarioId: "scn_coffee" })
    });

    const session = await sessionRes.json();
    if (!sessionRes.ok) {
      throw new Error(session.message ?? "创建会话失败");
    }

    setSessionId(session.id);
  }

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsReady(false);
      return;
    }

    manualCloseRef.current = false;

    const connect = () => {
      if (manualCloseRef.current) {
        return;
      }

      setConnecting(true);
      const socket = new WebSocket(`${WS_BASE}/api/v1/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setConnecting(false);
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
            if (liveConversationModeRef.current && doneMessage.role === "assistant") {
              speakText(doneMessage.content, true);
            }
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
          setError(typeof payload.message === "string" ? payload.message : "连接异常，请重试");
          setSending(false);
        }
      };

      socket.onerror = () => {
        setConnecting(false);
        setError("WebSocket 连接失败，正在重连...");
      };

      socket.onclose = () => {
        setConnecting(false);
        setWsReady(false);
        if (manualCloseRef.current) {
          return;
        }
        const attempt = reconnectAttemptRef.current;
        const waitMs = Math.min(6000, 400 * 2 ** attempt);
        reconnectAttemptRef.current = attempt + 1;
        reconnectTimerRef.current = setTimeout(connect, waitMs);
      };
    };

    connect();

    return () => {
      manualCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
      setWsReady(false);
    };
  }, [token]);

  async function loadInvitations(authToken: string) {
    if (!isAdmin) {
      return;
    }

    setInviteLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/invitations/list`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "加载邀请码失败");
      }
      setInvites(data.codes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载邀请码失败");
    } finally {
      setInviteLoading(false);
    }
  }

  async function generateInvitation() {
    if (!token) {
      return;
    }

    const maxUses = Number(inviteMaxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      setError("使用次数必须是大于0的整数");
      return;
    }

    setInviteLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/invitations/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ maxUses })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "生成邀请码失败");
      }
      await loadInvitations(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成邀请码失败");
    } finally {
      setInviteLoading(false);
    }
  }

  async function disableInvitation(code: string) {
    if (!token) {
      return;
    }

    setInviteLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/invitations/disable`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? "禁用邀请码失败");
      }
      await loadInvitations(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "禁用邀请码失败");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleAuthSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const endpoint = authMode === "login" ? "login" : "register";
      const body = authMode === "register"
        ? { email, password, invitationCode: invitationCode.trim().toUpperCase() }
        : { email, password };

      const res = await fetch(`${API_BASE}/api/v1/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? (authMode === "login" ? "登录失败" : "注册失败"));
      }

      setMessages([]);
      setScore(null);
      setMeta(null);
      setToken(data.accessToken);
      setCurrentUser(data.user ?? null);
      await createSession(data.accessToken);
      if ((data.user?.id ?? "") === "u_1001") {
        await loadInvitations(data.accessToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    manualCloseRef.current = true;
    wsRef.current?.close();
    wsRef.current = null;
    liveConversationModeRef.current = false;
    setLiveConversationMode(false);
    setToken(null);
    setCurrentUser(null);
    setSessionId(null);
    setMessages([]);
    setStreamingReply("");
    setScore(null);
    setMeta(null);
    setWsReady(false);
    setConnecting(false);
    setError(null);
    setInvitationCode("");
    setInvites([]);
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!canSend) {
      return;
    }
    sendTextMessage(text);
  }

  if (!token) {
    return (
      <main className="page pageAuth">
        <section className="hero">
          <p className="eyebrow">EnglishBuddy MVP</p>
          <h1>Practice real English conversations with AI</h1>
          <p className="sub">先登录或注册，再直接进入对话练习。</p>
        </section>

        <section className="authCard">
          <div className="authModeSwitch">
            <button type="button" className={authMode === "login" ? "secondary active" : "secondary"} onClick={() => setAuthMode("login")}>登录</button>
            <button type="button" className={authMode === "register" ? "secondary active" : "secondary"} onClick={() => setAuthMode("register")}>注册</button>
          </div>

          <form onSubmit={handleAuthSubmit} className="authForm stacked">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" type="email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码（至少6位）" type="password" />
            {authMode === "register" ? (
              <input
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value)}
                placeholder="邀请码（必填）"
                type="text"
              />
            ) : null}
            <button disabled={loading || (authMode === "register" && !invitationCode.trim())}>
              {loading ? "处理中..." : authMode === "login" ? "登录并开始" : "注册并开始"}
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="page pageChat">
      <section className="chatHeader">
        <div>
          <p className="eyebrow">EnglishBuddy MVP</p>
          <h1>英语对话练习</h1>
        </div>
        <div className="sessionControls">
          <p className="status">连接状态：{wsReady ? "在线" : connecting ? "重连中" : "离线"}</p>
          <button type="button" className="secondary" onClick={handleLogout}>退出登录</button>
        </div>
      </section>

      {isAdmin ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>邀请码管理</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              value={inviteMaxUses}
              onChange={(e) => setInviteMaxUses(e.target.value)}
              placeholder="每个邀请码可使用次数"
              type="number"
              min={1}
              style={{ maxWidth: 220 }}
            />
            <button type="button" onClick={generateInvitation} disabled={inviteLoading}>生成邀请码</button>
            <button type="button" className="secondary" onClick={() => token && loadInvitations(token)} disabled={inviteLoading}>刷新列表</button>
          </div>
          <div style={{ marginTop: 12, overflowX: "auto" }}>
            {invites.length === 0 ? <p className="placeholder">暂无邀请码</p> : null}
            {invites.map((item) => (
              <div key={item.code} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.6fr 0.6fr 0.8fr 0.7fr", gap: 8, padding: "8px 0", borderBottom: "1px solid #e6eef7", alignItems: "center" }}>
                <strong>{item.code}</strong>
                <span>{item.usedCount}/{item.maxUses}</span>
                <span>{item.remainingUses}</span>
                <span>{item.isActive ? "可用" : "已禁用"}</span>
                <button type="button" className="tiny" disabled={!item.isActive || inviteLoading} onClick={() => disableInvitation(item.code)}>禁用</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="panel messenger">
        <div className="messages">
          {messages.length === 0 ? <p className="placeholder">还没有消息，先发一句英语试试。</p> : null}
          {messages.map((msg, index) => (
            <article key={`${msg.role}-${index}`} className={msg.role === "user" ? "msg user" : "msg assistant"}>
              <span>{msg.role === "user" ? "你" : "教练"}</span>
              <p>{msg.content}</p>
              {msg.role === "assistant" ? (
                <button type="button" className="tiny" onClick={() => speakText(msg.content, liveConversationMode)}>朗读</button>
              ) : null}
            </article>
          ))}
          {streamingReply ? (
            <article className="msg assistant">
              <span>教练</span>
              <p>{streamingReply}</p>
            </article>
          ) : null}
        </div>

        <form onSubmit={sendMessage} className="sendForm">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) {
                  sendTextMessage(text);
                }
              }
            }}
            placeholder="请输入你要说的英语..."
            disabled={!sessionId || liveConversationMode}
          />
          <button
            type="button"
            className={liveConversationMode ? "secondary active" : "secondary"}
            onClick={() => {
              if (!liveConversationMode) {
                liveConversationModeRef.current = true;
                setLiveConversationMode(true);
                setText("");
                speechRecognitionRef.current?.start();
              } else {
                liveConversationModeRef.current = false;
                setLiveConversationMode(false);
                speechRecognitionRef.current?.abort();
                if (typeof window !== "undefined" && "speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                }
              }
            }}
            disabled={!voiceInputSupported}
          >
            {liveConversationMode ? (voiceListening ? "听你说..." : isPlayingReply ? "播放中..." : "实时对话中") : "开启实时对话"}
          </button>
          <button type="button" className="secondary" onClick={startVoiceInput} disabled={!voiceInputSupported || voiceListening || liveConversationMode}>
            {voiceListening ? "收音中..." : "语音输入"}
          </button>
          <button disabled={!canSend || liveConversationMode}>{sending ? "发送中..." : "发送"}</button>
        </form>

        {score ? (
          <div className="scoreGrid">
            <p>发音：{score.pronunciation}</p>
            <p>语法：{score.grammar}</p>
            <p>词汇：{score.vocabulary}</p>
            <p>流利度：{score.fluency}</p>
          </div>
        ) : null}

        {meta ? <p className="meta">模型：{meta.provider} / {meta.model}（{meta.routeReason}）</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
    </main>
  );
}
