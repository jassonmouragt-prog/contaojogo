import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { matches } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { authorizeAction } from "@/lib/auth/session";

export async function POST(req: Request) {
  let actor;
  try { actor = await authorizeAction("match.operate"); } catch { return Response.json({ error: "Não autorizado." }, { status: 403 }); }
  const p = z.object({ matchId: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return Response.json({ error: "Dados inválidos." }, { status: 400 });
  const db = getDb();
  const done = await db.update(matches).set({ narrationSessionId: null, narrationStartedAt: null })
    .where(and(eq(matches.id, p.data.matchId), eq(matches.organizationId, actor.organizationId ?? ""))).returning({ id: matches.id });
  if (done.length) await recordAudit(db, { organizationId: actor.organizationId, actorUserId: actor.id, action: "match.narration.stopped", entityType: "match", entityId: p.data.matchId });
  return Response.json({ ok: true });
}
