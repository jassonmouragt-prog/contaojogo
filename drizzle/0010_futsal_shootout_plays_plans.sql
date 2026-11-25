ALTER TYPE "public"."match_event_type" ADD VALUE 'FOUL';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE 'TIMEOUT';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE 'PENALTY_MISS';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE 'SHOOTOUT_GOAL';--> statement-breakpoint
ALTER TYPE "public"."match_event_type" ADD VALUE 'SHOOTOUT_MISS';--> statement-breakpoint
CREATE TABLE "match_plays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"x" smallint NOT NULL,
	"y" smallint NOT NULL,
	"client_op_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_plays_xy_ck" CHECK ("match_plays"."x" between 0 and 1000 and "match_plays"."y" between 0 and 600)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"interval" text DEFAULT 'MONTH' NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_competitions" smallint,
	"highlighted" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_price_ck" CHECK ("plans"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"phone" text,
	"expires_at" timestamp with time zone,
	"external_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "interval_minutes" smallint DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "timeouts_per_half" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "home_pens" smallint;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "away_pens" smallint;--> statement-breakpoint
ALTER TABLE "match_plays" ADD CONSTRAINT "match_plays_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_plays" ADD CONSTRAINT "match_plays_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_plays_client_uq" ON "match_plays" USING btree ("match_id","client_op_id");--> statement-breakpoint
CREATE INDEX "match_plays_match_idx" ON "match_plays" USING btree ("match_id","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status","created_at");