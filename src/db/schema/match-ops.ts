import { sql } from "drizzle-orm";
import { check, index, jsonb, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { athletes, matches, teams } from "./sports";

/** FOUL = falta acumulada (futsal); TIMEOUT = tempo técnico; PENALTY_MISS = pênalti perdido no jogo;
 * SHOOTOUT_* = cobranças da disputa de pênaltis (não entram no placar). */
export const EVENT_TYPES = ["GOAL", "YELLOW", "RED", "SUB", "FOUL", "TIMEOUT", "PENALTY_MISS", "SHOOTOUT_GOAL", "SHOOTOUT_MISS"] as const;
export const eventTypeEnum = pgEnum("match_event_type", EVENT_TYPES);

export type EventDetail = {
  ownGoal?: boolean;
  penalty?: boolean;
  assistAthleteId?: string | null;
  playerOutId?: string | null;
  note?: string;
  /** Período em que o lance aconteceu (faltas acumuladas e tempo técnico zeram por tempo). */
  period?: "FIRST_HALF" | "SECOND_HALF";
};

export const matchEvents = pgTable(
  "match_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    type: eventTypeEnum("type").notNull(),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
    athleteId: uuid("athlete_id").references(() => athletes.id, { onDelete: "set null" }),
    minute: smallint("minute").notNull(),
    detail: jsonb("detail").$type<EventDetail>().notNull().default({}),
    /** Gerado no aparelho do operador: reenvios (offline/duplo toque) não duplicam. */
    clientEventId: text("client_event_id").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by").references(() => user.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("match_events_client_uq").on(t.matchId, t.clientEventId),
    index("match_events_match_idx").on(t.matchId, t.minute),
    check("match_events_minute_ck", sql`${t.minute} between 0 and 200`),
  ],
);

export const matchStats = pgTable(
  "match_stats",
  {
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
    shots: smallint("shots").notNull().default(0),
    shotsOnTarget: smallint("shots_on_target").notNull().default(0),
    corners: smallint("corners").notNull().default(0),
    offsides: smallint("offsides").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("match_stats_uq").on(t.matchId, t.teamId),
    check("match_stats_ck", sql`${t.shotsOnTarget} <= ${t.shots} and ${t.shots} >= 0 and ${t.corners} >= 0 and ${t.offsides} >= 0`),
  ],
);

/**
 * Operações já aplicadas vindas da fila offline do operador. Reenvios do
 * mesmo client_op_id são ignorados (sincronização idempotente).
 */
export const matchSyncOps = pgTable(
  "match_sync_ops",
  {
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    clientOpId: text("client_op_id").notNull(),
    kind: text("kind").notNull(),
    outcome: text("outcome").notNull(),
    message: text("message"),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("match_sync_ops_uq").on(t.matchId, t.clientOpId)],
);

export const PLAY_KINDS = ["POSSESSION", "ATTACK", "DANGER", "SHOT", "SHOT_ON", "CORNER", "FREE_KICK", "THROW_IN", "GOAL_KICK"] as const;
export type PlayKind = (typeof PLAY_KINDS)[number];

/**
 * Lances do campinho virtual (olheiro): posição da bola (0–1000 x 0–600,
 * mandante ataca para a direita) e o tipo de lance. Só leitura no site.
 */
export const matchPlays = pgTable(
  "match_plays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").notNull().references(() => teams.id, { onDelete: "restrict" }),
    kind: text("kind").$type<PlayKind>().notNull(),
    x: smallint("x").notNull(),
    y: smallint("y").notNull(),
    clientOpId: text("client_op_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("match_plays_client_uq").on(t.matchId, t.clientOpId),
    index("match_plays_match_idx").on(t.matchId, t.createdAt),
    check("match_plays_xy_ck", sql`${t.x} between 0 and 1000 and ${t.y} between 0 and 600`),
  ],
);
