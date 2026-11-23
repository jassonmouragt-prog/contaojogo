CREATE TABLE "hero_slides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text DEFAULT 'HIGHLIGHT' NOT NULL,
	"sponsor_id" uuid,
	"title" text NOT NULL,
	"subtitle" text,
	"image_url" text NOT NULL,
	"link_url" text,
	"cta_label" text,
	"duration_seconds" smallint DEFAULT 6 NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_duration_ck" CHECK ("hero_slides"."duration_seconds" between 3 and 30)
);
--> statement-breakpoint
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hero_org_order_idx" ON "hero_slides" USING btree ("organization_id","sort_order");