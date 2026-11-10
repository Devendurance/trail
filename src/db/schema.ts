import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  smallint,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    officialUrl: text("official_url").notNull(),
    category: text("category").notNull().default("dapp"),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("projects_slug_unique").on(t.slug)],
);

export const supportedActions = pgTable(
  "supported_actions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id),
    version: integer("version").notNull().default(1),
    chainId: integer("chain_id").notNull(),
    approvedTarget: text("approved_target").notNull(),
    functionSelector: text("function_selector").notNull(),
    eventEmitter: text("event_emitter").notNull(),
    eventTopic0: text("event_topic0").notNull(),
    minBlock: bigint("min_block", { mode: "number" }).notNull(),
    eligibleWalletRule: text("eligible_wallet_rule").notNull().default("eoa"),
    sampleTxHash: text("sample_tx_hash"),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [uniqueIndex("supported_actions_project_version_unique").on(t.projectId, t.version)],
);

export const loginNonces = pgTable("login_nonces", {
  nonceHash: text("nonce_hash").primaryKey(),
  wallet: text("wallet").notNull(),
  chainId: integer("chain_id").notNull(),
  domain: text("domain").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    onchainReviewId: integer("onchain_review_id"),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id),
    reviewer: text("reviewer").notNull(),
    chainId: integer("chain_id").notNull().default(677),
    proofTxHash: text("proof_tx_hash").notNull(),
    reviewTxHash: text("review_tx_hash"),
    rating: smallint("rating").notNull(),
    outcome: smallint("outcome").notNull(),
    normalizedBody: text("normalized_body").notNull(),
    contentHash: text("content_hash").notNull(),
    authNonce: bigint("auth_nonce", { mode: "number" }),
    authDeadline: timestamp("auth_deadline", { withTimezone: true }),
    signature: text("signature"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One proof hash may only back a single published review per chain.
    uniqueIndex("reviews_chain_proof_published_unique")
      .on(t.chainId, t.proofTxHash)
      .where(sql`${t.status} = 'published'`),
    // One published review per wallet per project.
    uniqueIndex("reviews_project_reviewer_published_unique")
      .on(t.projectId, t.reviewer)
      .where(sql`${t.status} = 'published'`),
    index("reviews_reviewer_idx").on(t.reviewer),
    index("reviews_project_status_idx").on(t.projectId, t.status),
  ],
);

export const verificationAttempts = pgTable("verification_attempts", {
  id: serial("id").primaryKey(),
  wallet: text("wallet").notNull(),
  projectId: integer("project_id").references(() => projects.id),
  txHash: text("tx_hash").notNull(),
  resultCode: text("result_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const qualityAssessments = pgTable("quality_assessments", {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id")
      .notNull()
      .references(() => reviews.id),
    specificity: smallint("specificity").notNull(),
    outcomeClarity: smallint("outcome_clarity").notNull(),
    helpfulness: smallint("helpfulness").notNull(),
    originality: smallint("originality").notNull(),
    actionability: smallint("actionability").notNull(),
    total: smallint("total").notNull(),
    decision: text("decision").notNull(),
    assessor: text("assessor").notNull(),
    reason: text("reason").notNull(),
    assessedAt: timestamp("assessed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // No unique constraint: every moderation decision is kept as audit history.
  // The latest assessment per review is the current one.
);

export const rewardAllocations = pgTable(
  "reward_allocations",
  {
    id: serial("id").primaryKey(),
    reviewId: integer("review_id")
      .notNull()
      .references(() => reviews.id),
    claimant: text("claimant").notNull(),
    amountWei: text("amount_wei"),
    status: text("status").notNull().default("approved_unfunded"),
    chainTxHash: text("chain_tx_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("reward_allocations_review_unique").on(t.reviewId)],
);

export type Project = typeof projects.$inferSelect;
export type SupportedAction = typeof supportedActions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
