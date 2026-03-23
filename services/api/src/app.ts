import cors from "@fastify/cors";
import Fastify from "fastify";
import { configureDataStore } from "./db/index.js";
import { getRedisClient } from "./db/redis.js";
import { envPlugin } from "./plugins/env.js";
import { jwtPlugin } from "./plugins/jwt.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerScenarioRoutes } from "./routes/scenarios.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerSpeechRoutes } from "./routes/speech.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerWsRoutes } from "./routes/ws.js";

export function createApp() {
  const app = Fastify({ logger: true });

  app.register(envPlugin);
  app.register(cors, { origin: true });
  app.register(jwtPlugin);

  app.after(async () => {
    configureDataStore({
      mode: app.env.dataStoreMode,
      postgresUrl: app.env.postgresUrl
    });

    if (app.env.dataStoreMode === "postgres") {
      try {
        await getRedisClient(app.env.redisUrl);
      } catch {
        app.log.warn("Redis unavailable. Continue without cache.");
      }
    }
  });

  app.get("/health", async () => ({ ok: true, service: "api" }));

  app.register(registerAuthRoutes, { prefix: "/api/v1/auth" });
  app.register(registerScenarioRoutes, { prefix: "/api/v1/scenarios" });
  app.register(registerSessionRoutes, { prefix: "/api/v1/sessions" });
  app.register(registerSpeechRoutes, { prefix: "/api/v1/speech" });
  app.register(registerUserRoutes, { prefix: "/api/v1/users" });
  app.register(registerWsRoutes);

  return app;
}
