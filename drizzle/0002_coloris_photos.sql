CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"sha256" text NOT NULL,
	"size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "color_name_ar" text;