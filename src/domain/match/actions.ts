"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { competitions, matchStats, matches } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { canTransition } from "@/domain/match/rules";
import { type ActionResult, fail, requireOrg } from "@/domain/shared/action-helpers";
import { authorizeAction } from "@/lib/auth/session";
import { publishMatchUpdate } from "@/lib/realtime";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function lockMatch(tx: Tx, matchId: string, org: string) {
  const [m] = await tx
    .select({ match: matches, periodMinutes: competitions.periodMinutes })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(eq(matches.id, matchId), eq(matches.organizationId, org)))
    .for("update", { of: matches });
  return m ?? null;
}

/** Chamado após o commit: revalida páginas e avisa o realtime. */
function revalidateMatch(id: string) {
  void publishMatchUpdate(id, Date.now());
  revalidatePath(`/admin/jogos/${id}`);
  revalidatePath(`/jogos/${id}`);
  revalidatePath("/");
}


/** Operador encerra a súmula (exige 2º tempo encerrado e estatísticas lançadas). */
export async function finishMatch(input: { matchId: string }): Promise<ActionResult> {
  const actor = await authorizeAction("match.operate");
  const org = requireOrg(actor);
  const p = z.object({ matchId: z.uuid() }).safeParse(input);
  if (!p.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const row = await lockMatch(tx, p.data.matchId, org);
    if (!row) return fail("Jogo não encontrado.");
    const m = row.match;
    if (!canTransition(m.status, "FINISHED")) return fail("O jogo não está em andamento.");
    if (m.period !== "FINISHED") return fail("Encerre o 2º tempo no cronômetro antes de fechar a súmula.");
    const stats = await tx.select().from(matchStats).where(eq(matchStats.matchId, m.id));
    if (stats.length < 2) return fail("Lance as estatísticas finais das duas equipes.");
    await tx.update(matches).set({ status: "FINISHED", version: m.version + 1 }).where(eq(matches.id, m.id));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "match.finished", entityType: "match", entityId: m.id, after: { homeScore: m.homeScore, awayScore: m.awayScore } });
    return { ok: true, message: "Súmula encerrada. Aguardando conferência do administrador." };
  });
  revalidateMatch(p.data.matchId);
  return res;
}

/** Administrador confere e confirma: só então o resultado alimenta a classificação. */
export async function confirmMatch(input: { matchId: string; reopen?: boolean }): Promise<ActionResult> {
  const actor = await authorizeAction("match.confirm");
  const org = requireOrg(actor);
  const p = z.object({ matchId: z.uuid(), reopen: z.boolean().optional() }).safeParse(input);
  if (!p.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const row = await lockMatch(tx, p.data.matchId, org);
    if (!row) return fail("Jogo não encontrado.");
    const m = row.match;
    const to = p.data.reopen ? "LIVE" : "CONFIRMED";
    if (!canTransition(m.status, to)) return fail("Situação do jogo não permite esta ação.");
    await tx
      .update(matches)
      .set(p.data.reopen ? { status: "LIVE", version: m.version + 1 } : { status: "CONFIRMED", confirmedAt: new Date(), confirmedBy: actor.id, version: m.version + 1 })
      .where(eq(matches.id, m.id));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: p.data.reopen ? "match.reopened" : "match.confirmed", entityType: "match", entityId: m.id, after: { homeScore: m.homeScore, awayScore: m.awayScore } });
    return { ok: true, message: p.data.reopen ? "Súmula reaberta para correção." : "Resultado confirmado e publicado." };
  });
  revalidateMatch(p.data.matchId);
  return res;
}
