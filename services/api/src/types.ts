export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface User {
  id: string;
  email: string;
  cefrLevel: CefrLevel;
  nativeLang: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  scenarioId: string;
  startedAt: string;
  durationSec: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  audioUrl?: string;
  scoreJson?: Record<string, unknown>;
  createdAt: string;
}

export interface Scenario {
  id: string;
  name: string;
  category: string;
  promptTemplate: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface LearningPlan {
  id: string;
  userId: string;
  weeklyGoalMin: number;
  currentStreak: number;
  planJson: {
    weeklyFocus: string;
    suggestedScenarios: string[];
  };
}
