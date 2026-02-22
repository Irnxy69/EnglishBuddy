import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi } from "@/lib/api";

interface User {
  user_id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.login(email, password);
          localStorage.setItem("access_token", data.access_token);
          set({
            token: data.access_token,
            user: { user_id: data.user_id, email: data.email },
            isLoading: false,
          });
        } catch (err: any) {
          set({
            error: err.response?.data?.detail || "Login failed",
            isLoading: false,
          });
          throw err;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.register(email, password, name);
          localStorage.setItem("access_token", data.access_token);
          set({
            token: data.access_token,
            user: { user_id: data.user_id, email: data.email },
            isLoading: false,
          });
        } catch (err: any) {
          set({
            error: err.response?.data?.detail || "Registration failed",
            isLoading: false,
          });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem("access_token");
        set({ user: null, token: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);
