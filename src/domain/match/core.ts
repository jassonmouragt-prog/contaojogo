import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { competitions, matchEvents, matchStats, matchSyncOps, matches, rosterEntries } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { clockStateOf } from "@/domain/labels";
import { ClockTransitionError, endPeriod, kickOff, setBallInPlay, type ClockState } from "@/domain/match/clock";
import { canTransition, computeScore, validateStats } from "@/domain/match/rules";
import { clampClientTime, shouldApplyStats, type SyncOutcome } from "@/domain/match/sync-rules";
import type { MatchOp } from "@/domain/match/ops";

export type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];
type Actor = { id: string; organizationId: string };

export async function lockMatch(tx: Tx, matchId: string, org: string) {
  const [m] = await tx
    .select({ match: matches, periodMinutes: competitions.periodMinutes })
    .from(matches)
    .innerJoin(competitions, eq(competitions.id, matches.competitionId))
    .where(and(eq(matches.id, matchId), eq(matches.organizationId, org)))
    .for("update", { of: matches });
  return m ?? null;
}

function clockColumns(c: ClockState) {
  return {
    period: c.period,
    ballInPlay: c.ballInPlay,
    segmentStartedAt: c.segmentStartedAt === null ? null : new Date(c.segmentStartedAt),
    rollingMs: c.rollingMs,
    stoppedMs: c.stoppedMs,
  };
}

async function recomputeScore(tx: Tx, m: typeof matches.$inferSelect) {
  const evs = await tx
    .select({ type: matchEvents.type, teamId: matchEvents.teamId, voidedAt: matchEvents.voidedAt, detail: matchEvents.detail })
    .from(matchEvents)
    .where(eq(matchEvents.matchId, m.id));
  const s = computeScore(evs.map((e) => ({ type: e.type, teamId: e.teamId, voided: e.voidedAt !== null, ownGoal: e.detail.ownGoal })), m.homeTeamId, m.awayTeamId);
  await tx.update(matches).set({ homeScore: s.home, awayScore: s.away }).where(eq(matches.id, m.id));
}

export type OpResult = { clientOpId: string; outcome: SyncOutcome; message: string };

class Reject extends Error {}
const reject = (msg: string): never => {
  throw new Reject(msg);
};

/**
 * Aplica uma operação do operador em transação própria. Idempotente:
 * o client_op_id é reservado em match_sync_ops na mesma transação.
 * Conflitos: eventos são somente-acréscimo; estatísticas usam o horário
 * do aparelho (mais recente vence); comandos do cronômetro só valem se a
 * transição ainda for possível no estado atual (senão são recusados).
 */
export async function applyOp(actor: Actor, matchId: string, op: MatchOp): Promise<OpResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const row = await lockMatch(tx, matchId, actor.organizationId);
      if (!row) reject("Jogo não encontrado.");
      const m = row!.match;
      const reserved = await tx
        .insert(matchSyncOps)
        .values({ matchId, clientOpId: op.clientOpId, kind: op.kind, outcome: "applied" })
        .onConflictDoNothing()
        .returning({ id: matchSyncOps.clientOpId });
      if (reserved.length === 0) return { clientOpId: op.clientOpId, outcome: "duplicate" as const, message: "Já sincronizado." };
      if (m.status === "CONFIRMED") reject("Súmula já confirmada.");
      const serverNow = Date.now();
      let message = "";

      switch (op.kind) {
        case "clock": {
          const state = clockStateOf(m);
          const at = clampClientTime(op.at, serverNow, state.segmentStartedAt);
          let next: ClockState;
          let status = m.status;
          try {
            if (op.command === "KICK_OFF") {
              if (m.status === "SCHEDULED" && canTransition(m.status, "LIVE")) status = "LIVE";
              else if (m.status !== "LIVE") reject("Jogo não está em andamento.");
              next = kickOff(state, at);
            } else if (op.command === "END_PERIOD") next = endPeriod(state, at);
            else next = setBallInPlay(state, op.command === "RESUME", at);
          } catch (e) {
            if (e instanceof ClockTransitionError) reject(`Cronômetro: ${e.message}`);
            throw e;
          }
          await tx.update(matches).set({ ...clockColumns(next!), status }).where(eq(matches.id, m.id));
          message = "Cronômetro atualizado.";
          break;
        }
        case "event": {
          if (m.status !== "LIVE" && m.status !== "FINISHED") reject("Eventos só com o jogo iniciado.");
          if (op.teamId !== m.homeTeamId && op.teamId !== m.awayTeamId) reject("Equipe não pertence ao jogo.");
          for (const athleteId of [op.athleteId, op.assistAthleteId, op.playerOutId].filter((x): x is string => !!x)) {
            const [r] = await tx.select({ id: rosterEntries.id }).from(rosterEntries)
              .where(and(eq(rosterEntries.competitionId, m.competitionId), eq(rosterEntries.teamId, op.teamId), eq(rosterEntries.athleteId, athleteId)));
            if (!r) reject("Atleta não inscrito por esta equipe na competição.");
          }
          const inserted = await tx.insert(matchEvents).values({
            matchId: m.id, type: op.type, teamId: op.teamId, athleteId: op.athleteId, minute: op.minute,
            detail: { ownGoal: op.ownGoal, penalty: op.penalty, assistAthleteId: op.assistAthleteId ?? null, playerOutId: op.playerOutId ?? null },
            clientEventId: op.clientOpId, createdBy: actor.id,
          }).onConflictDoNothing().returning({ id: matchEvents.id });
          if (inserted.length && op.type === "GOAL") await recomputeScore(tx, m);
          message = "Evento registrado.";
          break;
        }
        case "void": {
          const [ev] = await tx.update(matchEvents).set({ voidedAt: new Date(), voidedBy: actor.id })
            .where(and(eq(matchEvents.matchId, m.id), isNull(matchEvents.voidedAt), eq(matchEvents.clientEventId, op.targetClientOpId)))
            .returning({ type: matchEvents.type });
          if (!ev) reject("Evento não encontrado ou já desfeito.");
          await recomputeScore(tx, m);
          message = "Evento desfeito.";
          break;
        }
        case "stats": {
          if (m.status === "SCHEDULED") reject("Inicie o jogo antes de lançar estatísticas.");
          const evs = await tx.select({ type: matchEvents.type, teamId: matchEvents.teamId, voidedAt: matchEvents.voidedAt, detail: matchEvents.detail }).from(matchEvents).where(eq(matchEvents.matchId, m.id));
          const score = computeScore(evs.map((e) => ({ type: e.type, teamId: e.teamId, voided: e.voidedAt !== null, ownGoal: e.detail.ownGoal })), m.homeTeamId, m.awayTeamId);
          const err = validateStats(op.home, score.home) ?? validateStats(op.away, score.away);
          if (err) reject(err);
          const [stored] = await tx.select({ updatedAt: matchStats.updatedAt }).from(matchStats).where(eq(matchStats.matchId, m.id)).limit(1);
          const at = clampClientTime(op.at, serverNow, null);
          if (!shouldApplyStats(at, stored?.updatedAt ?? null)) {
            message = "Estatísticas mais recentes já registradas.";
            break;
          }
          for (const [teamId, s] of [[m.homeTeamId, op.home], [m.awayTeamId, op.away]] as const) {
            await tx.insert(matchStats).values({ matchId: m.id, teamId, ...s, updatedAt: new Date(at) })
              .onConflictDoUpdate({ target: [matchStats.matchId, matchStats.teamId], set: { ...s, updatedAt: new Date(at) } });
          }
          message = "Estatísticas salvas.";
          break;
        }
      }
      await tx.update(matches).set({ version: m.version + 1 }).where(eq(matches.id, m.id));
      await recordAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.id, action: `match.op.${op.kind}`, entityType: "match", entityId: m.id, after: op });
      return { clientOpId: op.clientOpId, outcome: "applied" as const, message };
    });
  } catch (e) {
    if (!(e instanceof Reject)) throw e;
    // Registra a recusa (fora da transação desfeita) para o reenvio não repetir o erro.
    await getDb().insert(matchSyncOps).values({ matchId, clientOpId: op.clientOpId, kind: op.kind, outcome: "rejected", message: e.message }).onConflictDoNothing().catch(() => undefined);
    return { clientOpId: op.clientOpId, outcome: "rejected", message: e.message };
  }
}
