import { config as dotenvConfig } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenvConfig({ path: path.resolve(__dirname, "../.env") });
dotenvConfig({ path: path.resolve(__dirname, "../../../.env") });

const app = createApp();

async function bootstrap() {
  try {
    await app.ready();
    await app.listen({ port: app.env.port, host: "0.0.0.0" });
    app.log.info(`API ready on :${app.env.port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

bootstrap();
