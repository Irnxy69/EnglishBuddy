import { FastifyInstance } from "fastify";
import { z } from "zod";
import { User } from "../types.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  invitationCode: z.string().optional()
});

const generateInvitationSchema = z.object({
  maxUses: z.number().min(1).max(1000),
  userId: z.string()
});

type AuthAccount = {
  user: User;
  password: string;
};

type InvitationCode = {
  code: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
};

const authAccounts = new Map<string, AuthAccount>();
const invitationCodes = new Map<string, InvitationCode>();

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

// 添加一个默认的邀请码用于演示
function generateCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "BUDDY";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const defaultInvitationCode: InvitationCode = {
  code: "BUDDY2024MVP",
  maxUses: 100,
  usedCount: 0,
  createdAt: new Date().toISOString(),
  createdBy: "u_1001",
  isActive: true
};

invitationCodes.set("BUDDY2024MVP", defaultInvitationCode);

function issueTokens(app: FastifyInstance, user: User) {
  const accessToken = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "1h" });
  const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "30d" });
  return { accessToken, refreshToken, user };
}

function randomUserId() {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

function verifyInvitationCode(code: string): { valid: boolean; message?: string } {
  const trimmedCode = code.trim().toUpperCase();
  const invitation = invitationCodes.get(trimmedCode);

  if (!invitation) {
    return { valid: false, message: "邀请码不存在或已过期" };
  }

  if (!invitation.isActive) {
    return { valid: false, message: "邀请码已被禁用" };
  }

  if (invitation.usedCount >= invitation.maxUses) {
    return { valid: false, message: "邀请码已达使用上限" };
  }

  return { valid: true };
}

function useInvitationCode(code: string): boolean {
  const trimmedCode = code.trim().toUpperCase();
  const invitation = invitationCodes.get(trimmedCode);

  if (!invitation || !invitation.isActive || invitation.usedCount >= invitation.maxUses) {
    return false;
  }

  invitation.usedCount++;
  return true;
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

    // 验证邀请码
    const invitationCode = parsed.data.invitationCode;
    if (!invitationCode) {
      return reply.code(400).send({ message: "需要邀请码才能注册" });
    }

    const codeVerification = verifyInvitationCode(invitationCode);
    if (!codeVerification.valid) {
      return reply.code(403).send({ message: codeVerification.message });
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
    
    // 使用邀请码
    useInvitationCode(invitationCode);

    return issueTokens(app, user);
  });

    // 验证邀请码（前端检查有效性）
    app.post("/verify-invitation", async (request, reply) => {
      const body = request.body as { code: string };
      if (!body.code) {
        return reply.code(400).send({ message: "邀请码为空" });
      }

      const verification = verifyInvitationCode(body.code);
      return { valid: verification.valid, message: verification.message };
    });

    // 生成新邀请码（管理员使用）
    app.post<{ Body: { maxUses: number } }>("/invitations/generate", 
      async (request, reply) => {
          // 获取并验证JWT token
          const authHeader = request.headers.authorization;
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return reply.code(401).send({ message: "未授权" });
          }
      
          let userId = "";
          try {
            const token = authHeader.slice(7);
            const payload = app.jwt.verify<{ sub: string }>(token);
            userId = payload.sub;
          } catch {
            return reply.code(401).send({ message: "令牌无效" });
          }

          // 仅允许演示账户生成邀请码
          if (userId !== "u_1001") {
          return reply.code(403).send({ message: "权限不足" });
        }

        const parsed = generateInvitationSchema.safeParse({
          maxUses: (request.body as any).maxUses || 5,
           userId: userId
        });

        if (!parsed.success) {
          return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
        }

        const code = generateCode();
        const invitation: InvitationCode = {
          code,
          maxUses: parsed.data.maxUses,
          usedCount: 0,
          createdAt: new Date().toISOString(),
          createdBy: parsed.data.userId,
          isActive: true
        };

        invitationCodes.set(code, invitation);

        return {
          code,
          maxUses: parsed.data.maxUses,
          usedCount: 0,
          createdAt: invitation.createdAt
        };
      }
    );

    // 列出所有邀请码（管理员使用）
    app.get("/invitations/list", async (request, reply) => {
      // 获取并验证JWT token
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return reply.code(401).send({ message: "未授权" });
      }
    
      let userId = "";
      try {
        const token = authHeader.slice(7);
        const payload = app.jwt.verify<{ sub: string }>(token);
        userId = payload.sub;
      } catch {
        return reply.code(401).send({ message: "令牌无效" });
      }

      // 仅允许演示账户列出邀请码
      if (userId !== "u_1001") {
        return reply.code(403).send({ message: "权限不足" });
      }

      const codes = Array.from(invitationCodes.values()).map(inv => ({
        code: inv.code,
        maxUses: inv.maxUses,
        usedCount: inv.usedCount,
        remainingUses: inv.maxUses - inv.usedCount,
        createdAt: inv.createdAt,
        isActive: inv.isActive,
        usageRate: `${Math.round((inv.usedCount / inv.maxUses) * 100)}%`
      }));

      return { codes, total: codes.length };
    });

    // 禁用邀请码（管理员使用）
    app.post<{ Body: { code: string } }>("/invitations/disable",
      async (request, reply) => {
        // 获取并验证JWT token
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return reply.code(401).send({ message: "未授权" });
        }
      
        let userId = "";
        try {
          const token = authHeader.slice(7);
          const payload = app.jwt.verify<{ sub: string }>(token);
          userId = payload.sub;
        } catch {
          return reply.code(401).send({ message: "令牌无效" });
        }

        // 仅允许演示账户禁用邀请码
        if (userId !== "u_1001") {
          return reply.code(403).send({ message: "权限不足" });
        }

        const code = (request.body as any).code?.toUpperCase();
        if (!code) {
          return reply.code(400).send({ message: "邀请码为空" });
        }

        const invitation = invitationCodes.get(code);
        if (!invitation) {
          return reply.code(404).send({ message: "邀请码不存在" });
        }

        invitation.isActive = false;
        return { message: "邀请码已禁用", code };
      }
    );
    }
