import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDataStore } from "../db/index.js";
import { User } from "../types.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  invitationCode: z.string().min(4)
});

const generateInvitationSchema = z.object({
  maxUses: z.number().int().min(1).max(1000),
  expiresAt: z.string().datetime().optional().nullable(),
  note: z.string().max(200).optional().nullable()
});

const disableInvitationSchema = z.object({
  code: z.string().min(4)
});

function issueTokens(app: FastifyInstance, user: User) {
  const accessToken = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "1h" });
  const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "30d" });
  return { accessToken, refreshToken, user };
}

function randomUserId() {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

function getUserIdFromAuthorization(app: FastifyInstance, authorization?: string): string | null {
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return null;
  }

  try {
    const token = authorization.slice(7);
    const payload = app.jwt.verify<{ sub: string }>(token);
    return payload.sub;
  } catch {
    return null;
  }
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const store = getDataStore();
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const account = await store.findAuthAccountByEmail(parsed.data.email.toLowerCase());
    if (!account || account.password !== parsed.data.password) {
      return reply.code(401).send({ message: "邮箱或密码错误" });
    }

    return issueTokens(app, account.user);
  });

  app.post("/register", async (request, reply) => {
    const store = getDataStore();
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const invitationCode = parsed.data.invitationCode.trim().toUpperCase();
    const verification = await store.verifyInvitation(invitationCode);
    if (!verification.valid) {
      return reply.code(403).send({ message: verification.message });
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const existing = await store.findAuthAccountByEmail(normalizedEmail);
    if (existing) {
      return reply.code(409).send({ message: "该邮箱已注册" });
    }

    const consumed = await store.consumeInvitation(invitationCode);
    if (!consumed) {
      return reply.code(409).send({ message: "邀请码已失效，请更换邀请码" });
    }

    const user: User = {
      id: randomUserId(),
      email: normalizedEmail,
      cefrLevel: "A1",
      nativeLang: "zh-CN",
      createdAt: new Date().toISOString()
    };

    await store.createAuthAccount({
      email: normalizedEmail,
      password: parsed.data.password,
      user
    });

    return issueTokens(app, user);
  });

  app.post("/verify-invitation", async (request, reply) => {
    const store = getDataStore();
    const body = request.body as { code?: string };
    if (!body.code) {
      return reply.code(400).send({ message: "邀请码为空" });
    }

    const verification = await store.verifyInvitation(body.code);
    return { valid: verification.valid, message: verification.message };
  });

  app.post("/invitations/generate", async (request, reply) => {
    const store = getDataStore();
    const userId = getUserIdFromAuthorization(app, request.headers.authorization);
    if (!userId) {
      return reply.code(401).send({ message: "未授权" });
    }
    if (userId !== "u_1001") {
      return reply.code(403).send({ message: "权限不足" });
    }

    const parsed = generateInvitationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const invitation = await store.createInvitation({
      maxUses: parsed.data.maxUses,
      createdBy: userId,
      expiresAt: parsed.data.expiresAt ?? null,
      note: parsed.data.note ?? null
    });

    return {
      ...invitation,
      remainingUses: invitation.maxUses - invitation.usedCount
    };
  });

  app.get("/invitations/list", async (request, reply) => {
    const store = getDataStore();
    const userId = getUserIdFromAuthorization(app, request.headers.authorization);
    if (!userId) {
      return reply.code(401).send({ message: "未授权" });
    }
    if (userId !== "u_1001") {
      return reply.code(403).send({ message: "权限不足" });
    }

    const invites = await store.listInvitations();
    const codes = invites.map((inv) => ({
      code: inv.code,
      maxUses: inv.maxUses,
      usedCount: inv.usedCount,
      remainingUses: Math.max(0, inv.maxUses - inv.usedCount),
      createdAt: inv.createdAt,
      createdBy: inv.createdBy,
      isActive: inv.isActive,
      expiresAt: inv.expiresAt ?? null,
      note: inv.note ?? null
    }));

    return { codes, total: codes.length };
  });

  app.post("/invitations/disable", async (request, reply) => {
    const store = getDataStore();
    const userId = getUserIdFromAuthorization(app, request.headers.authorization);
    if (!userId) {
      return reply.code(401).send({ message: "未授权" });
    }
    if (userId !== "u_1001") {
      return reply.code(403).send({ message: "权限不足" });
    }

    const parsed = disableInvitationSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const ok = await store.disableInvitation(parsed.data.code);
    if (!ok) {
      return reply.code(404).send({ message: "邀请码不存在" });
    }

    return { message: "邀请码已禁用", code: parsed.data.code.toUpperCase() };
  });
}
