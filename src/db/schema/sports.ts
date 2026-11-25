import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organizations } from "./organizations";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
const orgId = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" });

export const MODALITIES = ["FIELD", "FUTSAL"] as const;
export const modalityEnum = pgEnum("modality", MODALITIES);
export const COMPETITION_STATUSES = ["DRAFT", "REGISTRATION", "ONGOING", "FINISHED"] as const;
export const competitionStatusEnum = pgEnum("competition_status", COMPETITION_STATUSES);
export const PHASE_TYPES = ["LEAGUE", "GROUPS", "KNOCKOUT"] as const;
export const phaseTypeEnum = pgEnum("phase_type", PHASE_TYPES);
export const POSITIONS = ["GK", "DEF", "MID", "FWD", "LB", "RB"] as const;
export const positionEnum = pgEnum("position", POSITIONS);
export const MATCH_STATUSES = ["SCHEDULED", "LIVE", "FINISHED", "CONFIRMED", "POSTPONED", "CANCELLED"] as const;
export const matchStatusEnum = pgEnum("match_status", MATCH_STATUSES);
export const MATCH_PERIODS = ["NOT_STARTED", "FIRST_HALF", "HALFTIME", "SECOND_HALF", "FINISHED"] as const;
export const matchPeriodEnum = pgEnum("match_period", MATCH_PERIODS);

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: orgId(),
    name: text("name").notNull(),
    city: text("city"),
    ...timestamps,
  },
  (t) => [uniqueIndex("venues_org_name_uq").on(t.organizationId, t.name)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: orgId(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    slug: text("slug").notNull(),
    city: text("city"),
    crestUrl: text("crest_url"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("teams_org_slug_uq").on(t.organizationId, t.slug)],
);

export const athletes = pgTable(
  "athletes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: orgId(),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    nickname: text("nickname"),
    photoUrl: text("photo_url"),
    position: positionEnum("position"),
    shirtNumber: smallint("shirt_number"),
    /** Dado pessoal: nunca exibido no portal público. */
    birthDate: date("birth_date"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("athletes_team_idx").on(t.teamId),
    check("athletes_shirt_ck", sql`${t.shirtNumber} is null or ${t.shirtNumber} between 0 and 99`),
  ],
);

export type Tiebreaker = "POINTS" | "WINS" | "GOAL_DIFF" | "GOALS_FOR" | "HEAD_TO_HEAD" | "FEWEST_CARDS";

export const competitions = pgTable(
  "competitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: orgId(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    season: text("season").notNull(),
    modality: modalityEnum("modality").notNull().default("FIELD"),
    status: competitionStatusEnum("status").notNull().default("DRAFT"),
    city: text("city"),
    logoUrl: text("logo_url"),
    description: text("description"),
    periodMinutes: smallint("period_minutes").notNull().default(45),
    intervalMinutes: smallint("interval_minutes").notNull().default(15),
    /** Futsal: pedidos de tempo técnico por equipe em cada tempo. */
    timeoutsPerHalf: smallint("timeouts_per_half").notNull().default(1),
    pointsWin: smallint("points_win").notNull().default(3),
    pointsDraw: smallint("points_draw").notNull().default(1),
    pointsLoss: smallint("points_loss").notNull().default(0),
    tiebreakers: jsonb("tiebreakers")
      .$type<Tiebreaker[]>()
      .notNull()
      .default(["POINTS", "GOAL_DIFF", "GOALS_FOR", "HEAD_TO_HEAD"]),
    published: boolean("published").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("competitions_org_slug_uq").on(t.organizationId, t.slug),
    check("competitions_period_ck", sql`${t.periodMinutes} between 5 and 60`),
  ],
);

export const competitionPhases = pgTable(
  "competition_phases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: phaseTypeEnum("type").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("phases_competition_idx").on(t.competitionId, t.sortOrder)],
);

export const competitionGroups = pgTable(
  "competition_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phaseId: uuid("phase_id")
      .notNull()
      .references(() => competitionPhases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("groups_phase_name_uq").on(t.phaseId, t.name)],
);

export const competitionTeams = pgTable(
  "competition_teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    groupId: uuid("group_id").references(() => competitionGroups.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("competition_teams_uq").on(t.competitionId, t.teamId)],
);

/** Inscrição do atleta na competição (camisa vale para aquela competição). */
export const rosterEntries = pgTable(
  "roster_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => athletes.id, { onDelete: "restrict" }),
    shirtNumber: smallint("shirt_number"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("roster_athlete_uq").on(t.competitionId, t.athleteId),
    uniqueIndex("roster_shirt_uq")
      .on(t.competitionId, t.teamId, t.shirtNumber)
      .where(sql`${t.shirtNumber} is not null`),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: orgId(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "restrict" }),
    phaseId: uuid("phase_id").references(() => competitionPhases.id, { onDelete: "set null" }),
    groupId: uuid("group_id").references(() => competitionGroups.id, { onDelete: "set null" }),
    round: smallint("round"),
    homeTeamId: uuid("home_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    awayTeamId: uuid("away_team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "restrict" }),
    venueId: uuid("venue_id").references(() => venues.id, { onDelete: "set null" }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: matchStatusEnum("status").notNull().default("SCHEDULED"),
    homeScore: smallint("home_score").notNull().default(0),
    awayScore: smallint("away_score").notNull().default(0),
    /** Disputa de pênaltis (mata-mata empatado); null = não houve. */
    homePens: smallint("home_pens"),
    /** Narração ao vivo (Cloudflare Realtime): sessão do narrador enquanto estiver no ar. */
    narrationSessionId: text("narration_session_id"),
    narrationStartedAt: timestamp("narration_started_at", { withTimezone: true }),
    awayPens: smallint("away_pens"),
    refereeName: text("referee_name"),
    operatorId: text("operator_id").references(() => user.id, { onDelete: "set null" }),
    // Cronômetro persistido (ver src/domain/match/clock.ts)
    period: matchPeriodEnum("period").notNull().default("NOT_STARTED"),
    ballInPlay: boolean("ball_in_play").notNull().default(false),
    segmentStartedAt: timestamp("segment_started_at", { withTimezone: true }),
    rollingMs: integer("rolling_ms").notNull().default(0),
    stoppedMs: integer("stopped_ms").notNull().default(0),
    /** Controle de concorrência otimista: incrementa a cada alteração. */
    version: integer("version").notNull().default(1),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: text("confirmed_by").references(() => user.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("matches_scheduled_idx").on(t.organizationId, t.scheduledAt),
    index("matches_competition_idx").on(t.competitionId, t.scheduledAt),
    index("matches_home_idx").on(t.homeTeamId, t.scheduledAt),
    index("matches_away_idx").on(t.awayTeamId, t.scheduledAt),
    index("matches_venue_idx").on(t.venueId, t.scheduledAt),
    check("matches_teams_ck", sql`${t.homeTeamId} <> ${t.awayTeamId}`),
    check("matches_score_ck", sql`${t.homeScore} >= 0 and ${t.awayScore} >= 0`),
  ],
);
