import { FastifyInstance } from "fastify";
import { getDataStore } from "../db/index.js";

export async function registerScenarioRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.authenticate }, async (request) => {
    const { category, difficulty } = request.query as { category?: string; difficulty?: string };

    return dbFilter(category, difficulty);
  });
}

async function dbFilter(category?: string, difficulty?: string) {
  const rows = await getDataStore().getScenarios();
  return rows.filter((item) => {
    const byCategory = category ? item.category === category : true;
    const byDifficulty = difficulty ? item.difficulty === difficulty : true;
    return byCategory && byDifficulty;
  });
}
