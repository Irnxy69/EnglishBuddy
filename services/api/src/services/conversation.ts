import { Scenario } from "../types.js";
import { callOpenAICompatible } from "./llm/openaiCompatible.js";
import { selectProviderByInput } from "./llm/router.js";
import { ProviderResult } from "./llm/types.js";

export interface ConversationInput {
  text: string;
  scenario: Scenario;
  cefrLevel: string;
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
}

export interface ConversationOutput {
  text: string;
  chunks: string[];
  provider: "deepseek" | "qwen" | "mock";
  model: string;
  routeReason: string;
}

export async function generateConversationReply(input: ConversationInput): Promise<ConversationOutput> {
  const route = selectProviderByInput(input.text);

  if (input.llm.strategy === "hybrid") {
    try {
      const response = await generateWithRealProvider(input, route.provider);
      return {
        text: response.text,
        chunks: chunkText(response.text, 28),
        provider: response.provider,
        model: response.model,
        routeReason: route.reason
      };
    } catch {
      // Fallback keeps the chat available when external model calls fail.
    }
  }

  const fallback = generateMockReply(input);

  return {
    text: fallback,
    chunks: chunkText(fallback, 28),
    provider: "mock",
    model: "mock-v1",
    routeReason: input.llm.strategy === "mock-only" ? "mock-only" : `fallback-${route.reason}`
  };
}

async function generateWithRealProvider(
  input: ConversationInput,
  preferredProvider: "deepseek" | "qwen"
): Promise<ProviderResult> {
  const systemPrompt = [
    "You are EnglishBuddy, a supportive English speaking coach for Chinese native learners.",
    `Current scenario: ${input.scenario.name} (${input.scenario.category}, ${input.scenario.difficulty}).`,
    `Learner level: ${input.cefrLevel}.`,
    "Rules: do not interrupt; provide one natural correction through gentle rephrasing; ask one follow-up question.",
    "Keep answer concise (2-4 sentences), practical, and encouraging."
  ].join(" ");

  const providers = preferredProvider === "deepseek" ? ["deepseek", "qwen"] as const : ["qwen", "deepseek"] as const;

  for (const provider of providers) {
    if (provider === "deepseek" && input.llm.deepseek.apiKey) {
      const text = await callOpenAICompatible(
        {
          apiKey: input.llm.deepseek.apiKey,
          baseUrl: input.llm.deepseek.baseUrl,
          model: input.llm.deepseek.model,
          timeoutMs: input.llm.timeoutMs
        },
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.text }
        ]
      );

      return {
        text,
        provider: "deepseek",
        model: input.llm.deepseek.model
      };
    }

    if (provider === "qwen" && input.llm.qwen.apiKey) {
      const text = await callOpenAICompatible(
        {
          apiKey: input.llm.qwen.apiKey,
          baseUrl: input.llm.qwen.baseUrl,
          model: input.llm.qwen.model,
          timeoutMs: input.llm.timeoutMs,
          extraBody: {
            enable_thinking: false
          }
        },
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: input.text }
        ]
      );

      return {
        text,
        provider: "qwen",
        model: input.llm.qwen.model
      };
    }
  }

  throw new Error("No configured provider API key");
}

function generateMockReply(input: ConversationInput): string {
  const normalized = input.text.replace(/\s+very\s+/gi, " really ").trim();
  const levelHint = levelInstruction(input.cefrLevel);

  return [
    `Nice work in ${input.scenario.name}.`,
    `A more natural phrase is: \"${normalized}\".`,
    `${levelHint} Could you add one concrete detail in your next answer?`
  ].join(" ");
}

function levelInstruction(level: string): string {
  if (level === "A1" || level === "A2") {
    return "Try short and clear sentences.";
  }
  if (level === "C1" || level === "C2") {
    return "Try one idiomatic phrase naturally.";
  }
  return "Try using one reason and one example.";
}

function chunkText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
