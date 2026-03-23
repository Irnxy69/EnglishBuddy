import { Invitation, InvitationCreateInput, LearningPlan, Message, Scenario, Session, User } from "../types.js";

export type AuthAccountRecord = {
  user: User;
  password: string;
};

export type InvitationVerifyResult = {
  valid: boolean;
  message?: string;
};

export interface DataStore {
  getDemoUser(): User;
  findAuthAccountByEmail(email: string): Promise<AuthAccountRecord | undefined>;
  createAuthAccount(input: { email: string; password: string; user: User }): Promise<void>;
  listInvitations(): Promise<Invitation[]>;
  createInvitation(input: InvitationCreateInput): Promise<Invitation>;
  disableInvitation(code: string): Promise<boolean>;
  verifyInvitation(code: string): Promise<InvitationVerifyResult>;
  consumeInvitation(code: string): Promise<boolean>;
  getScenarios(): Promise<Scenario[]>;
  getScenarioById(id: string): Promise<Scenario | undefined>;
  getPlanByUserId(userId: string): Promise<LearningPlan | undefined>;
  upsertPlan(plan: LearningPlan): Promise<LearningPlan>;
  createSession(userId: string, scenarioId: string): Promise<Session>;
  getSessionById(id: string): Promise<Session | undefined>;
  listMessagesBySessionId(sessionId: string): Promise<Message[]>;
  addMessage(payload: Omit<Message, "id" | "createdAt">): Promise<Message>;
}
