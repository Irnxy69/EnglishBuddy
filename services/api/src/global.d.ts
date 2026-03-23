declare namespace NodeJS {
  interface ProcessEnv {
    API_PORT?: string;
    JWT_SECRET?: string;
    SPEECH_SERVICE_URL?: string;
    DATA_STORE_MODE?: "memory" | "postgres";
    POSTGRES_URL?: string;
    REDIS_URL?: string;
    LLM_STRATEGY?: "hybrid" | "mock-only";
    LLM_TIMEOUT_MS?: string;
    DEEPSEEK_API_KEY?: string;
    DEEPSEEK_BASE_URL?: string;
    DEEPSEEK_MODEL?: string;
    QWEN_API_KEY?: string;
    QWEN_BASE_URL?: string;
    QWEN_MODEL?: string;
  }
}
