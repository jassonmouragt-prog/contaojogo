CREATE TYPE "public"."competition_status" AS ENUM('DRAFT', 'REGISTRATION', 'ONGOING', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."match_period" AS ENUM('NOT_STARTED', 'FIRST_HALF', 'HALFTIME', 'SECOND_HALF', 'FINISHED');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('SCHEDULED', 'LIVE', 'FINISHED', 'CONFIRMED', 'POSTPONED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."modality" AS ENUM('FIELD', 'FUTSAL');--> statement-breakpoint
CREATE TYPE "public"."phase_type" AS ENUM('LEAGUE', 'GROUPS', 'KNOCKOUT');--> statement-breakpoint
CREATE TYPE "public"."position" AS ENUM('GK', 'DEF', 'MID', 'FWD');--> statement-breakpoint
CREATE TABLE "athletes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"team_id" uuid,
	"name" text NOT NULL,
	"nickname" text,
	"position" "position",
	"shirt_number" smallint,
	"birth_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "athletes_shirt_ck" CHECK ("athletes"."shirt_number" is null or "athletes"."shirt_number" between 0 and 99)
);
--> statement-breakpoint
CREATE TABLE "competition_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "phase_type" NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competition_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"season" text NOT NULL,
	"modality" "modality" DEFAULT 'FIELD' NOT NULL,
	"status" "competition_status" DEFAULT 'DRAFT' NOT NULL,
	"city" text,
	"description" text,
	"period_minutes" smallint DEFAULT 45 NOT NULL,
	"points_win" smallint DEFAULT 3 NOT NULL,
	"points_draw" smallint DEFAULT 1 NOT NULL,
	"points_loss" smallint DEFAULT 0 NOT NULL,
	"tiebreakers" jsonb DEFAULT '["POINTS","GOAL_DIFF","GOALS_FOR","HEAD_TO_HEAD"]'::jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitions_period_ck" CHECK ("competitions"."period_minutes" between 5 and 60)
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"competition_id" uuid NOT NULL,
	"phase_id" uuid,
	"group_id" uuid,
	"round" smallint,
	"home_team_id" uuid NOT NULL,
	"away_team_id" uuid NOT NULL,
	"venue_id" uuid,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "match_status" DEFAULT 'SCHEDULED' NOT NULL,
	"home_score" smallint DEFAULT 0 NOT NULL,
	"away_score" smallint DEFAULT 0 NOT NULL,
	"referee_name" text,
	"operator_id" text,
	"period" "match_period" DEFAULT 'NOT_STARTED' NOT NULL,
	"ball_in_play" boolean DEFAULT false NOT NULL,
	"segment_started_at" timestamp with time zone,
	"rolling_ms" integer DEFAULT 0 NOT NULL,
	"stopped_ms" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matches_teams_ck" CHECK ("matches"."home_team_id" <> "matches"."away_team_id"),
	CONSTRAINT "matches_score_ck" CHECK ("matches"."home_score" >= 0 and "matches"."away_score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "roster_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"shirt_number" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text,
	"slug" text NOT NULL,
	"city" text,
	"crest_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "athletes" ADD CONSTRAINT "athletes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_groups" ADD CONSTRAINT "competition_groups_phase_id_competition_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."competition_phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_phases" ADD CONSTRAINT "competition_phases_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competition_teams" ADD CONSTRAINT "competition_teams_group_id_competition_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."competition_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_phase_id_competition_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."competition_phases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_competition_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."competition_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_team_id_teams_id_fk" FOREIGN KEY ("home_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_team_id_teams_id_fk" FOREIGN KEY ("away_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_confirmed_by_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_entries" ADD CONSTRAINT "roster_entries_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "athletes_team_idx" ON "athletes" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_phase_name_uq" ON "competition_groups" USING btree ("phase_id","name");--> statement-breakpoint
CREATE INDEX "phases_competition_idx" ON "competition_phases" USING btree ("competition_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "competition_teams_uq" ON "competition_teams" USING btree ("competition_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_org_slug_uq" ON "competitions" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "matches_scheduled_idx" ON "matches" USING btree ("organization_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_competition_idx" ON "matches" USING btree ("competition_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_home_idx" ON "matches" USING btree ("home_team_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_away_idx" ON "matches" USING btree ("away_team_id","scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_venue_idx" ON "matches" USING btree ("venue_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_athlete_uq" ON "roster_entries" USING btree ("competition_id","athlete_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_shirt_uq" ON "roster_entries" USING btree ("competition_id","team_id","shirt_number") WHERE "roster_entries"."shirt_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "teams_org_slug_uq" ON "teams" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_org_name_uq" ON "venues" USING btree ("organization_id","name");