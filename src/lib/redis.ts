import { createClient } from 'redis';
import { env } from '../config/env';

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;
let connectPromise: Promise<RedisClient> | null = null;

function createRedisClient(): RedisClient {
  const nextClient = createClient({ url: env.redisUrl });

  nextClient.on('error', (error) => {
    process.emitWarning(
      `Redis client error: ${error instanceof Error ? error.message : String(error)}`,
      {
        code: 'REDIS_CLIENT_ERROR',
      },
    );
  });

  return nextClient;
}

export async function getRedisClient(): Promise<RedisClient> {
  if (client?.isOpen) {
    return client;
  }

  if (connectPromise) {
    return connectPromise;
  }

  if (!client) {
    client = createRedisClient();
  }

  connectPromise = client
    .connect()
    .then(() => client as RedisClient)
    .catch((error) => {
      client = null;
      throw error;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

export async function closeRedisClient(): Promise<void> {
  if (!client) {
    return;
  }

  if (client.isOpen) {
    await client.quit();
  }

  client = null;
  connectPromise = null;
}
