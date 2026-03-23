import { FastifyInstance } from "fastify";
import { z } from "zod";
import { User } from "../types.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type AuthAccount = {
  user: User;
  password: string;
};

const authAccounts = new Map<string, AuthAccount>();

const defaultUser: User = {
  id: "u_1001",
  email: "demo@englishbuddy.ai",
  cefrLevel: "B1",
  nativeLang: "zh-CN",
  createdAt: new Date().toISOString()
};

authAccounts.set(defaultUser.email.toLowerCase(), {
  user: defaultUser,
  password: "123456"
});

function issueTokens(app: FastifyInstance, user: User) {
  const accessToken = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "1h" });
  const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "30d" });
  return { accessToken, refreshToken, user };
}

function randomUserId() {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const email = parsed.data.email.toLowerCase();
    const account = authAccounts.get(email);

    if (!account || account.password !== parsed.data.password) {
      return reply.code(401).send({ message: "邮箱或密码错误" });
    }

    return issueTokens(app, account.user);
  });

  app.post("/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const email = parsed.data.email.toLowerCase();
    if (authAccounts.has(email)) {
      return reply.code(409).send({ message: "该邮箱已注册" });
    }

    const user: User = {
      id: randomUserId(),
      email,
      cefrLevel: "A1",
      nativeLang: "zh-CN",
      createdAt: new Date().toISOString()
    };

    authAccounts.set(email, { user, password: parsed.data.password });

    return issueTokens(app, user);
  });
}
