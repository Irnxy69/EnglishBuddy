from pydantic import BaseModel, EmailStr
from typing import Optional, List
from enum import Enum


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str


# ── Chat ──────────────────────────────────────────────────────────────────────

class PracticeMode(str, Enum):
    ielts = "ielts"
    daily = "daily"
    interview = "interview"


class Message(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    session_id: str
    user_text: str
    history: List[Message] = []
    mode: PracticeMode = PracticeMode.ielts


class ChatResponse(BaseModel):
    reply: str
    session_id: str


# ── TTS ───────────────────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None  # 默认使用配置中的 voice


# ── Report ────────────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    session_id: str
    history: List[Message]


class ReportResponse(BaseModel):
    session_id: str
    content: str  # Markdown 格式
    band_score: Optional[float] = None
