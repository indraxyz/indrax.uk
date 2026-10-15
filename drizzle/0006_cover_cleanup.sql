CREATE TABLE "cover_cleanup" (
	"url" text PRIMARY KEY NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_cover_cleanup_attempted" ON "cover_cleanup" USING btree ("attempted_at","url");