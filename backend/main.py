from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes import auth, transcribe, chat, tts, report, sessions

app = FastAPI(
    title="EnglishBuddy API",
    description="Backend API for EnglishBuddy - AI English Speaking Practice",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 路由注册 ─────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(transcribe.router, prefix="/api", tags=["Speech"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(tts.router, prefix="/api", tags=["Speech"])
app.include_router(report.router, prefix="/api", tags=["Report"])
app.include_router(sessions.router, prefix="/api", tags=["Sessions"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "EnglishBuddy API v1.0"}
