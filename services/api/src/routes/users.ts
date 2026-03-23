import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDataStore } from "../db/index.js";

const updatePlanSchema = z.object({
  weeklyGoalMin: z.number().int().min(30).max(600),
  currentStreak: z.number().int().min(0).max(365),
  weeklyFocus: z.string().min(3),
  suggestedScenarios: z.array(z.string()).min(1)
});

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/me/plan", { preHandler: app.authenticate }, async (request, reply) => {
    const store = getDataStore();
    const userId = (request.user as any).sub as string;
    const plan = await store.getPlanByUserId(userId);

    if (!plan) {
      return reply.code(404).send({ message: "Plan not found" });
    }

    return plan;
  });

  app.put("/me/plan", { preHandler: app.authenticate }, async (request, reply) => {
    const store = getDataStore();
    const parsed = updatePlanSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const userId = (request.user as any).sub as string;
    const current = await store.getPlanByUserId(userId);

    const next = await store.upsertPlan({
      id: current?.id ?? "lp_generated",
      userId,
      weeklyGoalMin: parsed.data.weeklyGoalMin,
      currentStreak: parsed.data.currentStreak,
      planJson: {
        weeklyFocus: parsed.data.weeklyFocus,
        suggestedScenarios: parsed.data.suggestedScenarios
      }
    });

    return next;
  });
}
