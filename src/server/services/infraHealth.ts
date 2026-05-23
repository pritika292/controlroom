import { getPool } from "../db/pool.js";
import { getRedis } from "./redis.js";

export interface InfraHealth {
  postgres: { up: boolean; latencyMs: number | null };
  redis: { up: boolean; latencyMs: number | null };
}

// Ping Postgres with a constant-time SELECT 1 and Redis with PING, both in
// parallel. A bad shared service shouldn't take the whole infra panel down,
// so each side is wrapped in try/catch.

export async function infraHealth(): Promise<InfraHealth> {
  const [postgres, redis] = await Promise.all([pingPostgres(), pingRedis()]);
  return { postgres, redis };
}

async function pingPostgres(): Promise<InfraHealth["postgres"]> {
  const pool = getPool();
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return { up: true, latencyMs: Date.now() - start };
  } catch {
    return { up: false, latencyMs: null };
  }
}

async function pingRedis(): Promise<InfraHealth["redis"]> {
  const client = getRedis();
  const start = Date.now();
  try {
    await client.ping();
    return { up: true, latencyMs: Date.now() - start };
  } catch {
    return { up: false, latencyMs: null };
  }
}
