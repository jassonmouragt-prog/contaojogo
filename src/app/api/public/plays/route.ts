import { and, desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { competitions, matchPlays, matches } from "@/db/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** Últimos lances do campinho de uma partida publicada. GET /api/public/plays?match=uuid */
export async function GET(req: Request) {
  await connection();
  if (!rateLimit(`plays:${clientKey(req.headers)}`, 90, 60_000)) return Response.json({ plays: [] }, { status: 429 });
  const id = new URL(req.url).searchParams.get("match") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ plays: [] });
  const rows = await getDb()
    .select({ id: matchPlays.id, teamId: matchPlays.teamId, kind: matchPlays.kind, x: matchPlays.x, y: matchPlays.y })
    .from(matchPlays)
    .innerJoin(matches, eq(matches.id, matchPlays.matchId))
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(eq(matchPlays.matchId, id), eq(competitions.published, true)))
    .orderBy(desc(matchPlays.createdAt))
    .limit(8);
  return Response.json({ plays: rows.reverse() }, { headers: { "Cache-Control": "no-store" } });
}
