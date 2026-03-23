import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "../migrations");
const connectionString = process.env.POSTGRES_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/englishbuddy";

async function main() {
  const pool = new Pool({ connectionString });

  try {
    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf-8");
      await pool.query(sql);
      process.stdout.write(`Applied migration ${file}\n`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Migration failed: ${String(error)}\n`);
  process.exit(1);
});
