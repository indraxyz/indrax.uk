CREATE TABLE "post_reactions" (
	"post_id" uuid NOT NULL,
	"visitor_id" uuid NOT NULL,
	"reaction" text NOT NULL,
	CONSTRAINT "post_reactions_post_id_visitor_id_reaction_pk" PRIMARY KEY("post_id","visitor_id","reaction"),
	CONSTRAINT "post_reactions_reaction_valid" CHECK ("post_reactions"."reaction" in ('love', 'noted', 'thumbsup', 'fire', 'rocket'))
);
--> statement-breakpoint
ALTER TABLE "post_reactions" ADD CONSTRAINT "post_reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;