CREATE TABLE "shop_promo" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"models" text[] DEFAULT '{}'::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_promo_single_row" CHECK ("shop_promo"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "comfort" jsonb;