import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, pgEnum, pgTable, serial, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organizations";
import { athletes, competitions } from "./sports";

const ts = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
};
const orgId = () => uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "restrict" });

// ===== Comercial =====
export const SPONSOR_PLACEMENTS = ["HOME", "COMPETITION", "MATCH"] as const;
export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: orgId(),
  name: text("name").notNull(),
  logoUrl: text("logo_url").notNull(),
  linkUrl: text("link_url"),
  placements: text("placements").array().notNull().default(sql`ARRAY['HOME','COMPETITION','MATCH']::text[]`),
  durationSeconds: smallint("duration_seconds").notNull().default(4),
  sortOrder: smallint("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  ...ts,
}, (t) => [check("sponsors_duration_ck", sql`${t.durationSeconds} between 2 and 30`)]);

export const sponsorMetrics = pgTable("sponsor_metrics", {
  sponsorId: uuid("sponsor_id").notNull().references(() => sponsors.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  placement: text("placement").notNull(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
}, (t) => [uniqueIndex("sponsor_metrics_uq").on(t.sponsorId, t.day, t.placement)]);

// ===== Conteúdo =====
export const newsPosts = pgTable("news_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: orgId(),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  summary: text("summary"),
  body: text("body").notNull(),
  coverUrl: text("cover_url"),
  published: boolean("published").notNull().default(false),
  publishAt: timestamp("publish_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  ...ts,
}, (t) => [uniqueIndex("news_org_slug_uq").on(t.organizationId, t.slug), index("news_publish_idx").on(t.organizationId, t.publishAt)]);

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: orgId(),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  url: text("url").notNull(),
  published: boolean("published").notNull().default(true),
  ...ts,
});

// ===== Engajamento: indicações → 3 finalistas → votação no Instagram =====
export const POLL_STATUSES = ["OPEN", "CLOSED", "FINALISTS"] as const;
export const pollStatusEnum = pgEnum("poll_status", POLL_STATUSES);
export const nominationPolls = pgTable("nomination_polls", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: orgId(),
  competitionId: uuid("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  status: pollStatusEnum("status").notNull().default("OPEN"),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  instagramUrl: text("instagram_url"),
  ...ts,
});

export const nominations = pgTable("nominations", {
  id: uuid("id").primaryKey().defaultRandom(),
  pollId: uuid("poll_id").notNull().references(() => nominationPolls.id, { onDelete: "cascade" }),
  athleteId: uuid("athlete_id").notNull().references(() => athletes.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  reason: text("reason"),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("nominations_one_per_user").on(t.pollId, t.userId), index("nominations_poll_idx").on(t.pollId, t.athleteId)]);

export const pollFinalists = pgTable("poll_finalists", {
  pollId: uuid("poll_id").notNull().references(() => nominationPolls.id, { onDelete: "cascade" }),
  athleteId: uuid("athlete_id").notNull().references(() => athletes.id, { onDelete: "cascade" }),
  position: smallint("position").notNull(),
}, (t) => [uniqueIndex("finalists_pos_uq").on(t.pollId, t.position), uniqueIndex("finalists_athlete_uq").on(t.pollId, t.athleteId), check("finalists_pos_ck", sql`${t.position} between 1 and 3`)]);

// ===== Suporte =====
export const TICKET_CATEGORIES = ["ACCESS", "MATCH_ERROR", "OTHER"] as const;
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
export const ticketCategoryEnum = pgEnum("ticket_category", TICKET_CATEGORIES);
export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  number: serial("number").notNull().unique(),
  organizationId: orgId(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  category: ticketCategoryEnum("category").notNull(),
  pageUrl: text("page_url"),
  attachmentUrl: text("attachment_url"),
  message: text("message").notNull(),
  status: ticketStatusEnum("status").notNull().default("OPEN"),
  ...ts,
}, (t) => [index("tickets_status_idx").on(t.organizationId, t.status, t.createdAt)]);

export const ticketMessages = pgTable("ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  authorUserId: text("author_user_id").references(() => user.id, { onDelete: "set null" }),
  fromStaff: boolean("from_staff").notNull().default(false),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ===== Banners do topo do portal (anúncios e destaques) =====
export const HERO_KINDS = ["SPONSOR", "HIGHLIGHT"] as const;
export const heroSlides = pgTable("hero_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: orgId(),
  kind: text("kind").notNull().default("HIGHLIGHT"),
  /** Quando é anúncio de patrocinador: visualizações e cliques entram no relatório dele. */
  sponsorId: uuid("sponsor_id").references(() => sponsors.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  imageUrl: text("image_url").notNull(),
  linkUrl: text("link_url"),
  ctaLabel: text("cta_label"),
  durationSeconds: smallint("duration_seconds").notNull().default(6),
  sortOrder: smallint("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  ...ts,
}, (t) => [check("hero_duration_ck", sql`${t.durationSeconds} between 3 and 30`), index("hero_org_order_idx").on(t.organizationId, t.sortOrder)]);
