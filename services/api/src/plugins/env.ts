import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    env: {
      port: number;
      jwtSecret: string;
      speechServiceUrl: string;
      dataStoreMode: "memory" | "postgres";
      postgresUrl: string;
      redisUrl: string;
      llm: {
        strategy: "hybrid" | "mock-only";
        timeoutMs: number;
        deepseek: {
          apiKey: string;
          baseUrl: string;
          model: string;
        };
        qwen: {
          apiKey: string;
          baseUrl: string;
          model: string;
        };
      };
    };
  }
}

export const envPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  const port = Number(process.env.API_PORT ?? "8001");
  const jwtSecret = process.env.JWT_SECRET ?? "dev-secret-change-me";
  const speechServiceUrl = process.env.SPEECH_SERVICE_URL ?? "http://127.0.0.1:8002";
  const dataStoreMode = process.env.DATA_STORE_MODE === "postgres" ? "postgres" : "memory";
  const postgresUrl = process.env.POSTGRES_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/englishbuddy";
  const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  const llmStrategy = process.env.LLM_STRATEGY === "mock-only" ? "mock-only" : "hybrid";
  const llmTimeoutMs = Number(process.env.LLM_TIMEOUT_MS ?? "18000");

  app.decorate("env", {
    port,
    jwtSecret,
    speechServiceUrl,
    dataStoreMode,
    postgresUrl,
    redisUrl,
    llm: {
      strategy: llmStrategy,
      timeoutMs: Number.isFinite(llmTimeoutMs) ? llmTimeoutMs : 18000,
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY ?? "",
        baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
        model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat"
      },
      qwen: {
        apiKey: process.env.QWEN_API_KEY ?? "",
        baseUrl: process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
        model: process.env.QWEN_MODEL ?? "qwen3-32b"
      }
    }
  });
});
