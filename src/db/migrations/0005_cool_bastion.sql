CREATE TABLE "community_slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_slug" varchar(100) NOT NULL,
	"new_slug" varchar(100) NOT NULL,
	"community_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "community_slug_redirects_old_slug_unique" UNIQUE("old_slug")
);
--> statement-breakpoint
ALTER TABLE "community_slug_redirects" ADD CONSTRAINT "community_slug_redirects_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "old_slug_idx" ON "community_slug_redirects" USING btree ("old_slug");