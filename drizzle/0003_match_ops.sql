CREATE TYPE "public"."match_event_type" AS ENUM('GOAL', 'YELLOW', 'RED', 'SUB');--> statement-breakpoint
CREATE TABLE "match_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"type" "match_event_type" NOT NULL,
	"team_id" uuid NOT NULL,
	"athlete_id" uuid,
	"minute" smallint NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"client_event_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	CONSTRAINT "match_events_minute_ck" CHECK ("match_events"."minute" between 0 and 200)
);
--> statement-breakpoint
CREATE TABLE "match_stats" (
	"match_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"shots" smallint DEFAULT 0 NOT NULL,
	"shots_on_target" smallint DEFAULT 0 NOT NULL,
	"corners" smallint DEFAULT 0 NOT NULL,
	"offsides" smallint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_stats_ck" CHECK ("match_stats"."shots_on_target" <= "match_stats"."shots" and "match_stats"."shots" >= 0 and "match_stats"."corners" >= 0 and "match_stats"."offsides" >= 0)
);
--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_athlete_id_athletes_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_stats" ADD CONSTRAINT "match_stats_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_events_client_uq" ON "match_events" USING btree ("match_id","client_event_id");--> statement-breakpoint
CREATE INDEX "match_events_match_idx" ON "match_events" USING btree ("match_id","minute");--> statement-breakpoint
CREATE UNIQUE INDEX "match_stats_uq" ON "match_stats" USING btree ("match_id","team_id");