import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organizations";

export const PLAN_INTERVALS = ["MONTH", "YEAR"] as const;
export const SUBSCRIPTION_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED", "CANCELLED"] as const;

/** Planos vendidos a clubes e ligas (editáveis pelo dono da plataforma). */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    interval: text("interval").$type<(typeof PLAN_INTERVALS)[number]>().notNull().default("MONTH"),
    benefits: jsonb("benefits").$type<string[]>().notNull().default([]),
    /** Limite de competições ativas (null = ilimitado). */
    maxCompetitions: smallint("max_competitions"),
    highlighted: boolean("highlighted").notNull().default(false),
    active: boolean("active").notNull().default(true),
    sortOrder: smallint("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("plans_price_ck", sql`${t.priceCents} >= 0`)],
);

/**
 * Assinatura de um clube/liga. Nasce PENDING ao se cadastrar; o dono da
 * plataforma ativa (ou, depois, o gateway de pagamento ativa sozinho).
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => plans.id, { onDelete: "restrict" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<(typeof SUBSCRIPTION_STATUSES)[number]>().notNull().default("PENDING"),
    phone: text("phone"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    /** Referência futura no gateway de pagamento. */
    externalRef: text("external_ref"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [index("subscriptions_status_idx").on(t.status, t.createdAt)],
);
