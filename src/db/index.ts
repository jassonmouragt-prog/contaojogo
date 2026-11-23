import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { requireEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = NeonDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Database; __pool?: Pool };

/**
 * Cliente Drizzle sobre o driver WebSocket do Neon (suporta transações
 * interativas, necessárias para eventos de partida e prevenção de duplicidade).
 */
export function getDb(): Database {
  if (!globalForDb.__db) {
    const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
    globalForDb.__pool = pool;
    globalForDb.__db = drizzle({ client: pool, schema, casing: "snake_case" });
  }
  return globalForDb.__db;
}

export { schema };
