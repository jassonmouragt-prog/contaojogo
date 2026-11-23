import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { getServerEnv } from "@/lib/env";

/** Verificação de saúde: aplicação no ar e conectividade com o PostgreSQL. */
export async function GET() {
  await connection();
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    return Response.json({ status: "degraded", database: "not_configured" }, { status: 503 });
  }
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", database: "up" });
  } catch {
    return Response.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
