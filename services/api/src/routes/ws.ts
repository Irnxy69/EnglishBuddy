import { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { z } from "zod";
import { getDataStore } from "../db/index.js";
import { generateConversationReply, sleep } from "../services/conversation.js";

const inboundSchema = z.object({
  event: z.literal("message.send"),
  sessionId: z.string().min(1),
  text: z.string().min(1),
  audioBase64: z.string().optional()
});

export async function registerWsRoutes(app: FastifyInstance) {
  await app.register(websocket);

  app.get("/api/v1/ws", { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token;

    if (!token) {
      socket.send(JSON.stringify({ event: "error", message: "Missing token" }));
      socket.close();
      return;
    }

    let userId = "";
    try {
      const payload = app.jwt.verify<{ sub: string }>(token);
      userId = payload.sub;
    } catch {
      socket.send(JSON.stringify({ event: "error", message: "Invalid token" }));
      socket.close();
      return;
    }

    socket.on("message", async (raw: Buffer) => {
      const store = getDataStore();
      let payload: unknown;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        socket.send(JSON.stringify({ event: "error", message: "Invalid JSON payload" }));
        return;
      }

      const parsed = inboundSchema.safeParse(payload);
      if (!parsed.success) {
        socket.send(JSON.stringify({ event: "error", message: "Invalid payload", issues: parsed.error.issues }));
        return;
      }

      const session = await store.getSessionById(parsed.data.sessionId);
      if (!session || session.userId !== userId) {
        socket.send(JSON.stringify({ event: "error", message: "Session not found" }));
        return;
      }

      const scenario = await store.getScenarioById(session.scenarioId);
      if (!scenario) {
        socket.send(JSON.stringify({ event: "error", message: "Scenario not found" }));
        return;
      }

      await store.addMessage({
        sessionId: parsed.data.sessionId,
        role: "user",
        content: parsed.data.text
      });

      const user = store.getDemoUser();
      const output = await generateConversationReply({
        text: parsed.data.text,
        scenario,
        cefrLevel: user.cefrLevel,
        llm: app.env.llm
      });

      for (const chunk of output.chunks) {
        socket.send(JSON.stringify({ event: "reply.chunk", chunk }));
        await sleep(60);
      }

      const assistantMessage = await store.addMessage({
        sessionId: parsed.data.sessionId,
        role: "assistant",
        content: output.text,
        scoreJson: {
          provider: output.provider,
          model: output.model,
          routeReason: output.routeReason
        }
      });

      socket.send(
        JSON.stringify({
          event: "reply.done",
          message: assistantMessage,
          meta: {
            provider: output.provider,
            model: output.model,
            routeReason: output.routeReason
          }
        })
      );

      socket.send(
        JSON.stringify({
          event: "score.result",
          sessionId: parsed.data.sessionId,
          score: {
            pronunciation: 82,
            grammar: 79,
            vocabulary: 77,
            fluency: 81
          }
        })
      );
    });
  });
}
