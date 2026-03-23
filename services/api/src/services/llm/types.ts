export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenAICompatibleConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  extraBody?: Record<string, unknown>;
}

export interface ProviderResult {
  text: string;
  provider: "deepseek" | "qwen" | "mock";
  model: string;
}

export interface LlmRouteDecision {
  provider: "deepseek" | "qwen";
  reason: string;
}
