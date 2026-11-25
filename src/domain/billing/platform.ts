import "server-only";
import { eq } from "drizzle-orm";
import { forbidden } from "next/navigation";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { DEFAULT_ORG_SLUG } from "@/lib/auth/server";
import { requireUser, type CurrentUser } from "@/lib/auth/session";

/** Dono da plataforma = proprietário da organização Conta o Jogo (não de um clube assinante). */
export async function isPlatformOwner(u: Pick<CurrentUser, "role" | "organizationId">) {
  if (u.role !== "OWNER" || !u.organizationId) return false;
  const [org] = await getDb().select({ slug: organizations.slug }).from(organizations).where(eq(organizations.id, u.organizationId)).limit(1);
  return org?.slug === DEFAULT_ORG_SLUG;
}

export async function requirePlatformOwner(next = "/admin") {
  const u = await requireUser(next);
  if (!(await isPlatformOwner(u))) forbidden();
  return u;
}

export const formatPrice = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const INTERVAL_LABEL = { MONTH: "/mês", YEAR: "/ano" } as const;
