import { LlmRouteDecision } from "./types.js";

const COMPLEX_MARKERS = ["why", "debate", "compare", "interview", "strategy", "tradeoff", "because", "although"];

export function selectProviderByInput(text: string): LlmRouteDecision {
  const normalized = text.toLowerCase();
  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  const markerHit = COMPLEX_MARKERS.some((word) => normalized.includes(word));
  const hasMultiClause = /[,;]|\b(but|however|while)\b/i.test(normalized);

  const isComplex = tokenCount >= 18 || markerHit || hasMultiClause;

  if (isComplex) {
    return {
      provider: "deepseek",
      reason: "complex-input"
    };
  }

  return {
    provider: "qwen",
    reason: "simple-input"
  };
}
