"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { POSITIONS, athletes, competitionTeams, matches, rosterEntries } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { type ActionResult, fail } from "@/domain/shared/action-helpers";
import { authorizeAction } from "@/lib/auth/session";

const schema = z.object({
  matchId: z.uuid(),
  teamId: z.uuid(),
  name: z.string().trim().min(2, "Digite o nome do jogador.").max(80),
  shirtNumber: z.number().int().min(0).max(99).nullable(),
  position: z.enum(POSITIONS).nullable(),
});

/**
 * Cadastro rápido na hora do jogo (painel do operador): o jogador entra
 * definitivamente no time e no elenco das competições em que o time está inscrito.
 */
export async function quickAddPlayer(input: z.input<typeof schema>): Promise<ActionResult> {
  const actor = await authorizeAction("match.operate");
  const p = schema.safeParse(input);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Dados inválidos.");
  const d = p.data;
  const db = getDb();
  const res = await db.transaction(async (tx) => {
    const [m] = await tx.select({ id: matches.id, competitionId: matches.competitionId, home: matches.homeTeamId, away: matches.awayTeamId, org: matches.organizationId })
      .from(matches).where(and(eq(matches.id, d.matchId), eq(matches.organizationId, actor.organizationId ?? "")));
    if (!m) return fail("Jogo não encontrado.");
    if (d.teamId !== m.home && d.teamId !== m.away) return fail("Equipe não pertence ao jogo.");
    if (d.shirtNumber != null) {
      const [taken] = await tx.select({ id: rosterEntries.id }).from(rosterEntries)
        .where(and(eq(rosterEntries.competitionId, m.competitionId), eq(rosterEntries.teamId, d.teamId), eq(rosterEntries.shirtNumber, d.shirtNumber)));
      if (taken) return fail(`A camisa ${d.shirtNumber} já é de outro jogador deste time.`);
    }
    const [a] = await tx.insert(athletes).values({ organizationId: m.org, teamId: d.teamId, name: d.name, shirtNumber: d.shirtNumber, position: d.position })
      .returning({ id: athletes.id });
    const comps = await tx.select({ id: competitionTeams.competitionId }).from(competitionTeams).where(eq(competitionTeams.teamId, d.teamId));
    const ids = new Set([m.competitionId, ...comps.map((c) => c.id)]);
    await tx.insert(rosterEntries).values([...ids].map((cid) => ({ competitionId: cid, teamId: d.teamId, athleteId: a.id, shirtNumber: d.shirtNumber }))).onConflictDoNothing();
    await recordAudit(tx, { organizationId: m.org, actorUserId: actor.id, action: "athlete.quick_added", entityType: "athlete", entityId: a.id, after: { name: d.name, shirtNumber: d.shirtNumber, matchId: m.id } });
    return { ok: true, message: `${d.name} cadastrado no time.`, id: a.id } as ActionResult;
  });
  if (res?.ok) revalidatePath(`/admin/jogos/${d.matchId}`);
  return res;
}
