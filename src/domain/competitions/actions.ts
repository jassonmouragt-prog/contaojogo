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
  imageRefOrNull,
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
  periodMinutes: z.coerce.number().int().min(5, "Mínimo 5 minutos.").max(60, "Máximo 60 minutos.").optional(),
  intervalMinutes: z.coerce.number().int().min(0).max(60, "Intervalo de até 60 minutos.").optional(),
  timeoutsPerHalf: z.coerce.number().int().min(0).max(3).optional(),
  pointsWin: z.coerce.number().int().min(0).max(10).optional(),
  pointsDraw: z.coerce.number().int().min(0).max(10).optional(),
  pointsLoss: z.coerce.number().int().min(0).max(10).optional(),
  published: z.enum(["true", "false"]).optional(),
  logoUrl: z.string().max(300).optional(),
  keepLogo: z.string().optional(),
});

export async function saveCompetition(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = competitionSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, published, logoUrl, keepLogo, ...d } = parsed.data;
  const logo = imageRefOrNull(logoUrl);
  if (logo === false) return fail("Logo inválida.");
  const values = {
    ...d,
    // Novo cadastro: tempo padrão pela modalidade e pontuação 3/1/0 (ajustáveis no Regulamento).
    periodMinutes: d.periodMinutes ?? (d.modality === "FUTSAL" ? 20 : 45),
    intervalMinutes: d.intervalMinutes ?? (d.modality === "FUTSAL" ? 10 : 15),
    timeoutsPerHalf: d.timeoutsPerHalf ?? 1,
    ...(id ? {} : { pointsWin: d.pointsWin ?? 3, pointsDraw: d.pointsDraw ?? 1, pointsLoss: d.pointsLoss ?? 0 }),
    city: d.city ?? null,
    description: d.description ?? null,
    slug: slugify(`${d.name}`),
    ...(logo || !id || !keepLogo ? { logoUrl: logo } : {}),
    ...(published ? { published: published === "true" } : {}),
  };
  try {
    const result = await getDb().transaction(async (tx) => {
      if (id) {
        const before = await loadCompetition(tx, id, org);
        if (!before) return fail("Competição não encontrada.");
        await tx.update(competitions).set(values).where(eq(competitions.id, id));
        await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "competition.updated", entityType: "competition", entityId: id, before: { name: before.name, status: before.status, published: before.published, periodMinutes: before.periodMinutes }, after: { name: values.name, status: values.status, published: values.published, periodMinutes: values.periodMinutes }, ipAddress: await clientIp() });
        return { ok: true, message: "Alterações salvas.", id };
      }
      const [row] = await tx.insert(competitions).values({ ...values, organizationId: org }).returning({ id: competitions.id });
      // Fase inicial padrão para que a competição já possa receber equipes e jogos.
      await tx.insert(competitionPhases).values({ competitionId: row.id, name: "Fase de grupos", type: "GROUPS", sortOrder: 1 });
      await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "competition.created", entityType: "competition", entityId: row.id, after: { name: values.name, season: values.season }, ipAddress: await clientIp() });
      return { ok: true, message: "Competição criada. Agora inscreva as equipes.", id: row.id };
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
  phaseId: z.union([z.uuid(), z.enum(["Oitavas de final", "Quartas de final", "Semifinal", "Disputa de 3º lugar", "Final"].map((n) => `new:${n}`) as [string, ...string[]])]).optional(),
  groupId: z.uuid().optional(),
  round: z.coerce.number().int().min(1).max(99).optional(),
  homeTeamId: z.uuid("Escolha o mandante."),
  awayTeamId: z.uuid("Escolha o visitante."),
  venueId: z.uuid().optional(),
  scheduledAt: z.string({ error: "Informe data e hora." }),
  referee: z.string().max(60).optional(),
  assistant1: z.string().max(60).optional(),
  assistant2: z.string().max(60).optional(),
  timekeeper: z.string().max(60).optional(),
});

/** Futsal: "Fulano (1º árbitro) · Ciclano (2º árbitro) · Beltrano (anotador) · Sicrano (cronometrista)". */
function futsalRefereeLine(r?: string, r2?: string, scorer?: string, timer?: string): string | null {
  const parts = [[r, "1º árbitro"], [r2, "2º árbitro"], [scorer, "anotador"], [timer, "cronometrista"]]
    .filter(([n]) => n?.trim()).map(([n, role]) => `${n!.trim()} (${role})`);
  return parts.length ? parts.join(" · ") : null;
}

/** "Fulano (árbitro) · Ciclano e Beltrano (auxiliares)". */
function refereeLine(r?: string, a1?: string, a2?: string): string | null {
  const aux = [a1, a2].map((v) => v?.trim()).filter(Boolean);
  const parts = [r?.trim() ? `${r.trim()} (árbitro)` : "", aux.length ? `${aux.join(" e ")} (${aux.length > 1 ? "auxiliares" : "auxiliar"})` : ""].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

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
    let phaseId: string | null = null;
    if (d.phaseId?.startsWith("new:")) {
      const name = d.phaseId.slice(4);
      const existing = await tx.select({ id: competitionPhases.id, name: competitionPhases.name }).from(competitionPhases).where(eq(competitionPhases.competitionId, comp.id));
      const found = existing.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (found) phaseId = found.id;
      else {
        const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${competitionPhases.sortOrder}),0)+1` }).from(competitionPhases).where(eq(competitionPhases.competitionId, comp.id));
        const [ph] = await tx.insert(competitionPhases).values({ competitionId: comp.id, name, type: "KNOCKOUT", sortOrder: next }).returning({ id: competitionPhases.id });
        phaseId = ph.id;
      }
    } else if (d.phaseId) {
      const [ph] = await tx.select({ id: competitionPhases.id }).from(competitionPhases).where(and(eq(competitionPhases.id, d.phaseId), eq(competitionPhases.competitionId, comp.id)));
      if (!ph) return fail("Fase inválida.");
      phaseId = ph.id;
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
        phaseId,
        groupId: d.groupId ?? null,
        round: d.round ?? null,
        homeTeamId: d.homeTeamId,
        awayTeamId: d.awayTeamId,
        venueId: d.venueId ?? null,
        scheduledAt,
        refereeName: comp.modality === "FUTSAL" ? futsalRefereeLine(d.referee, d.assistant1, d.assistant2, d.timekeeper) : refereeLine(d.referee, d.assistant1, d.assistant2),
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

/** Publica ou retira a competição do site com um clique. */
export async function togglePublished(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const c = await loadCompetition(tx, id.data, org);
    if (!c) return fail("Competição não encontrada.");
    const published = !c.published;
    await tx.update(competitions).set({ published, ...(published && c.status === "DRAFT" ? { status: "ONGOING" as const } : {}) }).where(eq(competitions.id, c.id));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "competition.updated", entityType: "competition", entityId: c.id, before: { published: c.published }, after: { published } });
    return { ok: true, message: published ? "Competição publicada no site." : "Competição retirada do site.", id: c.id };
  });
  if (res?.id) revalidateCompetition(res.id);
  return res;
}
