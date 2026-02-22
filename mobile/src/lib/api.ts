import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

const API_URL = "https://englishbuddy.top";

// ── Axios 实例 ───────────────────────────────────────────────────────────────
export const api = axios.create({ baseURL: API_URL });

// 请求拦截器：自动附加 JWT Token
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── API 方法 ─────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post("/api/auth/register", { email, password, name }),
};

export const sessionApi = {
  create: (mode: string) => api.post(`/api/sessions?mode=${mode}`),
  list: () => api.get("/api/sessions"),
};

export const chatApi = {
  send: (
    sessionId: string,
    message: string,
    history: { role: string; content: string }[],
    mode: string
  ) =>
    api.post("/api/chat", {
      session_id: sessionId,
      message,
      history,
      mode,
    }),
};

export const reportApi = {
  generate: (
    sessionId: string,
    messages: { role: string; content: string }[]
  ) => api.post("/api/report/generate", { session_id: sessionId, messages }),
};
