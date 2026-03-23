import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { FastifyInstance } from "fastify";

export const jwtPlugin = fp(async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: app.env.jwtSecret
  });

  app.decorate("authenticate", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });
});

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
  }
}
