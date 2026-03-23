import { FastifyInstance } from "fastify";
import { z } from "zod";

const sttSchema = z.object({
  audioBase64: z.string().min(10)
});

const scoreSchema = z.object({
  audioBase64: z.string().min(10),
  referenceText: z.string().min(1)
});

const ttsSchema = z.object({
  text: z.string().min(1)
});

export async function registerSpeechRoutes(app: FastifyInstance) {
  app.post("/stt", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = sttSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const result = await fetch(`${app.env.speechServiceUrl}/api/v1/speech/stt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    }).then((res) => res.json());

    return result;
  });

  app.post("/score", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = scoreSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const result = await fetch(`${app.env.speechServiceUrl}/api/v1/speech/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    }).then((res) => res.json());

    return result;
  });

  app.post("/tts", { preHandler: app.authenticate }, async (request, reply) => {
    const parsed = ttsSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ message: "Invalid payload", issues: parsed.error.issues });
    }

    const result = await fetch(`${app.env.speechServiceUrl}/api/v1/speech/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data)
    }).then((res) => res.json());

    return result;
  });
}
