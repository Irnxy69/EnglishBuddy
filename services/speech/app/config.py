from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict


class IFLYTEKConfig(BaseModel):
    stt_app_id: str = ""
    stt_api_key: str = ""
    stt_api_secret: str = ""
    score_app_id: str = ""
    score_api_key: str = ""
    score_api_secret: str = ""
    stt_url: str = ""
    score_url: str = ""
    stt_language: str = "en_us"
    stt_domain: str = "iat"
    stt_accent: str = ""
    audio_format: str = "audio/L16;rate=16000"
    audio_encoding: str = "raw"
    ise_category: str = "read_sentence"
    ise_sub: str = "ise"
    ise_ent: str = "en_vip"
    ise_cmd: str = "ssb"
    ise_tte: str = "utf-8"
    ise_aue: str = "raw"
    ise_auf: str = "audio/L16;rate=16000"
    ise_audio_field_mode: str = "data"


class QwenTTSConfig(BaseModel):
    api_key: str = ""
    base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    endpoint: str = "/audio/speech"
    model: str = "qwen-tts-flash"
    voice: str = "Cherry"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    speech_provider_mode: str = "hybrid"
    iflytek_stt_app_id: str = ""
    iflytek_stt_api_key: str = ""
    iflytek_stt_api_secret: str = ""
    iflytek_score_app_id: str = ""
    iflytek_score_api_key: str = ""
    iflytek_score_api_secret: str = ""
    iflytek_api_secret: str = ""
    siflytek_core_api_key: str = ""
    iflytek_stt_url: str = ""
    iflytek_score_url: str = ""
    iflytek_stt_language: str = "en_us"
    iflytek_stt_domain: str = "iat"
    iflytek_stt_accent: str = ""
    iflytek_audio_format: str = "audio/L16;rate=16000"
    iflytek_audio_encoding: str = "raw"
    iflytek_ise_category: str = "read_sentence"
    iflytek_ise_sub: str = "ise"
    iflytek_ise_ent: str = "en_vip"
    iflytek_ise_cmd: str = "ssb"
    iflytek_ise_tte: str = "utf-8"
    iflytek_ise_aue: str = "raw"
    iflytek_ise_auf: str = "audio/L16;rate=16000"
    iflytek_ise_audio_field_mode: str = "data"

    qwen_tts_api_key: str = ""
    qwen_tts_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    qwen_tts_endpoint: str = "/audio/speech"
    qwen_tts_model: str = "qwen-tts-flash"
    qwen_tts_voice: str = "Cherry"

    @property
    def iflytek(self) -> IFLYTEKConfig:
        return IFLYTEKConfig(
            stt_app_id=self.iflytek_stt_app_id,
            stt_api_key=self.iflytek_stt_api_key,
            stt_api_secret=self.iflytek_stt_api_secret or self.iflytek_api_secret,
            score_app_id=self.iflytek_score_app_id,
            score_api_key=self.iflytek_score_api_key or self.siflytek_core_api_key,
            score_api_secret=self.iflytek_score_api_secret or self.iflytek_api_secret,
            stt_url=self.iflytek_stt_url,
            score_url=self.iflytek_score_url,
            stt_language=self.iflytek_stt_language,
            stt_domain=self.iflytek_stt_domain,
            stt_accent=self.iflytek_stt_accent,
            audio_format=self.iflytek_audio_format,
            audio_encoding=self.iflytek_audio_encoding,
            ise_category=self.iflytek_ise_category,
            ise_sub=self.iflytek_ise_sub,
            ise_ent=self.iflytek_ise_ent,
            ise_cmd=self.iflytek_ise_cmd,
            ise_tte=self.iflytek_ise_tte,
            ise_aue=self.iflytek_ise_aue,
            ise_auf=self.iflytek_ise_auf
            ,
            ise_audio_field_mode=self.iflytek_ise_audio_field_mode
        )

    @property
    def qwen_tts(self) -> QwenTTSConfig:
        return QwenTTSConfig(
            api_key=self.qwen_tts_api_key,
            base_url=self.qwen_tts_base_url,
            endpoint=self.qwen_tts_endpoint,
            model=self.qwen_tts_model,
            voice=self.qwen_tts_voice
        )


settings = Settings()
