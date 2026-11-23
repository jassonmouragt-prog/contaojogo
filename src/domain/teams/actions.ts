"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { POSITIONS, athletes, teams, venues } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
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
import { slugify } from "@/lib/slug";

const teamSchema = z.object({
  id: z.uuid().optional(),
  name: z.string({ error: "Informe o nome." }).min(2, "Nome muito curto.").max(80),
  shortName: z.string().max(20).optional(),
  city: z.string().max(80).optional(),
  crestUrl: z.string().max(300).optional(),
  keepCrest: z.string().optional(),
});

export async function saveTeam(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = teamSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, crestUrl, keepCrest, ...data } = parsed.data;
  const crest = imageRefOrNull(crestUrl);
  if (crest === false) return fail("Escudo inválido.");
  const values = {
    ...data, shortName: data.shortName ?? null, city: data.city ?? null, slug: slugify(data.name),
    // Na edição, sem nova imagem o escudo atual é mantido.
    ...(crest || !id || !keepCrest ? { crestUrl: crest } : {}),
  };
  if (!values.slug) return fail("Nome inválido.");
  try {
    const result = await getDb().transaction(async (tx) => {
      if (id) {
        const [before] = await tx.select().from(teams).where(and(eq(teams.id, id), eq(teams.organizationId, org))).for("update");
        if (!before) return fail("Equipe não encontrada.");
        await tx.update(teams).set(values).where(eq(teams.id, id));
        await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "team.updated", entityType: "team", entityId: id, before: { name: before.name, city: before.city }, after: values, ipAddress: await clientIp() });
        return { ok: true, message: "Equipe atualizada.", id };
      }
      const [row] = await tx.insert(teams).values({ ...values, organizationId: org }).returning({ id: teams.id });
      await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "team.created", entityType: "team", entityId: row.id, after: values, ipAddress: await clientIp() });
      return { ok: true, message: "Equipe cadastrada.", id: row.id };
    });
    revalidatePath("/admin/equipes");
    return result;
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe uma equipe com esse nome.");
    throw e;
  }
}

const athleteSchema = z.object({
  id: z.uuid().optional(),
  teamId: z.uuid("Equipe inválida."),
  name: z.string({ error: "Informe o nome." }).min(2, "Nome muito curto.").max(80),
  nickname: z.string().max(40).optional(),
  position: z.enum(POSITIONS).optional(),
  shirtNumber: z.coerce.number().int().min(0).max(99).optional(),
  birthDate: z.iso.date().optional(),
  active: z.enum(["true", "false"]).optional(),
  photoUrl: z.string().max(300).optional(),
  keepPhoto: z.string().optional(),
});

export async function saveAthlete(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = athleteSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const { id, active, photoUrl, keepPhoto, ...d } = parsed.data;
  const photo = imageRefOrNull(photoUrl);
  if (photo === false) return fail("Foto inválida.");
  const values = {
    ...(photo || !id || !keepPhoto ? { photoUrl: photo } : {}),
    teamId: d.teamId,
    name: d.name,
    nickname: d.nickname ?? null,
    position: d.position ?? null,
    shirtNumber: d.shirtNumber ?? null,
    birthDate: d.birthDate ?? null,
    ...(active ? { active: active === "true" } : {}),
  };
  const db = getDb();
  const [team] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, d.teamId), eq(teams.organizationId, org)));
  if (!team) return fail("Equipe não encontrada.");

  const result = await db.transaction(async (tx) => {
    if (id) {
      const [before] = await tx.select().from(athletes).where(and(eq(athletes.id, id), eq(athletes.organizationId, org))).for("update");
      if (!before) return fail("Atleta não encontrado.");
      await tx.update(athletes).set(values).where(eq(athletes.id, id));
      await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "athlete.updated", entityType: "athlete", entityId: id, before: { name: before.name, teamId: before.teamId, shirtNumber: before.shirtNumber, active: before.active }, after: { ...values, birthDate: undefined }, ipAddress: await clientIp() });
      return { ok: true, message: "Atleta atualizado.", id };
    }
    const [row] = await tx.insert(athletes).values({ ...values, organizationId: org }).returning({ id: athletes.id });
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "athlete.created", entityType: "athlete", entityId: row.id, after: { name: values.name, teamId: values.teamId }, ipAddress: await clientIp() });
    return { ok: true, message: "Atleta cadastrado.", id: row.id };
  });
  revalidatePath(`/admin/equipes/${d.teamId}`);
  return result;
}

const venueSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2, "Nome muito curto.").max(80),
  city: z.string().max(80).optional(),
});

export async function createVenue(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = venueSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  try {
    const [row] = await getDb().transaction(async (tx) => {
      const r = await tx.insert(venues).values({ organizationId: org, name: parsed.data.name, city: parsed.data.city ?? null }).returning({ id: venues.id });
      await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "venue.created", entityType: "venue", entityId: r[0].id, after: parsed.data });
      return r;
    });
    revalidatePath("/admin/locais");
    return { ok: true, message: "Local cadastrado.", id: row.id };
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe um local com esse nome.");
    throw e;
  }
}

const toggleSchema = z.object({ id: z.uuid(), active: z.enum(["true", "false"]) });

export async function setAthleteActive(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = toggleSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail("Dados inválidos.");
  const active = parsed.data.active === "true";
  const res = await getDb().transaction(async (tx) => {
    const [a] = await tx.select().from(athletes).where(and(eq(athletes.id, parsed.data.id), eq(athletes.organizationId, org))).for("update");
    if (!a) return fail("Atleta não encontrado.");
    await tx.update(athletes).set({ active }).where(eq(athletes.id, a.id));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "athlete.updated", entityType: "athlete", entityId: a.id, before: { active: a.active }, after: { active } });
    return { ok: true, message: active ? "Atleta reativado." : "Atleta desativado.", id: a.teamId ?? undefined };
  });
  if (res?.id) revalidatePath(`/admin/equipes/${res.id}`);
  return res;
}

const bulkSchema = z.object({ teamId: z.uuid(), lines: z.string().min(2).max(10_000) });

/**
 * Cadastro rápido: um atleta por linha, número opcional no início.
 * Ex.: "9 Pedro Lima", "10 - João Vitor", "Rafael".
 */
export async function bulkAddAthletes(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("competition.manage");
  const org = requireOrg(actor);
  const parsed = bulkSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail("Digite pelo menos um nome.");
  const rows = parsed.data.lines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d{1,2})\s*[-–.:]?\s*(.+)$/);
      return m ? { shirtNumber: Number(m[1]), name: m[2].trim() } : { shirtNumber: null, name: l };
    })
    .filter((r) => r.name.length >= 2 && r.name.length <= 80);
  if (rows.length === 0) return fail("Nenhum nome válido.");
  if (rows.length > 60) return fail("Máximo de 60 atletas por vez.");
  const db = getDb();
  const [team] = await db.select({ id: teams.id }).from(teams).where(and(eq(teams.id, parsed.data.teamId), eq(teams.organizationId, org)));
  if (!team) return fail("Equipe não encontrada.");
  await db.transaction(async (tx) => {
    await tx.insert(athletes).values(rows.map((r) => ({ ...r, organizationId: org, teamId: team.id })));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "athlete.created", entityType: "team", entityId: team.id, after: { quantidade: rows.length } });
  });
  revalidatePath(`/admin/equipes/${team.id}`);
  return { ok: true, message: `${rows.length} atleta(s) adicionado(s).` };
}
