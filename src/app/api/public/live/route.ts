import { and, eq, inArray } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { competitions, matches } from "@/db/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * Estado mínimo das partidas (versão + placar + relógio) para os clientes
 * decidirem se precisam atualizar. Usado no polling e após reconexão.
 * GET /api/public/live?ids=uuid,uuid
 */
export async function GET(req: Request) {
  await connection();
  if (!rateLimit(`live:${clientKey(req.headers)}`, 120, 60_000)) return Response.json({ matches: [] }, { status: 429 });
  const ids = (new URL(req.url).searchParams.get("ids") ?? "")
    .split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, 100);
  if (ids.length === 0) return Response.json({ matches: [] });
  const rows = await getDb()
    .select({ id: matches.id, version: matches.version, status: matches.status })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(inArray(matches.id, ids), eq(competitions.published, true)));
  return Response.json({ matches: rows }, { headers: { "Cache-Control": "no-store" } });
}
