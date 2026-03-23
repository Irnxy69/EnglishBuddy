import { Pool } from "pg";
import { DataStore } from "./contracts.js";
import { memoryStore } from "./memoryStore.js";
import { createPostgresStore } from "./postgresStore.js";

let store: DataStore = memoryStore;

export function configureDataStore(config: { mode: "memory" | "postgres"; postgresUrl: string }) {
  if (config.mode === "postgres") {
    const pool = new Pool({ connectionString: config.postgresUrl });
    store = createPostgresStore(pool);
    return;
  }

  store = memoryStore;
}

export function getDataStore(): DataStore {
  return store;
}
