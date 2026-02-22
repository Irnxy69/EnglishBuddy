import asyncio
import tempfile
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
import edge_tts
from app.config import settings
from app.auth import get_current_user
from app.models import TTSRequest

router = APIRouter()


@router.post("/tts")
async def text_to_speech(
    request: TTSRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    将文字转换为 MP3 语音并返回。
    使用微软 edge-tts（免费，高质量）。
    """
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    voice = request.voice or settings.tts_voice

    # 生成临时 MP3 文件
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
        tmp_path = tmp.name

    try:
        communicate = edge_tts.Communicate(request.text, voice)
        await communicate.save(tmp_path)

        # 检查文件是否生成成功
        if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
            raise HTTPException(status_code=500, detail="TTS generation failed")

        return FileResponse(
            tmp_path,
            media_type="audio/mpeg",
            filename="response.mp3",
            background=None,  # 手动删除临时文件
        )
    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"TTS error: {str(e)}")
