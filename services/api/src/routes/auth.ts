import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDataStore } from "../db/index.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const user = getDataStore().getDemoUser();
    const accessToken = app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: "1h" });
    const refreshToken = app.jwt.sign({ sub: user.id, type: "refresh" }, { expiresIn: "30d" });

    return {
      accessToken,
      refreshToken,
      user
    };
  });
}
