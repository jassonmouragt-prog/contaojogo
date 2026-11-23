"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { TICKET_CATEGORIES, nominationPolls, nominations, organizations, rosterEntries, supportTickets, ticketMessages } from "@/db/schema";
import { type ActionResult, fail, firstIssue, formObject, isUniqueViolation } from "@/domain/shared/action-helpers";
import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_ORG_SLUG } from "@/lib/auth/server";
import { headers } from "next/headers";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/** Torcedor logado indica um atleta (uma indicação por conta e por enquete). */
export async function nominateAthlete(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return fail("Entre na sua conta para indicar.");
  if (!rateLimit(`nominate:${me.id}`, 10, 60_000)) return fail("Aguarde um instante.");
  const p = z.object({ pollId: z.uuid(), athleteId: z.uuid("Escolha o atleta."), reason: z.string().max(280).optional() }).safeParse(formObject(fd));
  if (!p.success) return fail(firstIssue(p.error));
  const db = getDb();
  const [poll] = await db.select().from(nominationPolls).where(eq(nominationPolls.id, p.data.pollId));
  if (!poll || poll.status !== "OPEN" || (poll.closesAt && poll.closesAt.getTime() < Date.now())) return fail("Indicações encerradas.");
  if (poll.competitionId) {
    const [ok] = await db.select({ id: rosterEntries.id }).from(rosterEntries).where(and(eq(rosterEntries.competitionId, poll.competitionId), eq(rosterEntries.athleteId, p.data.athleteId)));
    if (!ok) return fail("Atleta não participa desta competição.");
  }
  try {
    await db.insert(nominations).values({ pollId: poll.id, athleteId: p.data.athleteId, userId: me.id, reason: p.data.reason ?? null });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Você já fez sua indicação nesta enquete.");
    throw e;
  }
  revalidatePath("/indicacoes");
  return { ok: true, message: "Indicação registrada. Obrigado!" };
}

const ticketSchema = z.object({
  name: z.string({ error: "Informe seu nome." }).min(2).max(80),
  email: z.email("E-mail inválido."),
  category: z.enum(TICKET_CATEGORIES),
  pageUrl: z.string().max(300).optional(),
  attachmentUrl: z.url({ protocol: /^https$/, error: "Link do print deve ser https://" }).optional(),
  message: z.string({ error: "Descreva o problema." }).min(10, "Descreva com um pouco mais de detalhe.").max(4000),
  website: z.string().max(0).optional(), // honeypot anti-robô
});

export async function openTicket(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  if (!rateLimit(`ticket:${clientKey(await headers())}`, 5, 60 * 60_000)) return fail("Muitos chamados em pouco tempo. Tente mais tarde.");
  const p = ticketSchema.safeParse(formObject(fd));
  if (!p.success) return fail(firstIssue(p.error));
  const me = await getCurrentUser();
  const [org] = await getDb().select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, DEFAULT_ORG_SLUG));
  if (!org) return fail("Organização não configurada.");
  const { website: _hp, ...d } = p.data;
  void _hp;
  const [row] = await getDb().insert(supportTickets).values({ organizationId: org.id, userId: me?.id ?? null, ...d, pageUrl: d.pageUrl ?? null, attachmentUrl: d.attachmentUrl ?? null }).returning({ number: supportTickets.number });
  revalidatePath("/admin/suporte");
  return { ok: true, message: `Chamado #${String(row.number).padStart(4, "0")} aberto. Responderemos por aqui e pelo e-mail informado.` };
}

/** Dono do chamado (logado) acrescenta mensagem. */
export async function addTicketMessage(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await getCurrentUser();
  if (!me) return fail("Entre na sua conta.");
  const p = z.object({ ticketId: z.uuid(), body: z.string().min(2).max(4000) }).safeParse(formObject(fd));
  if (!p.success) return fail("Mensagem inválida.");
  const [t] = await getDb().select({ id: supportTickets.id }).from(supportTickets).where(and(eq(supportTickets.id, p.data.ticketId), eq(supportTickets.userId, me.id)));
  if (!t) return fail("Chamado não encontrado.");
  await getDb().insert(ticketMessages).values({ ticketId: t.id, authorUserId: me.id, body: p.data.body });
  revalidatePath("/suporte");
  return { ok: true, message: "Mensagem enviada." };
}

