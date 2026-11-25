import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { matches } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { authorizeAction } from "@/lib/auth/session";
import { publish, realtimeConfigured } from "@/lib/realtime/cloudflare";

const body = z.object({ matchId: z.uuid(), mid: z.string().max(16), offer: z.object({ type: z.literal("offer"), sdp: z.string().max(20_000) }) });

/** Narrador começa a transmitir (perfil de operação, na própria organização). */
export async function POST(req: Request) {
  let actor;
  try { actor = await authorizeAction("match.operate"); } catch { return Response.json({ error: "Não autorizado." }, { status: 403 }); }
  if (!realtimeConfigured()) return Response.json({ error: "Narração ainda não configurada (Cloudflare)." }, { status: 503 });
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  const db = getDb();
  const [m] = await db.select({ id: matches.id }).from(matches).where(and(eq(matches.id, p.data.matchId), eq(matches.organizationId, actor.organizationId ?? "")));
  if (!m) return Response.json({ error: "Jogo não encontrado." }, { status: 404 });
  try {
    const { sessionId, answer } = await publish(p.data.offer, p.data.mid);
    await db.update(matches).set({ narrationSessionId: sessionId, narrationStartedAt: new Date() }).where(eq(matches.id, m.id));
    await recordAudit(db, { organizationId: actor.organizationId, actorUserId: actor.id, action: "match.narration.started", entityType: "match", entityId: m.id });
    return Response.json({ answer });
  } catch (e) {
    console.error("narration publish", e);
    return Response.json({ error: "Não foi possível iniciar a transmissão. Tente de novo." }, { status: 502 });
  }
}
