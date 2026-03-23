import { ChatMessage, OpenAICompatibleConfig } from "./types.js";

interface OpenAICompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export async function callOpenAICompatible(
  config: OpenAICompatibleConfig,
  messages: ChatMessage[]
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.6,
        ...(config.extraBody ?? {})
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM request failed (${response.status}): ${text.slice(0, 240)}`);
    }

    const json = (await response.json()) as OpenAICompatibleResponse;
    const output = json.choices?.[0]?.message?.content?.trim();

    if (!output) {
      throw new Error("LLM response missing content");
    }

    return output;
  } finally {
    clearTimeout(timeout);
  }
}
