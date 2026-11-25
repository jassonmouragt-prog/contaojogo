"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { organizations, plans, session, subscriptions, user } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { requirePlatformOwner } from "@/domain/billing/platform";
import { type ActionResult, fail, firstIssue, formObject } from "@/domain/shared/action-helpers";
import { slugify } from "@/lib/slug";
import { getAuth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { clientKey, rateLimit } from "@/lib/rate-limit";

const planSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2, "Informe o nome do plano.").max(60),
  description: z.string().trim().max(240).optional(),
  price: z.string().trim().regex(/^\d{1,6}([.,]\d{1,2})?$/, "Preço inválido (ex.: 49,90)."),
  interval: z.enum(["MONTH", "YEAR"]),
  benefits: z.string().max(2000).optional(),
  maxCompetitions: z.coerce.number().int().min(1).max(999).optional(),
  highlighted: z.enum(["on"]).optional(),
  active: z.enum(["on"]).optional(),
});

export async function savePlan(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const actor = await requirePlatformOwner();
  const raw = formObject(fd);
  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  const values = {
    name: d.name,
    description: d.description || null,
    priceCents: Math.round(Number(d.price.replace(",", ".")) * 100),
    interval: d.interval,
    benefits: (d.benefits ?? "").split("\n").map((b) => b.trim()).filter(Boolean).slice(0, 12),
    maxCompetitions: d.maxCompetitions ?? null,
    highlighted: d.highlighted === "on",
    active: d.active === "on",
  };
  await getDb().transaction(async (tx) => {
    const [row] = d.id
      ? await tx.update(plans).set(values).where(eq(plans.id, d.id)).returning({ id: plans.id })
      : await tx.insert(plans).values(values).returning({ id: plans.id });
    await recordAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.id, action: d.id ? "plan.updated" : "plan.created", entityType: "plan", entityId: row.id, after: values });
  });
  revalidatePath("/admin/planos");
  revalidatePath("/planos");
  return { ok: true, message: d.id ? "Plano salvo." : "Plano criado." };
}

const signupSchema = z.object({
  planId: z.uuid({ error: "Escolha um plano." }),
  orgName: z.string().trim().min(3, "Informe o nome do clube ou da liga.").max(80),
  name: z.string().trim().min(3, "Informe seu nome.").max(80),
  email: z.email("E-mail inválido.").max(120),
  phone: z.string().trim().min(10, "Informe um WhatsApp com DDD.").max(20),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(128),
});

/**
 * Assinatura de um clube/liga: cria a conta, a organização própria e a
 * assinatura pendente. O acesso ao painel é liberado quando a assinatura é ativada.
 */
export async function subscribe(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const h = await headers();
  if (!rateLimit(`subscribe:${clientKey(h)}`, 5, 10 * 60_000)) return fail("Muitas tentativas. Aguarde alguns minutos.");
  const parsed = signupSchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const d = parsed.data;
  const db = getDb();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, d.planId), eq(plans.active, true))).limit(1);
  if (!plan) return fail("Plano indisponível.");
  const [exists] = await db.select({ id: user.id }).from(user).where(eq(user.email, d.email.toLowerCase())).limit(1);
  if (exists) return fail("Já existe uma conta com este e-mail. Entre com ela ou use outro e-mail.");

  const created = await getAuth().api.signUpEmail({ body: { name: d.name, email: d.email.toLowerCase(), password: d.password }, headers: h });
  const userId = created.user.id;
  const subId = await db.transaction(async (tx) => {
    const base = slugify(d.orgName) || "clube";
    let slug = base;
    for (let i = 2; (await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, slug)).limit(1)).length; i++) slug = `${base}-${i}`;
    const [org] = await tx.insert(organizations).values({ name: d.orgName, slug }).returning({ id: organizations.id });
    await tx.update(user).set({ organizationId: org.id, role: "USER" }).where(eq(user.id, userId));
    const [sub] = await tx.insert(subscriptions).values({ organizationId: org.id, planId: plan.id, userId, phone: d.phone }).returning({ id: subscriptions.id });
    await recordAudit(tx, { organizationId: org.id, actorUserId: userId, action: "subscription.created", entityType: "subscription", entityId: sub.id, after: { plan: plan.name, orgName: d.orgName } });
    return sub.id;
  });
  revalidatePath("/admin/assinaturas");
  redirect(`/planos/obrigado?a=${subId}`);
}

/** Dono da plataforma ativa, suspende ou cancela uma assinatura. */
export async function setSubscriptionStatus(input: { id: string; status: "ACTIVE" | "SUSPENDED" | "CANCELLED"; months?: number }): Promise<ActionResult> {
  const actor = await requirePlatformOwner();
  const p = z.object({ id: z.uuid(), status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED"]), months: z.number().int().min(1).max(24).optional() }).safeParse(input);
  if (!p.success) return fail("Dados inválidos.");
  const res = await getDb().transaction(async (tx) => {
    const [sub] = await tx.select().from(subscriptions).where(eq(subscriptions.id, p.data.id)).for("update");
    if (!sub) return fail("Assinatura não encontrada.");
    const active = p.data.status === "ACTIVE";
    const base = sub.expiresAt && sub.expiresAt > new Date() ? sub.expiresAt : new Date();
    const expiresAt = active ? new Date(base.getFullYear(), base.getMonth() + (p.data.months ?? 1), base.getDate(), 23, 59) : sub.expiresAt;
    await tx.update(subscriptions).set({ status: p.data.status, expiresAt }).where(eq(subscriptions.id, sub.id));
    // Acesso ao painel: ADMIN da própria organização enquanto ativa; USER fora disso.
    await tx.update(user).set({ role: active ? "ADMIN" : "USER" }).where(and(eq(user.id, sub.userId), ne(user.role, "OWNER")));
    if (!active) await tx.delete(session).where(eq(session.userId, sub.userId));
    await recordAudit(tx, { organizationId: actor.organizationId, actorUserId: actor.id, action: `subscription.${p.data.status.toLowerCase()}`, entityType: "subscription", entityId: sub.id, after: { status: p.data.status, expiresAt } });
    return { ok: true, message: active ? "Assinatura ativa: acesso ao painel liberado." : p.data.status === "SUSPENDED" ? "Assinatura suspensa." : "Assinatura cancelada." } as ActionResult;
  });
  revalidatePath("/admin/assinaturas");
  return res;
}
