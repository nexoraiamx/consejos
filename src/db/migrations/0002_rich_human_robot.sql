CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"code" varchar(100) NOT NULL,
	"creator_id" varchar(256) NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"max_uses" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"user_id" varchar(256) NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "join_req_user_community_unique" UNIQUE("community_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invite_code_idx" ON "invitations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "invite_community_idx" ON "invitations" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "join_req_community_idx" ON "join_requests" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX "join_req_user_idx" ON "join_requests" USING btree ("user_id");