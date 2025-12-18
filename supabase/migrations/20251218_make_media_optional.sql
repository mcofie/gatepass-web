-- Ensure logo_url exists and make all media columns nullable
ALTER TABLE "gatepass"."events" ADD COLUMN IF NOT EXISTS "logo_url" text;

ALTER TABLE "gatepass"."events" ALTER COLUMN "poster_url" DROP NOT NULL;
ALTER TABLE "gatepass"."events" ALTER COLUMN "video_url" DROP NOT NULL;
ALTER TABLE "gatepass"."events" ALTER COLUMN "logo_url" DROP NOT NULL;
