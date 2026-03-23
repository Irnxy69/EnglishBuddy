import { DataStore } from "./contracts.js";
import { Invitation, LearningPlan, Message, Scenario, Session, User } from "../types.js";

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

const authAccounts = new Map<string, { user: User; password: string }>();

const invitations = new Map<string, Invitation>();

authAccounts.set(demoUser.email.toLowerCase(), {
  user: demoUser,
  password: "123456"
});

invitations.set("BUDDY2024MVP", {
  code: "BUDDY2024MVP",
  maxUses: 100,
  usedCount: 0,
  createdAt: new Date().toISOString(),
  createdBy: demoUser.id,
  isActive: true,
  expiresAt: null,
  note: "MVP default invite"
});

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function randomInvitationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `BUDDY${suffix}`;
}

export const memoryStore: DataStore = {
  getDemoUser: () => demoUser,
  findAuthAccountByEmail: async (email: string) => authAccounts.get(email.toLowerCase()),
  createAuthAccount: async (input) => {
    authAccounts.set(input.email.toLowerCase(), { user: input.user, password: input.password });
  },
  listInvitations: async () => Array.from(invitations.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  createInvitation: async (input) => {
    const invitation: Invitation = {
      code: randomInvitationCode(),
      maxUses: input.maxUses,
      usedCount: 0,
      createdAt: new Date().toISOString(),
      createdBy: input.createdBy,
      isActive: true,
      expiresAt: input.expiresAt ?? null,
      note: input.note ?? null
    };
    invitations.set(invitation.code, invitation);
    return invitation;
  },
  disableInvitation: async (code: string) => {
    const key = code.trim().toUpperCase();
    const invitation = invitations.get(key);
    if (!invitation) {
      return false;
    }
    invitation.isActive = false;
    return true;
  },
  verifyInvitation: async (code: string) => {
    const key = code.trim().toUpperCase();
    const invitation = invitations.get(key);

    if (!invitation) {
      return { valid: false, message: "邀请码不存在或已过期" };
    }
    if (!invitation.isActive) {
      return { valid: false, message: "邀请码已被禁用" };
    }
    if (invitation.expiresAt && Date.parse(invitation.expiresAt) <= Date.now()) {
      return { valid: false, message: "邀请码已过期" };
    }
    if (invitation.usedCount >= invitation.maxUses) {
      return { valid: false, message: "邀请码已达使用上限" };
    }

    return { valid: true };
  },
  consumeInvitation: async (code: string) => {
    const key = code.trim().toUpperCase();
    const invitation = invitations.get(key);
    if (!invitation || !invitation.isActive) {
      return false;
    }
    if (invitation.expiresAt && Date.parse(invitation.expiresAt) <= Date.now()) {
      return false;
    }
    if (invitation.usedCount >= invitation.maxUses) {
      return false;
    }
    invitation.usedCount += 1;
    return true;
  },
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
