import io
import tempfile
import os
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from groq import Groq
from app.config import settings
from app.auth import get_current_user

router = APIRouter()

_groq_client: Groq | None = None


def get_groq_client() -> Groq:
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq(api_key=settings.groq_api_key)
    return _groq_client


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    接收音频文件，使用 Groq Whisper API 转录为文字。
    支持 wav, mp3, webm, ogg, m4a 格式。
    """
    allowed_types = {"audio/wav", "audio/mpeg", "audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a"}
    content_type = file.content_type or ""
    if not any(t in content_type for t in ["audio", "octet-stream"]):
        raise HTTPException(status_code=400, detail="Must upload an audio file")

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # 写入临时文件（Groq SDK 需要文件路径或文件对象）
    suffix = "." + (file.filename.split(".")[-1] if file.filename and "." in file.filename else "wav")
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        client = get_groq_client()
        with open(tmp_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=(file.filename or f"audio{suffix}", audio_file),
                model="whisper-large-v3-turbo",
                language="en",
            )
        text = transcription.text.strip()
        return {"text": text, "language": "en"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
