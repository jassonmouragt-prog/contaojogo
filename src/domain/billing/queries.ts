import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, plans, subscriptions, user } from "@/db/schema";

export function listPlans(onlyActive = false) {
  const q = getDb().select().from(plans);
  return (onlyActive ? q.where(eq(plans.active, true)) : q).orderBy(asc(plans.sortOrder), asc(plans.priceCents));
}

export function listSubscriptions() {
  return getDb()
    .select({
      id: subscriptions.id, status: subscriptions.status, phone: subscriptions.phone, expiresAt: subscriptions.expiresAt, createdAt: subscriptions.createdAt,
      orgName: organizations.name, planName: plans.name, priceCents: plans.priceCents, interval: plans.interval, userName: user.name, userEmail: user.email,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(organizations.id, subscriptions.organizationId))
    .innerJoin(plans, eq(plans.id, subscriptions.planId))
    .innerJoin(user, eq(user.id, subscriptions.userId))
    .orderBy(desc(subscriptions.createdAt));
}
