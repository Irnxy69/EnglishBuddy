-- =============================================
-- EnglishBuddy Database Schema (Supabase / PostgreSQL)
-- 在 Supabase SQL Editor 中运行此文件以初始化数据库
-- =============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. 用户表 ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. 练习会话表 ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'ielts', -- 'ielts' | 'daily' | 'interview'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ── 3. 消息表 ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    audio_url TEXT, -- 可选：用户录音的存储路径
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

-- ── 4. 评估报告表 ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- Markdown 格式报告
    band_score NUMERIC(3, 1), -- e.g. 6.0, 6.5, 7.0
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_session_id ON reports(session_id);

-- ── 5. Row Level Security (可选，增强安全性) ─────────────────────────────────
-- 如果你使用 Supabase Auth，可以启用 RLS
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
