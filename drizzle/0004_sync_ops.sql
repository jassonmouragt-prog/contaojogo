CREATE TABLE "match_sync_ops" (
	"match_id" uuid NOT NULL,
	"client_op_id" text NOT NULL,
	"kind" text NOT NULL,
	"outcome" text NOT NULL,
	"message" text,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_sync_ops" ADD CONSTRAINT "match_sync_ops_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_sync_ops_uq" ON "match_sync_ops" USING btree ("match_id","client_op_id");