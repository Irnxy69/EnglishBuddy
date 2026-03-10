"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) router.replace("/chat");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        gap: "2rem",
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: "center", maxWidth: 600 }}>
        <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🎓</div>
        <h1
          style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 700, lineHeight: 1.15, margin: 0 }}
        >
          <span className="gradient-text">EnglishBuddy</span>
        </h1>
        <p style={{ fontSize: "1.15rem", color: "var(--text-secondary)", marginTop: "1rem", lineHeight: 1.6 }}>
          Practice <strong style={{ color: "var(--text-primary)" }}>IELTS Speaking</strong>, daily
          English &amp; job interviews with your AI partner <strong style={{ color: "var(--brand-400)" }}>Echo</strong>.
          Get instant feedback and band score analysis.
        </p>
      </div>

      {/* Feature cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
          width: "100%",
          maxWidth: 600,
        }}
      >
        {[
          { icon: "🎙️", title: "Voice Practice", desc: "Speak naturally with AI" },
          { icon: "⌨️", title: "Text Chat", desc: "Type or speak, your choice" },
          { icon: "📊", title: "Band Score", desc: "Instant IELTS assessment" },
          { icon: "📝", title: "Smart Feedback", desc: "Grammar & vocab upgrade" },
        ].map((f) => (
          <div key={f.title} className="glass" style={{ padding: "1.2rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.8rem" }}>{f.icon}</div>
            <div style={{ fontWeight: 600, marginTop: "0.5rem" }}>{f.title}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {f.desc}
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/register" className="btn-primary" style={{ fontSize: "1rem", padding: "0.8rem 2rem" }}>
          Get Started Free →
        </Link>
        <Link href="/login" className="btn-ghost" style={{ fontSize: "1rem", padding: "0.8rem 1.6rem" }}>
          Log In
        </Link>
      </div>

      <p style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
        No credit card required • Free to start
      </p>
    </main>
  );
}
