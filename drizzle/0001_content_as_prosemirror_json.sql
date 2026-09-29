ALTER TABLE "posts" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "content_json" jsonb;