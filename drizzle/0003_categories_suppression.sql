ALTER TABLE "orders" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "gender" text;--> statement-breakpoint
CREATE INDEX "orders_deleted_at_idx" ON "orders" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_gender_valid" CHECK ("variants"."gender" is null or "variants"."gender" in ('homme', 'femme', 'unisexe'));