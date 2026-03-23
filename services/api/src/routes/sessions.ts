import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getDataStore } from "../db/index.js";
import { generateConversationReply } from "../services/conversation.js";

const createSessionSchema = z.object({
  scenarioId: z.string().min(1)
});

const sendMessageSchema = z.object({
  text: z.string().min(1).max(2000),
  audioBase64: z.string().optional()
});

export async function registerSessionRoutes(app: FastifyInstance) {
  app.post("/", { preHandler: app.authenticate }, async (request, reply) => {
    const store = getDataStore();
    const parsed = createSessionSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const userId = (request.user as any).sub as string;
    const scenario = await store.getScenarioById(parsed.data.scenarioId);

    if (!scenario) {
      return reply.code(404).send({ message: "Scenario not found" });
    }

    return store.createSession(userId, scenario.id);
  });

  app.post("/:id/messages", { preHandler: app.authenticate }, async (request, reply) => {
    const store = getDataStore();
    const { id } = request.params as { id: string };
    const parsed = sendMessageSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const session = await store.getSessionById(id);
    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    const userMessage = await store.addMessage({
      sessionId: id,
      role: "user",
      content: parsed.data.text
    });

    const scenario = await store.getScenarioById(session.scenarioId);
    if (!scenario) {
      return reply.code(404).send({ message: "Scenario not found" });
    }

    const user = store.getDemoUser();
    const output = await generateConversationReply({
      text: parsed.data.text,
      scenario,
      cefrLevel: user.cefrLevel,
      llm: app.env.llm
    });

    const assistantMessage = await store.addMessage({
      sessionId: id,
      role: "assistant",
      content: output.text,
      scoreJson: {
        provider: output.provider,
        model: output.model,
        routeReason: output.routeReason
      }
    });

    return {
      reply: assistantMessage,
      userMessage,
      meta: {
        provider: output.provider,
        model: output.model,
        routeReason: output.routeReason
      }
    };
  });

  app.get("/:id/summary", { preHandler: app.authenticate }, async (request, reply) => {
    const store = getDataStore();
    const { id } = request.params as { id: string };
    const session = await store.getSessionById(id);

    if (!session) {
      return reply.code(404).send({ message: "Session not found" });
    }

    const messageRows = await store.listMessagesBySessionId(id);
    const userTurns = messageRows.filter((m) => m.role === "user").length;

    return {
      sessionId: id,
      turns: Math.floor(messageRows.length / 2),
      userTurns,
      score: {
        pronunciation: 81,
        grammar: 78,
        vocabulary: 75,
        fluency: 80
      },
      corrections: [
        {
          wrong: "I very like this city",
          better: "I really like this city"
        }
      ]
    };
  });
}
