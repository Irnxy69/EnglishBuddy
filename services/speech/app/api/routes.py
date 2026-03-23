from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.config import settings
from app.providers.iflytek_provider import IflytekProviderError, debug_ws_auth, pronunciation_score, stt_realtime
from app.providers.mock_provider import mock_score, mock_stt, mock_tts
from app.providers.qwen_tts_provider import QwenTtsProviderError, synthesize_tts

router = APIRouter(prefix="/api/v1/speech", tags=["speech"])


class STTRequest(BaseModel):
    audioBase64: str = Field(min_length=10)


class ScoreRequest(BaseModel):
    audioBase64: str = Field(min_length=10)
    referenceText: str = Field(min_length=1)


class TTSRequest(BaseModel):
    text: str = Field(min_length=1)


@router.post("/stt")
def stt(payload: STTRequest) -> dict:
    if settings.speech_provider_mode == "mock-only":
        return mock_stt(payload.audioBase64)

    try:
        return stt_realtime(
            audio_base64=payload.audioBase64,
            app_id=settings.iflytek.stt_app_id,
            api_key=settings.iflytek.stt_api_key,
            api_secret=settings.iflytek.stt_api_secret,
            url=settings.iflytek.stt_url,
            options={
                "language": settings.iflytek.stt_language,
                "domain": settings.iflytek.stt_domain,
                "accent": settings.iflytek.stt_accent,
                "audio_format": settings.iflytek.audio_format,
                "encoding": settings.iflytek.audio_encoding,
                "max_audio_sec": 8
            }
        )
    except IflytekProviderError as error:
        result = mock_stt(payload.audioBase64)
        result["fallbackFrom"] = "iflytek"
        result["fallbackReason"] = str(error)
        return result


@router.post("/score")
def score(payload: ScoreRequest) -> dict:
    if settings.speech_provider_mode == "mock-only":
        return mock_score(payload.referenceText)

    try:
        return pronunciation_score(
            audio_base64=payload.audioBase64,
            reference_text=payload.referenceText,
            app_id=settings.iflytek.score_app_id,
            api_key=settings.iflytek.score_api_key,
            api_secret=settings.iflytek.score_api_secret,
            url=settings.iflytek.score_url,
            options={
                "category": settings.iflytek.ise_category,
                "sub": settings.iflytek.ise_sub,
                "ent": settings.iflytek.ise_ent,
                "cmd": settings.iflytek.ise_cmd,
                "tte": settings.iflytek.ise_tte,
                "aue": settings.iflytek.ise_aue,
                "auf": settings.iflytek.ise_auf,
                "audio_field_mode": settings.iflytek.ise_audio_field_mode,
                "encoding": settings.iflytek.audio_encoding,
                "sanitize_text": True,
                "max_audio_sec": 10
            }
        )
    except IflytekProviderError as error:
        result = mock_score(payload.referenceText)
        result["fallbackFrom"] = "iflytek"
        result["fallbackReason"] = str(error)
        return result


@router.get("/debug/iflytek-auth")
def debug_iflytek_auth() -> dict:
    stt = debug_ws_auth(
        url=settings.iflytek.stt_url,
        api_key=settings.iflytek.stt_api_key,
        api_secret=settings.iflytek.stt_api_secret
    )
    score = debug_ws_auth(
        url=settings.iflytek.score_url,
        api_key=settings.iflytek.score_api_key,
        api_secret=settings.iflytek.score_api_secret
    )
    return {
        "stt": stt,
        "score": score
    }


@router.post("/tts")
def tts(payload: TTSRequest) -> dict:
    if settings.speech_provider_mode == "mock-only":
        return mock_tts(payload.text)

    try:
        return synthesize_tts(
            text=payload.text,
            api_key=settings.qwen_tts.api_key,
            base_url=settings.qwen_tts.base_url,
            endpoint=settings.qwen_tts.endpoint,
            model=settings.qwen_tts.model,
            voice=settings.qwen_tts.voice
        )
    except QwenTtsProviderError as error:
        result = mock_tts(payload.text)
        result["fallbackFrom"] = "qwen-tts"
        result["fallbackReason"] = str(error)
        return result
