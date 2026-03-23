from fastapi import FastAPI

from app.api.routes import router as speech_router

app = FastAPI(title="EnglishBuddy Speech Service", version="0.1.0")

app.include_router(speech_router)


@app.get("/health")
def health() -> dict[str, str | bool]:
    return {"ok": True, "service": "speech"}
