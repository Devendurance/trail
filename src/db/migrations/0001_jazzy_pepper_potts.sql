CREATE TABLE "quality_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"specificity" smallint NOT NULL,
	"outcome_clarity" smallint NOT NULL,
	"helpfulness" smallint NOT NULL,
	"originality" smallint NOT NULL,
	"actionability" smallint NOT NULL,
	"total" smallint NOT NULL,
	"decision" text NOT NULL,
	"assessor" text NOT NULL,
	"reason" text NOT NULL,
	"assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"claimant" text NOT NULL,
	"amount_wei" text,
	"status" text DEFAULT 'approved_unfunded' NOT NULL,
	"chain_tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "quality_assessments" ADD CONSTRAINT "quality_assessments_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_allocations" ADD CONSTRAINT "reward_allocations_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quality_assessments_review_unique" ON "quality_assessments" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reward_allocations_review_unique" ON "reward_allocations" USING btree ("review_id");