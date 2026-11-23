"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import {
  SPONSOR_PLACEMENTS, TICKET_STATUSES, documents, heroSlides, newsPosts, nominationPolls, nominations, pollFinalists, sponsors, supportTickets, ticketMessages,
} from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { type ActionResult, fail, firstIssue, formObject, isUniqueViolation, requireOrg } from "@/domain/shared/action-helpers";
import { authorizeAction } from "@/lib/auth/session";
import { fromLocalInput } from "@/lib/datetime";
import { slugify } from "@/lib/slug";

const httpsUrl = z.url({ protocol: /^https$/, error: "Use um endereço https://" });
const optDate = z.string().optional().transform((v) => (v ? fromLocalInput(v) : null));

// ===== Patrocinadores =====
const sponsorSchema = z.object({
  name: z.string({ error: "Informe o nome." }).min(2).max(80),
  logoUrl: httpsUrl,
  linkUrl: httpsUrl.optional(),
  durationSeconds: z.coerce.number().int().min(2).max(30).default(4),
  startsAt: optDate,
  endsAt: optDate,
});

export async function createSponsor(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const parsed = sponsorSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const placements = fd.getAll("placements").map(String).filter((p) => (SPONSOR_PLACEMENTS as readonly string[]).includes(p));
  if (placements.length === 0) return fail("Escolha pelo menos uma posição.");
  const d = parsed.data;
  await getDb().transaction(async (tx) => {
    const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${sponsors.sortOrder}),0)+1` }).from(sponsors).where(eq(sponsors.organizationId, org));
    const [row] = await tx.insert(sponsors).values({ organizationId: org, name: d.name, logoUrl: d.logoUrl, linkUrl: d.linkUrl ?? null, durationSeconds: d.durationSeconds, startsAt: d.startsAt, endsAt: d.endsAt, placements, sortOrder: next }).returning({ id: sponsors.id });
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "sponsor.created", entityType: "sponsor", entityId: row.id, after: { name: d.name, placements } });
  });
  revalidatePath("/admin/patrocinadores");
  revalidatePath("/", "layout");
  return { ok: true, message: "Patrocinador cadastrado." };
}

export async function updateSponsor(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const p = z.object({ id: z.uuid(), op: z.enum(["toggle", "up", "down"]) }).safeParse(formObject(fd));
  if (!p.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const list = await tx.select().from(sponsors).where(eq(sponsors.organizationId, org)).orderBy(sponsors.sortOrder);
    const i = list.findIndex((s) => s.id === p.data.id);
    if (i < 0) return fail("Patrocinador não encontrado.");
    if (p.data.op === "toggle") {
      await tx.update(sponsors).set({ active: !list[i].active }).where(eq(sponsors.id, list[i].id));
    } else {
      const j = p.data.op === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return { ok: true, message: "Nenhuma alteração." };
      [list[i], list[j]] = [list[j], list[i]];
      for (let k = 0; k < list.length; k++) await tx.update(sponsors).set({ sortOrder: k + 1 }).where(eq(sponsors.id, list[k].id));
    }
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: `sponsor.${p.data.op}`, entityType: "sponsor", entityId: p.data.id });
    return { ok: true, message: "Patrocinador atualizado." };
  });
  revalidatePath("/admin/patrocinadores");
  revalidatePath("/", "layout");
  return res;
}

// ===== Notícias e documentos =====
const newsSchema = z.object({
  title: z.string({ error: "Informe o título." }).min(4).max(140),
  summary: z.string().max(280).optional(),
  body: z.string({ error: "Escreva o texto." }).min(10).max(20000),
  coverUrl: httpsUrl.optional(),
  competitionId: z.uuid().optional(),
  publishAt: optDate,
  expiresAt: optDate,
  published: z.enum(["true", "false"]).default("false"),
});

export async function createNews(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const parsed = newsSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  try {
    await getDb().transaction(async (tx) => {
      const [row] = await tx.insert(newsPosts).values({
        organizationId: org, title: d.title, slug: slugify(d.title), summary: d.summary ?? null, body: d.body, coverUrl: d.coverUrl ?? null,
        competitionId: d.competitionId ?? null, published: d.published === "true", publishAt: d.publishAt ?? new Date(), expiresAt: d.expiresAt, authorId: actor.id,
      }).returning({ id: newsPosts.id });
      await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "news.created", entityType: "news", entityId: row.id, after: { title: d.title, published: d.published } });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Já existe uma notícia com esse título.");
    throw e;
  }
  revalidatePath("/admin/conteudo");
  revalidatePath("/noticias");
  return { ok: true, message: "Notícia salva." };
}

export async function toggleNews(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const [row] = await getDb().update(newsPosts).set({ published: sql`not ${newsPosts.published}` }).where(and(eq(newsPosts.id, id.data), eq(newsPosts.organizationId, org))).returning({ published: newsPosts.published });
  if (!row) return fail("Notícia não encontrada.");
  await recordAudit(getDb(), { organizationId: org, actorUserId: actor.id, action: "news.toggled", entityType: "news", entityId: id.data, after: row });
  revalidatePath("/admin/conteudo");
  revalidatePath("/noticias", "layout");
  return { ok: true, message: row.published ? "Publicada." : "Despublicada." };
}

export async function createDocument(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const p = z.object({ title: z.string({ error: "Informe o título." }).min(3).max(120), url: httpsUrl, competitionId: z.uuid().optional() }).safeParse(formObject(fd));
  if (!p.success) return fail(firstIssue(p.error));
  const [row] = await getDb().insert(documents).values({ organizationId: org, title: p.data.title, url: p.data.url, competitionId: p.data.competitionId ?? null }).returning({ id: documents.id });
  await recordAudit(getDb(), { organizationId: org, actorUserId: actor.id, action: "document.created", entityType: "document", entityId: row.id, after: p.data });
  revalidatePath("/admin/conteudo");
  revalidatePath("/campeonatos", "layout");
  return { ok: true, message: "Documento publicado." };
}

// ===== Indicações e finalistas =====
export async function createPoll(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const p = z.object({ title: z.string({ error: "Informe o título." }).min(4).max(120), description: z.string().max(1000).optional(), competitionId: z.uuid().optional(), closesAt: optDate }).safeParse(formObject(fd));
  if (!p.success) return fail(firstIssue(p.error));
  const [row] = await getDb().insert(nominationPolls).values({ organizationId: org, title: p.data.title, description: p.data.description ?? null, competitionId: p.data.competitionId ?? null, closesAt: p.data.closesAt }).returning({ id: nominationPolls.id });
  await recordAudit(getDb(), { organizationId: org, actorUserId: actor.id, action: "poll.created", entityType: "poll", entityId: row.id, after: { title: p.data.title } });
  revalidatePath("/admin/indicacoes");
  revalidatePath("/indicacoes");
  return { ok: true, message: "Indicações abertas.", id: row.id };
}

/** Encerra as indicações e define os 3 finalistas (votação final acontece no Instagram). */
export async function setFinalists(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const p = z.object({ pollId: z.uuid(), f1: z.uuid("Escolha o 1º finalista."), f2: z.uuid("Escolha o 2º finalista."), f3: z.uuid("Escolha o 3º finalista."), instagramUrl: httpsUrl.optional() }).safeParse(formObject(fd));
  if (!p.success) return fail(firstIssue(p.error));
  const ids = [p.data.f1, p.data.f2, p.data.f3];
  if (new Set(ids).size !== 3) return fail("Escolha três atletas diferentes.");
  const res = await getDb().transaction(async (tx) => {
    const [poll] = await tx.select().from(nominationPolls).where(and(eq(nominationPolls.id, p.data.pollId), eq(nominationPolls.organizationId, org))).for("update");
    if (!poll) return fail("Indicação não encontrada.");
    const nominated = await tx.selectDistinct({ athleteId: nominations.athleteId }).from(nominations).where(eq(nominations.pollId, poll.id));
    const allowed = new Set(nominated.map((n) => n.athleteId));
    if (!ids.every((id) => allowed.has(id))) return fail("Os finalistas precisam ter sido indicados.");
    await tx.delete(pollFinalists).where(eq(pollFinalists.pollId, poll.id));
    await tx.insert(pollFinalists).values(ids.map((athleteId, i) => ({ pollId: poll.id, athleteId, position: i + 1 })));
    await tx.update(nominationPolls).set({ status: "FINALISTS", instagramUrl: p.data.instagramUrl ?? poll.instagramUrl }).where(eq(nominationPolls.id, poll.id));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "poll.finalists_set", entityType: "poll", entityId: poll.id, after: { finalists: ids } });
    return { ok: true, message: "Finalistas definidos e publicados." };
  });
  revalidatePath("/admin/indicacoes");
  revalidatePath("/indicacoes");
  return res;
}

export async function hideNomination(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) return fail("Dados inválidos.");
  const [row] = await getDb().update(nominations).set({ hidden: true })
    .where(and(eq(nominations.id, id.data), sql`${nominations.pollId} in (select id from ${nominationPolls} where ${nominationPolls.organizationId} = ${org})`))
    .returning({ id: nominations.id });
  if (!row) return fail("Indicação não encontrada.");
  await recordAudit(getDb(), { organizationId: org, actorUserId: actor.id, action: "nomination.hidden", entityType: "nomination", entityId: id.data });
  revalidatePath("/admin/indicacoes");
  return { ok: true, message: "Indicação removida da contagem." };
}

// ===== Suporte (equipe) =====
export async function replyTicket(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const p = z.object({ ticketId: z.uuid(), body: z.string().max(4000).optional(), status: z.enum(TICKET_STATUSES) }).safeParse(formObject(fd));
  if (!p.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const [t] = await tx.select().from(supportTickets).where(and(eq(supportTickets.id, p.data.ticketId), eq(supportTickets.organizationId, org))).for("update");
    if (!t) return fail("Chamado não encontrado.");
    if (p.data.body) await tx.insert(ticketMessages).values({ ticketId: t.id, authorUserId: actor.id, fromStaff: true, body: p.data.body });
    await tx.update(supportTickets).set({ status: p.data.status }).where(eq(supportTickets.id, t.id));
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "ticket.updated", entityType: "ticket", entityId: t.id, before: { status: t.status }, after: { status: p.data.status, replied: !!p.data.body } });
    return { ok: true, message: "Chamado atualizado." };
  });
  revalidatePath("/admin/suporte");
  return res;
}

// ===== Banners do topo =====
const heroSchema = z.object({
  kind: z.enum(["SPONSOR", "HIGHLIGHT"]),
  sponsorId: z.uuid().optional(),
  title: z.string({ error: "Informe o título." }).min(2).max(90),
  subtitle: z.string().max(160).optional(),
  imageUrl: httpsUrl,
  linkUrl: z.string().max(500).optional(),
  ctaLabel: z.string().max(30).optional(),
  durationSeconds: z.coerce.number().int().min(3).max(30).default(6),
  startsAt: optDate,
  endsAt: optDate,
});

/** Link interno ("/campeonatos/...") ou externo https. */
function safeLink(v?: string): string | null | false {
  if (!v) return null;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  try { return new URL(v).protocol === "https:" ? v : false; } catch { return false; }
}

export async function createHeroSlide(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const parsed = heroSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  const link = safeLink(d.linkUrl);
  if (link === false) return fail("Link deve começar com / ou https://");
  if (d.kind === "SPONSOR" && !d.sponsorId) return fail("Escolha o patrocinador do anúncio.");
  await getDb().transaction(async (tx) => {
    if (d.sponsorId) {
      const [s] = await tx.select({ id: sponsors.id }).from(sponsors).where(and(eq(sponsors.id, d.sponsorId), eq(sponsors.organizationId, org)));
      if (!s) throw new Error("Patrocinador inválido.");
    }
    const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${heroSlides.sortOrder}),0)+1` }).from(heroSlides).where(eq(heroSlides.organizationId, org));
    const [row] = await tx.insert(heroSlides).values({
      organizationId: org, kind: d.kind, sponsorId: d.kind === "SPONSOR" ? d.sponsorId! : null, title: d.title, subtitle: d.subtitle ?? null,
      imageUrl: d.imageUrl, linkUrl: link, ctaLabel: d.ctaLabel ?? null, durationSeconds: d.durationSeconds, startsAt: d.startsAt, endsAt: d.endsAt, sortOrder: next,
    }).returning({ id: heroSlides.id });
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: "hero.created", entityType: "hero", entityId: row.id, after: { title: d.title, kind: d.kind } });
  });
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return { ok: true, message: "Banner publicado." };
}

export async function updateHeroSlide(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("content.manage");
  const org = requireOrg(actor);
  const p = z.object({ id: z.uuid(), op: z.enum(["toggle", "up", "down"]) }).safeParse(formObject(fd));
  if (!p.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const list = await tx.select().from(heroSlides).where(eq(heroSlides.organizationId, org)).orderBy(heroSlides.sortOrder);
    const i = list.findIndex((s) => s.id === p.data.id);
    if (i < 0) return fail("Banner não encontrado.");
    if (p.data.op === "toggle") await tx.update(heroSlides).set({ active: !list[i].active }).where(eq(heroSlides.id, list[i].id));
    else {
      const j = p.data.op === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return { ok: true, message: "Nenhuma alteração." };
      [list[i], list[j]] = [list[j], list[i]];
      for (let k = 0; k < list.length; k++) await tx.update(heroSlides).set({ sortOrder: k + 1 }).where(eq(heroSlides.id, list[k].id));
    }
    await recordAudit(tx, { organizationId: org, actorUserId: actor.id, action: `hero.${p.data.op}`, entityType: "hero", entityId: p.data.id });
    return { ok: true, message: "Banner atualizado." };
  });
  revalidatePath("/admin/banners");
  revalidatePath("/");
  return res;
}
