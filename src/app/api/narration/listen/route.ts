import { and, eq, isNotNull } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/db";
import { competitions, matches } from "@/db/schema";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { realtimeConfigured, subscribe } from "@/lib/realtime/cloudflare";

/** Torcedor pede para ouvir: devolve a oferta do SFU para a faixa do narrador. */
export async function POST(req: Request) {
  await connection();
  if (!rateLimit(`listen:${clientKey(req.headers)}`, 20, 60_000)) return Response.json({ error: "Muitas tentativas." }, { status: 429 });
  if (!realtimeConfigured()) return Response.json({ error: "Narração indisponível." }, { status: 503 });
  const { matchId } = (await req.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId || !/^[0-9a-f-]{36}$/i.test(matchId)) return Response.json({ error: "Jogo inválido." }, { status: 400 });
  const [m] = await getDb().select({ sid: matches.narrationSessionId }).from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(eq(matches.id, matchId), eq(competitions.published, true), isNotNull(matches.narrationSessionId)));
  if (!m?.sid) return Response.json({ error: "A narração não está no ar." }, { status: 404 });
  try {
    return Response.json(await subscribe(m.sid));
  } catch (e) {
    console.error("narration listen", e);
    return Response.json({ error: "Não foi possível conectar à narração." }, { status: 502 });
  }
}

/** Situação da narração (para o player aparecer/sumir sem recarregar). */
export async function GET(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("match") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ on: false });
  const [m] = await getDb().select({ sid: matches.narrationSessionId }).from(matches).where(eq(matches.id, id));
  return Response.json({ on: Boolean(m?.sid) && realtimeConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
