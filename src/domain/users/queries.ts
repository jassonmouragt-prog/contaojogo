import "server-only";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { user, type Role } from "@/db/schema";

export async function listUsers(opts: { organizationId: string | null; search?: string; role?: Role }) {
  const filters: SQL[] = [];
  if (opts.organizationId) filters.push(eq(user.organizationId, opts.organizationId));
  if (opts.role) filters.push(eq(user.role, opts.role));
  if (opts.search) {
    const q = `%${opts.search.replace(/[%_\\]/g, "\\$&")}%`;
    filters.push(or(ilike(user.name, q), ilike(user.email, q))!);
  }
  return getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(200);
}
