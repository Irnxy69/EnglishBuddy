import { DataStore } from "./contracts.js";
import { LearningPlan, Message, Scenario, Session, User } from "../types.js";

const demoUser: User = {
  id: "u_1001",
  email: "demo@englishbuddy.ai",
  cefrLevel: "B1",
  nativeLang: "zh-CN",
  createdAt: new Date().toISOString()
};

const scenarios: Scenario[] = [
  {
    id: "scn_airport",
    name: "Airport Check-in",
    category: "travel",
    promptTemplate: "You are an airport check-in staff. Keep it practical and encouraging.",
    difficulty: "easy"
  },
  {
    id: "scn_interview",
    name: "Job Interview",
    category: "career",
    promptTemplate: "You are an interviewer for a product manager role.",
    difficulty: "hard"
  },
  {
    id: "scn_coffee",
    name: "Coffee Shop Order",
    category: "daily",
    promptTemplate: "You are a friendly barista helping the learner order coffee.",
    difficulty: "easy"
  }
];

const plans: LearningPlan[] = [
  {
    id: "lp_1001",
    userId: demoUser.id,
    weeklyGoalMin: 120,
    currentStreak: 3,
    planJson: {
      weeklyFocus: "Improve fluency in work-related conversations",
      suggestedScenarios: ["scn_interview", "scn_airport"]
    }
  }
];

const sessions: Session[] = [];
const messages: Message[] = [];

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export const memoryStore: DataStore = {
  getDemoUser: () => demoUser,
  getScenarios: async () => scenarios,
  getScenarioById: async (id: string) => scenarios.find((s) => s.id === id),
  getPlanByUserId: async (userId: string) => plans.find((p) => p.userId === userId),
  upsertPlan: async (plan: LearningPlan) => {
    const index = plans.findIndex((p) => p.userId === plan.userId);
    if (index >= 0) {
      plans[index] = plan;
      return plan;
    }
    plans.push(plan);
    return plan;
  },
  createSession: async (userId: string, scenarioId: string): Promise<Session> => {
    const session: Session = {
      id: randomId("sess"),
      userId,
      scenarioId,
      startedAt: new Date().toISOString(),
      durationSec: 0
    };
    sessions.push(session);
    return session;
  },
  getSessionById: async (id: string) => sessions.find((s) => s.id === id),
  listMessagesBySessionId: async (sessionId: string) => messages.filter((m) => m.sessionId === sessionId),
  addMessage: async (payload: Omit<Message, "id" | "createdAt">): Promise<Message> => {
    const message: Message = {
      id: randomId("msg"),
      createdAt: new Date().toISOString(),
      ...payload
    };
    messages.push(message);
    return message;
  }
};
