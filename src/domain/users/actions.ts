"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { ROLES, account, session, user } from "@/db/schema";
import { recordAudit } from "@/domain/audit/record";
import { authorizeAction } from "@/lib/auth/session";
import { DENIAL_MESSAGE, checkBanChange, checkRoleChange } from "@/lib/auth/permissions";

export type ActionResult = { ok: boolean; message: string; id?: string } | null;

const roleSchema = z.object({ userId: z.string().min(1), role: z.enum(ROLES) });
const passwordSchema = z.object({ userId: z.string().min(1), password: z.string().min(8).max(128) });
const banSchema = z.object({ userId: z.string().min(1), banned: z.enum(["true", "false"]) });

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function changeUserRole(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("users.manage");
  const parsed = roleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const { userId, role } = parsed.data;
  const ip = await clientIp();

  return getDb().transaction(async (tx) => {
    // Trava os proprietários para que dois rebaixamentos simultâneos não zerem OWNER.
    await tx.execute(sql`select id from "user" where role = 'OWNER' for update`);
    const [target] = await tx
      .select({ id: user.id, role: user.role, organizationId: user.organizationId })
      .from(user)
      .where(eq(user.id, userId))
      .for("update");
    if (!target) return { ok: false, message: "Usuário não encontrado." };
    if (actor.organizationId && target.organizationId !== actor.organizationId)
      return { ok: false, message: "Usuário não encontrado." };
    if (target.role === role) return { ok: true, message: "Nenhuma alteração." };

    const [{ owners }] = await tx.select({ owners: count() }).from(user).where(eq(user.role, "OWNER"));
    const denial = checkRoleChange({
      actorId: actor.id,
      actorRole: actor.role,
      targetId: target.id,
      targetRole: target.role,
      newRole: role,
      ownerCount: owners,
    });
    if (denial) return { ok: false, message: DENIAL_MESSAGE[denial] };

    await tx.update(user).set({ role }).where(eq(user.id, target.id));
    await recordAudit(tx, {
      organizationId: target.organizationId,
      actorUserId: actor.id,
      action: "user.role_changed",
      entityType: "user",
      entityId: target.id,
      before: { role: target.role },
      after: { role },
      ipAddress: ip,
    });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: "Perfil atualizado." };
  });
}

export async function setUserBanned(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("users.manage");
  const parsed = banSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Dados inválidos." };
  const banned = parsed.data.banned === "true";
  const ip = await clientIp();

  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, role: user.role, banned: user.banned, organizationId: user.organizationId })
      .from(user)
      .where(eq(user.id, parsed.data.userId))
      .for("update");
    if (!target || (actor.organizationId && target.organizationId !== actor.organizationId))
      return { ok: false, message: "Usuário não encontrado." };
    const denial = checkBanChange({ actorId: actor.id, actorRole: actor.role, targetId: target.id, targetRole: target.role });
    if (denial) return { ok: false, message: DENIAL_MESSAGE[denial] };
    if (target.banned === banned) return { ok: true, message: "Nenhuma alteração." };

    await tx.update(user).set({ banned }).where(eq(user.id, target.id));
    if (banned) await tx.delete(session).where(and(eq(session.userId, target.id)));
    await recordAudit(tx, {
      organizationId: target.organizationId,
      actorUserId: actor.id,
      action: banned ? "user.banned" : "user.unbanned",
      entityType: "user",
      entityId: target.id,
      before: { banned: target.banned },
      after: { banned },
      ipAddress: ip,
    });
    revalidatePath("/admin/usuarios");
    return { ok: true, message: banned ? "Acesso bloqueado e sessões encerradas." : "Acesso liberado." };
  });
}

/**
 * Redefinição de senha feita por um administrador (substitui o e-mail de
 * recuperação). Encerra todas as sessões do usuário e registra auditoria
 * sem guardar a senha.
 */
export async function resetUserPassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await authorizeAction("users.manage");
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "A senha precisa ter entre 8 e 128 caracteres." };
  const ip = await clientIp();
  const hash = await hashPassword(parsed.data.password);

  return getDb().transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, role: user.role, organizationId: user.organizationId })
      .from(user)
      .where(eq(user.id, parsed.data.userId))
      .for("update");
    if (!target || (actor.organizationId && target.organizationId !== actor.organizationId))
      return { ok: false, message: "Usuário não encontrado." };
    const denial = checkBanChange({ actorId: actor.id, actorRole: actor.role, targetId: target.id, targetRole: target.role });
    if (denial) return { ok: false, message: DENIAL_MESSAGE[denial] };

    const updated = await tx
      .update(account)
      .set({ password: hash })
      .where(and(eq(account.userId, target.id), eq(account.providerId, "credential")))
      .returning({ id: account.id });
    if (updated.length === 0) {
      await tx.insert(account).values({
        id: randomBytes(16).toString("hex"),
        accountId: target.id,
        providerId: "credential",
        userId: target.id,
        password: hash,
      });
    }
    await tx.delete(session).where(eq(session.userId, target.id));
    await recordAudit(tx, {
      organizationId: target.organizationId,
      actorUserId: actor.id,
      action: "user.password_reset",
      entityType: "user",
      entityId: target.id,
      ipAddress: ip,
    });
    return { ok: true, message: "Senha redefinida. Informe a nova senha ao usuário." };
  });
}
