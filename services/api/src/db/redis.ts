import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;

export async function getRedisClient(url: string): Promise<RedisClient> {
  if (redisClient) {
    return redisClient;
  }

  const client = createClient({ url });
  client.on("error", () => {
    // Keep API resilient even when redis is not available.
  });
  await client.connect();
  redisClient = client;
  return client;
}
