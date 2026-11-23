import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { user as userTable } from "@/db/schema";
import type { Role } from "@/db/schema/enums";
import { getAuth } from "./server";
import { can, hasRole, type Permission } from "./permissions";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string | null;
};

/**
 * Usuário atual, com perfil lido do banco (fonte da verdade) — nunca do
 * cookie em cache, para que rebaixamentos e bloqueios valham imediatamente.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const [row] = await getDb()
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      role: userTable.role,
      organizationId: userTable.organizationId,
      banned: userTable.banned,
    })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);
  if (!row || row.banned) return null;
  return { id: row.id, name: row.name, email: row.email, role: row.role, organizationId: row.organizationId };
});

/** Exige login; sem sessão redireciona para /entrar preservando o destino. */
export async function requireUser(next = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requirePermission(permission: Permission, next = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!can(user.role, permission)) forbidden();
  return user;
}

export async function requireRole(minimum: Role, next = "/admin"): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!hasRole(user.role, minimum)) forbidden();
  return user;
}

/** Para server actions: retorna erro em vez de redirecionar. */
export async function authorizeAction(permission: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, permission)) throw new Error("Não autorizado.");
  return user;
}
