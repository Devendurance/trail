CREATE TABLE "login_nonces" (
	"nonce_hash" text PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"chain_id" integer NOT NULL,
	"domain" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"official_url" text NOT NULL,
	"category" text DEFAULT 'dapp' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"onchain_review_id" integer,
	"project_id" integer NOT NULL,
	"reviewer" text NOT NULL,
	"chain_id" integer DEFAULT 677 NOT NULL,
	"proof_tx_hash" text NOT NULL,
	"review_tx_hash" text,
	"rating" smallint NOT NULL,
	"outcome" smallint NOT NULL,
	"normalized_body" text NOT NULL,
	"content_hash" text NOT NULL,
	"auth_nonce" bigint,
	"auth_deadline" timestamp with time zone,
	"signature" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supported_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"chain_id" integer NOT NULL,
	"approved_target" text NOT NULL,
	"function_selector" text NOT NULL,
	"event_emitter" text NOT NULL,
	"event_topic0" text NOT NULL,
	"min_block" bigint NOT NULL,
	"eligible_wallet_rule" text DEFAULT 'eoa' NOT NULL,
	"sample_tx_hash" text,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallet" text NOT NULL,
	"project_id" integer,
	"tx_hash" text NOT NULL,
	"result_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supported_actions" ADD CONSTRAINT "supported_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_attempts" ADD CONSTRAINT "verification_attempts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_unique" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_chain_proof_published_unique" ON "reviews" USING btree ("chain_id","proof_tx_hash") WHERE "reviews"."status" = 'published';--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_project_reviewer_published_unique" ON "reviews" USING btree ("project_id","reviewer") WHERE "reviews"."status" = 'published';--> statement-breakpoint
CREATE INDEX "reviews_reviewer_idx" ON "reviews" USING btree ("reviewer");--> statement-breakpoint
CREATE INDEX "reviews_project_status_idx" ON "reviews" USING btree ("project_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "supported_actions_project_version_unique" ON "supported_actions" USING btree ("project_id","version");