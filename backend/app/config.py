from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # DeepSeek
    deepseek_api_key: str
    deepseek_base_url: str = "https://api.deepseek.com"

    # Groq (Whisper)
    groq_api_key: str
    # 设置 Cloudflare Worker 代理 URL 以绕过 GFW 封锁；默认直连 Groq
    groq_base_url: str = "https://api.groq.com"

    # Supabase
    supabase_url: str
    supabase_service_key: str

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 43200  # 30 days

    # TTS
    tts_voice: str = "en-US-AriaNeural"

    # CORS
    allowed_origins: str = "http://localhost:3000"

    @property
    def origins_list(self) -> List[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
