import { LearningPlan, Message, Scenario, Session, User } from "../types.js";

export interface DataStore {
  getDemoUser(): User;
  getScenarios(): Promise<Scenario[]>;
  getScenarioById(id: string): Promise<Scenario | undefined>;
  getPlanByUserId(userId: string): Promise<LearningPlan | undefined>;
  upsertPlan(plan: LearningPlan): Promise<LearningPlan>;
  createSession(userId: string, scenarioId: string): Promise<Session>;
  getSessionById(id: string): Promise<Session | undefined>;
  listMessagesBySessionId(sessionId: string): Promise<Message[]>;
  addMessage(payload: Omit<Message, "id" | "createdAt">): Promise<Message>;
}
