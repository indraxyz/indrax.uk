CREATE TABLE "series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "series_order" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(jsonb_path_query_array(content_json, '$.**.text')::text, '')), 'C')) STORED;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_posts_search" ON "posts" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "idx_posts_series" ON "posts" USING btree ("series_id","series_order");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_posts_series_order_unique" ON "posts" USING btree ("series_id","series_order") WHERE "posts"."series_id" is not null;