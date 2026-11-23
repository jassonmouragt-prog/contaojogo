"use server";

import { and, between, eq, inArray, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  COMPETITION_STATUSES,
  MODALITIES,
  PHASE_TYPES,
  athletes,
  competitionGroups,
  competitionPhases,
  competitionTeams,
  competitions,
  matches,
  rosterEntries,
  teams,
  venues,
} from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { findScheduleConflicts, slotMinutesFor } from "@/domain/schedule/conflicts";
import {
  type ActionResult,
  clientIp,
  fail,
  firstIssue,
  formObject,
  isUniqueViolation,
  requireOrg,
} from "@/domain/shared/action-helpers";
import { authorizeAction } from "@/lib/auth/session";
import { publishMatchUpdate } from "@/lib/realtime";
import { formatDateTime, fromLocalInput } from "@/lib/datetime";
import { slugify } from "@/lib/slug";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function loadCompetition(tx: Tx, id: string, org: string) {
  const [c] = await tx
    .select()
    .from(competitions)
    .where(and(eq(competitions.id, id), eq(competitions.organizationId, org)));
  return c ?? null;
}

function revalidateCompetition(id: string) {
  revalidatePath(`/admin/competicoes/${id}`);
  revalidatePath("/admin/competicoes");
  revalidatePath("/campeonatos", "layout");
  revalidatePath("/");
}

const competitionSchema = z.object({
  id: z.uuid().optional(),
  name: z.string({ error: "Informe o nome." }).min(3, "Nome muito curto.").max(100),
  season: z.string({ error: "Informe a temporada." }).min(2).max(20),
  modality: z.enum(MODALITIES),
  status: z.enum(COMPETITION_STATUSES).optional(),
  city: z.string().max(80).optional(),
  description: z.string().max(2000).optional(),
  periodMinutes: z.coerce.number().int().min(5, "Mínimo 5 minutos.").max(60, "Máximo 60 minutos."),
  pointsWin: z.coerce.number().int().min(0).max(10),
  pointsDraw: z.coerce.number().int().min(0).max(10),
  pointsLoss: z.coerce.number().int().min(0).max(10),
  published: z.enum(["true", "false"]).optional(),
});

export async function saveCompetition(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = competitionSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, published, ...d } = parsed.data;
  const values = {
    ...d,
    city: d.city ?? null,
    description: d.description ?? null,
    slug: slugify(`${d.name}`),
    ...(published ? { published: published === "true" } : {}),
  };
  try {
    const result = await getDb().transaction(async (tx) => {
      if (id) {
        const before = await loadCompetition(tx, id, org);
        if (!before) return fail("Competição não encontrada.");
        await tx.update(competitions).set(values).where(eq(competitions.id, id));
        await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "competition.updated", entityType: "competition", entityId: id, before: { name: before.name, status: before.status, published: before.published, periodMinutes: before.periodMinutes }, after: { name: values.name, status: values.status, published: values.published, periodMinutes: values.periodMinutes }, ipAddress: await clientIp() });
        return { ok: true, message: "Competição salva.", id };
      }
      const [row] = await tx.insert(competitions).values({ ...values, organizationId: org }).returning({ id: competitions.id });
      // Fase inicial padrão para que a competição já possa receber equipes e jogos.
      await tx.insert(competitionPhases).values({ competitionId: row.id, name: "Fase de grupos", type: "GROUPS", sortOrder: 1 });
      await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "competition.created", entityType: "competition", entityId: row.id, after: { name: values.name, season: values.season }, ipAddress: await clientIp() });
      return { ok: true, message: "Competição criada.", id: row.id };
    });
    if (result?.id) revalidateCompetition(result.id);
    return result;
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe uma competição com esse nome.");
    throw e;
  }
}

const phaseSchema = z.object({
  competitionId: z.uuid(),
  name: z.string({ error: "Informe o nome." }).min(2).max(60),
  type: z.enum(PHASE_TYPES),
});

export async function createPhase(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = phaseSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { competitionId, name, type } = parsed.data;
  const res = await getDb().transaction(async (tx) => {
    if (!(await loadCompetition(tx, competitionId, org))) return fail("Competição não encontrada.");
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${competitionPhases.sortOrder}), 0) + 1` })
      .from(competitionPhases)
      .where(eq(competitionPhases.competitionId, competitionId));
    const [row] = await tx.insert(competitionPhases).values({ competitionId, name, type, sortOrder: next }).returning({ id: competitionPhases.id });
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "phase.created", entityType: "competition", entityId: competitionId, after: { name, type } });
    return { ok: true, message: "Fase criada.", id: row.id };
  });
  revalidateCompetition(competitionId);
  return res;
}

const groupSchema = z.object({ phaseId: z.uuid(), name: z.string({ error: "Informe o nome." }).min(1).max(30) });

export async function createGroup(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = groupSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  try {
    const res = await getDb().transaction(async (tx) => {
      const [phase] = await tx
        .select({ id: competitionPhases.id, competitionId: competitionPhases.competitionId })
        .from(competitionPhases)
        .innerJoin(competitions, eq(competitions.id, competitionPhases.competitionId))
        .where(and(eq(competitionPhases.id, parsed.data.phaseId), eq(competitions.organizationId, org)));
      if (!phase) return fail("Fase não encontrada.");
      const [{ next }] = await tx
        .select({ next: sql<number>`coalesce(max(${competitionGroups.sortOrder}), 0) + 1` })
        .from(competitionGroups)
        .where(eq(competitionGroups.phaseId, phase.id));
      await tx.insert(competitionGroups).values({ phaseId: phase.id, name: parsed.data.name, sortOrder: next });
      return { ok: true, message: "Grupo criado.", id: phase.competitionId };
    });
    if (res?.id) revalidateCompetition(res.id);
    return res;
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe um grupo com esse nome nesta fase.");
    throw e;
  }
}

const enrollSchema = z.object({
  competitionId: z.uuid(),
  teamId: z.uuid("Escolha a equipe."),
  groupId: z.uuid().optional(),
});

/** Inscreve a equipe e o elenco ativo dela (camisa atual vira a camisa da competição). */
export async function enrollTeam(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = enrollSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { competitionId, teamId, groupId } = parsed.data;
  try {
    const res = await getDb().transaction(async (tx) => {
      if (!(await loadCompetition(tx, competitionId, org))) return fail("Competição não encontrada.");
      const [team] = await tx.select({ id: teams.id, name: teams.name }).from(teams).where(and(eq(teams.id, teamId), eq(teams.organizationId, org)));
      if (!team) return fail("Equipe não encontrada.");
      if (groupId) {
        const [g] = await tx
          .select({ id: competitionGroups.id })
          .from(competitionGroups)
          .innerJoin(competitionPhases, eq(competitionPhases.id, competitionGroups.phaseId))
          .where(and(eq(competitionGroups.id, groupId), eq(competitionPhases.competitionId, competitionId)));
        if (!g) return fail("Grupo inválido.");
      }
      await tx.insert(competitionTeams).values({ competitionId, teamId, groupId: groupId ?? null });
      const squad = await tx
        .select({ id: athletes.id, shirtNumber: athletes.shirtNumber })
        .from(athletes)
        .where(and(eq(athletes.teamId, teamId), eq(athletes.active, true)));
      // Camisas repetidas no cadastro do clube ficam sem número na inscrição.
      const used = new Set<number>();
      const entries = squad.map((a) => {
        const n = a.shirtNumber != null && !used.has(a.shirtNumber) ? a.shirtNumber : null;
        if (n != null) used.add(n);
        return { competitionId, teamId, athleteId: a.id, shirtNumber: n };
      });
      if (entries.length) await tx.insert(rosterEntries).values(entries).onConflictDoNothing();
      await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "competition.team_enrolled", entityType: "competition", entityId: competitionId, after: { team: team.name, athletes: entries.length } });
      return { ok: true, message: `${team.name} inscrita com ${entries.length} atleta(s).` };
    });
    revalidateCompetition(competitionId);
    return res;
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Equipe já inscrita (ou atleta inscrito por outra equipe).");
    throw e;
  }
}

const matchSchema = z.object({
  competitionId: z.uuid(),
  phaseId: z.uuid().optional(),
  groupId: z.uuid().optional(),
  round: z.coerce.number().int().min(1).max(99).optional(),
  homeTeamId: z.uuid("Escolha o mandante."),
  awayTeamId: z.uuid("Escolha o visitante."),
  venueId: z.uuid().optional(),
  scheduledAt: z.string({ error: "Informe data e hora." }),
  refereeName: z.string().max(80).optional(),
});

export async function createMatch(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = matchSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  if (d.homeTeamId === d.awayTeamId) return fail("Mandante e visitante precisam ser diferentes.");
  const scheduledAt = fromLocalInput(d.scheduledAt);
  if (!scheduledAt) return fail("Data e hora inválidas.");

  const res = await getDb().transaction(async (tx) => {
    // Serializa criação de jogos da organização para a checagem de conflito ser confiável.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"schedule:" + org}))`);
    const comp = await loadCompetition(tx, d.competitionId, org);
    if (!comp) return fail("Competição não encontrada.");
    const enrolled = await tx
      .select({ teamId: competitionTeams.teamId })
      .from(competitionTeams)
      .where(and(eq(competitionTeams.competitionId, comp.id), inArray(competitionTeams.teamId, [d.homeTeamId, d.awayTeamId])));
    if (enrolled.length !== 2) return fail("As duas equipes precisam estar inscritas na competição.");
    if (d.venueId) {
      const [v] = await tx.select({ id: venues.id }).from(venues).where(and(eq(venues.id, d.venueId), eq(venues.organizationId, org)));
      if (!v) return fail("Local inválido.");
    }
    if (d.phaseId) {
      const [ph] = await tx.select({ id: competitionPhases.id }).from(competitionPhases).where(and(eq(competitionPhases.id, d.phaseId), eq(competitionPhases.competitionId, comp.id)));
      if (!ph) return fail("Fase inválida.");
    }
    const slot = slotMinutesFor(comp.periodMinutes);
    const windowStart = new Date(scheduledAt.getTime() - slot * 60_000);
    const windowEnd = new Date(scheduledAt.getTime() + slot * 60_000);
    const nearby = await tx
      .select({ id: matches.id, homeTeamId: matches.homeTeamId, awayTeamId: matches.awayTeamId, venueId: matches.venueId, scheduledAt: matches.scheduledAt })
      .from(matches)
      .where(
        and(
          eq(matches.organizationId, org),
          ne(matches.status, "CANCELLED"),
          ne(matches.status, "POSTPONED"),
          between(matches.scheduledAt, windowStart, windowEnd),
          or(
            inArray(matches.homeTeamId, [d.homeTeamId, d.awayTeamId]),
            inArray(matches.awayTeamId, [d.homeTeamId, d.awayTeamId]),
            d.venueId ? eq(matches.venueId, d.venueId) : sql`false`,
          ),
        ),
      );
    const conflicts = findScheduleConflicts({ homeTeamId: d.homeTeamId, awayTeamId: d.awayTeamId, venueId: d.venueId ?? null, scheduledAt }, nearby, slot);
    if (conflicts.length) {
      const c = conflicts[0];
      const when = nearby.find((m) => m.id === c.matchId)?.scheduledAt;
      return fail(
        c.kind === "team"
          ? `Conflito: uma das equipes já joga em ${when ? formatDateTime(when) : "horário próximo"}.`
          : `Conflito: o local já está ocupado em ${when ? formatDateTime(when) : "horário próximo"}.`,
      );
    }
    const [row] = await tx
      .insert(matches)
      .values({
        organizationId: org,
        competitionId: comp.id,
        phaseId: d.phaseId ?? null,
        groupId: d.groupId ?? null,
        round: d.round ?? null,
        homeTeamId: d.homeTeamId,
        awayTeamId: d.awayTeamId,
        venueId: d.venueId ?? null,
        scheduledAt,
        refereeName: d.refereeName ?? null,
      })
      .returning({ id: matches.id });
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "match.created", entityType: "match", entityId: row.id, after: { competition: comp.name, scheduledAt: scheduledAt.toISOString(), homeTeamId: d.homeTeamId, awayTeamId: d.awayTeamId }, ipAddress: await clientIp() });
    return { ok: true, message: "Jogo agendado.", id: row.id };
  });
  revalidateCompetition(d.competitionId);
  revalidatePath("/admin/jogos");
  return res;
}

const statusSchema = z.object({ matchId: z.uuid(), status: z.enum(["SCHEDULED", "POSTPONED", "CANCELLED"]) });

/** Adiar, cancelar ou reagendar (somente jogos que ainda não começaram). */
export async function setMatchScheduleStatus(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = statusSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const [m] = await tx.select().from(matches).where(and(eq(matches.id, parsed.data.matchId), eq(matches.organizationId, org))).for("update");
    if (!m) return fail("Jogo não encontrado.");
    if (!["SCHEDULED", "POSTPONED", "CANCELLED"].includes(m.status)) return fail("Jogo já iniciado não pode ser alterado aqui.");
    await tx.update(matches).set({ status: parsed.data.status, version: m.version + 1 }).where(eq(matches.id, m.id));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "match.status_changed", entityType: "match", entityId: m.id, before: { status: m.status }, after: { status: parsed.data.status } });
    return { ok: true, message: "Situação do jogo atualizada.", id: m.competitionId };
  });
  if (res?.id) revalidateCompetition(res.id);
  if (res?.ok) void publishMatchUpdate(parsed.data.matchId, Date.now());
  revalidatePath("/admin/jogos");
  return res;
}
