"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { login, register, isLoading, error, clearError, user } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (user) router.replace("/chat");
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      router.replace("/chat");
    } catch {
      // error handled in store
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div className="glass animate-fade-in" style={{ width: "100%", maxWidth: 420, padding: "2.5rem" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "2.5rem" }}>🎓</div>
          <h1 style={{ margin: "0.5rem 0 0.25rem", fontSize: "1.6rem", fontWeight: 700 }}>
            <span className="gradient-text">EnglishBuddy</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", margin: 0 }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        {/* Tab toggle */}
        <div
          style={{
            display: "flex",
            background: "var(--bg-base)",
            borderRadius: 10,
            padding: "3px",
            marginBottom: "1.5rem",
          }}
        >
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); clearError(); }}
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.88rem",
                transition: "all 0.2s",
                background: mode === m ? "var(--brand-600)" : "transparent",
                color: mode === m ? "white" : "var(--text-secondary)",
              }}
            >
              {m === "login" ? "Log In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {mode === "register" && (
            <div>
              <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.3rem", display: "block" }}>
                Name (optional)
              </label>
              <input
                className="input"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.3rem", display: "block" }}>
              Email
            </label>
            <input
              className="input"
              type="email"
              placeholder="you@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "0.3rem", display: "block" }}>
              Password
            </label>
            <input
              className="input"
              type="password"
              placeholder="Min 8 characters"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.12)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#fca5a5",
                borderRadius: 8,
                padding: "0.6rem 0.9rem",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading}
            style={{ marginTop: "0.3rem", width: "100%", padding: "0.8rem" }}
          >
            {isLoading ? (
              <><div className="spinner" /> {mode === "login" ? "Logging in..." : "Creating account..."}</>
            ) : (
              mode === "login" ? "Log In →" : "Create Account →"
            )}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.82rem", color: "var(--text-muted)" }}>
          <Link href="/" style={{ color: "var(--brand-400)", textDecoration: "none" }}>
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
