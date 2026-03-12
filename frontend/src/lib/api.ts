import axios from "axios";

const LOCAL_API_URL = "http://localhost:8000";
const REMOTE_API_URL = "https://englishbuddy.top";

const API_URL = process.env.NEXT_PUBLIC_API_URL || LOCAL_API_URL;
const API_FALLBACK_URL =
  process.env.NEXT_PUBLIC_API_FALLBACK_URL || REMOTE_API_URL;

const shouldFallbackToRemote =
  !process.env.NEXT_PUBLIC_API_URL && API_URL === LOCAL_API_URL;

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// 自动附加 JWT Token
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// 401 时自动跳转登录
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      window.location.href = "/login";
    }

    const originalRequest = error.config;
    const isNetworkError = !error.response;
    const canRetryFallback =
      shouldFallbackToRemote &&
      isNetworkError &&
      originalRequest &&
      !originalRequest.__retriedWithFallback;

    if (canRetryFallback) {
      originalRequest.__retriedWithFallback = true;
      originalRequest.baseURL = API_FALLBACK_URL;
      return api.request(originalRequest);
    }

    return Promise.reject(error);
  },
);

// ── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string, name?: string) =>
    api.post("/api/auth/register", { email, password, name }),
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  me: () => api.get("/api/auth/me"),
};

// ── Session ──────────────────────────────────────────────────────────────────

export const sessionApi = {
  create: (mode: string = "ielts") => api.post(`/api/sessions?mode=${mode}`),
  list: () => api.get("/api/sessions"),
  get: (sessionId: string) => api.get(`/api/sessions/${sessionId}`),
  end: (sessionId: string) => api.patch(`/api/sessions/${sessionId}/end`),
};

// ── Speech ───────────────────────────────────────────────────────────────────

export const speechApi = {
  transcribe: (audioBlob: Blob, filename: string = "audio.webm") => {
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    return api.post<{ text: string; language: string }>(
      "/api/transcribe",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
  },
  tts: async (text: string, voice?: string): Promise<Blob> => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;
    const requestOptions: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, voice }),
    };

    try {
      const response = await fetch(`${API_URL}/api/tts`, requestOptions);
      if (!response.ok) throw new Error("TTS failed");
      return response.blob();
    } catch {
      if (!shouldFallbackToRemote) {
        throw new Error("TTS failed");
      }
      const fallbackResponse = await fetch(
        `${API_FALLBACK_URL}/api/tts`,
        requestOptions,
      );
      if (!fallbackResponse.ok) throw new Error("TTS failed");
      return fallbackResponse.blob();
    }
  },
};

// ── Chat & Report ─────────────────────────────────────────────────────────────

export const chatApi = {
  send: (
    sessionId: string,
    userText: string,
    history: { role: string; content: string }[],
    mode: string = "ielts",
  ) =>
    api.post<{ reply: string; session_id: string }>("/api/chat", {
      session_id: sessionId,
      user_text: userText,
      history,
      mode,
    }),
};

export const reportApi = {
  generate: (sessionId: string, history: { role: string; content: string }[]) =>
    api.post<{
      session_id: string;
      content: string;
      band_score: number | null;
    }>("/api/report/generate", { session_id: sessionId, history }),
};

export default api;
