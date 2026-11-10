import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { projects, qualityAssessments, reviews, rewardAllocations, supportedActions } from "@/db/schema";
import { explorerTxUrl } from "./config";
import { latestAssessment, rewardStateOf } from "./quality";
import { PRIOR_MEAN, PRIOR_WEIGHT, RANK_THRESHOLD, rankProjects } from "./ranking";

export const VERIFICATION_LIMITS =
  "Trail verifies one successful supported on-chain action per review. " +
  "A verified action proves the wallet completed that action, not that the whole product worked, " +
  "that the reviewer is unique, or that the words are accurate. " +
  "Actions that fail before succeeding are underrepresented. Rankings need at least 3 distinct reviewer wallets.";

export const RANK_METHOD =
  `Community score = (n * avg + ${PRIOR_WEIGHT} * ${PRIOR_MEAN}) / (n + ${PRIOR_WEIGHT}), ` +
  `a Bayesian average with a neutral ${PRIOR_MEAN}/5 prior. Projects with fewer than ${RANK_THRESHOLD} ` +
  `distinct reviewer wallets are early feedback, not ranked. Reward amounts and quality scores never enter this formula.`;

export interface PublicReview {
  id: number;
  onchainReviewId: number;
  projectId: number;
  reviewer: string;
  rating: number;
  outcome: number;
  body: string;
  proofTxHash: string;
  reviewTxHash: string;
  proofUrl: string;
  publicationUrl: string;
  publishedAt: string;
  rewardState: string;
}

export function toPublicReview(
  r: typeof reviews.$inferSelect,
  rewardState: string,
): PublicReview {
  return {
    id: r.id,
    onchainReviewId: r.onchainReviewId ?? 0,
    projectId: r.projectId,
    reviewer: r.reviewer,
    rating: r.rating,
    outcome: r.outcome,
    body: r.normalizedBody,
    proofTxHash: r.proofTxHash,
    reviewTxHash: r.reviewTxHash ?? "",
    proofUrl: explorerTxUrl(r.proofTxHash),
    publicationUrl: r.reviewTxHash ? explorerTxUrl(r.reviewTxHash) : "",
    publishedAt: (r.updatedAt ?? r.createdAt).toISOString(),
    rewardState,
  };
}

export async function rewardStateFor(reviewId: number): Promise<string> {
  const db = getDb();
  const rows = await db.select().from(qualityAssessments).where(eq(qualityAssessments.reviewId, reviewId));
  const current = latestAssessment(rows);
  if (!current || current.decision !== "approved") return rewardStateOf(current, null);
  const allocation = (await db.select().from(rewardAllocations).where(eq(rewardAllocations.reviewId, reviewId)))[0];
  return rewardStateOf(current, allocation?.status ?? null);
}

export async function listSupportedProjects() {
  const db = getDb();
  const all = await db.select().from(projects).where(eq(projects.status, "supported"));
  const out = [];
  for (const p of all) {
    const action = (
      await db
        .select()
        .from(supportedActions)
        .where(and(eq(supportedActions.projectId, p.id), eq(supportedActions.enabled, true)))
        .orderBy(desc(supportedActions.version))
        .limit(1)
    )[0];
    const published = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.projectId, p.id), eq(reviews.status, "published")));
    out.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      officialUrl: p.officialUrl,
      category: p.category,
      description: p.description,
      publishedReviews: published.length,
      supportedAction: action
        ? {
          version: action.version,
          chainId: action.chainId,
          target: action.approvedTarget,
          selector: action.functionSelector,
          eventTopic: action.eventTopic0,
          sampleTxHash: action.sampleTxHash,
          sampleTxUrl: action.sampleTxHash ? explorerTxUrl(action.sampleTxHash) : null,
        }
        : null,
    });
  }
  return out.sort((a, b) => a.id - b.id);
}

export async function getProjectFeed(slug: string, limit = 50) {
  const db = getDb();
  const project = (await db.select().from(projects).where(eq(projects.slug, slug)))[0];
  if (!project || project.status !== "supported") return null;
  const action = (
    await db
      .select()
      .from(supportedActions)
      .where(and(eq(supportedActions.projectId, project.id), eq(supportedActions.enabled, true)))
      .orderBy(desc(supportedActions.version))
      .limit(1)
  )[0];
  const rows = await db
    .select()
    .from(reviews)
    .where(and(eq(reviews.projectId, project.id), eq(reviews.status, "published")))
    .orderBy(desc(reviews.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  const items: PublicReview[] = [];
  for (const r of rows) items.push(toPublicReview(r, await rewardStateFor(r.id)));
  return { project, action: action ?? null, reviews: items, verificationLimits: VERIFICATION_LIMITS };
}

export async function getPublishedReview(id: number) {
  const db = getDb();
  const row = (await db.select().from(reviews).where(eq(reviews.id, id)))[0];
  if (!row || row.status !== "published") return null;
  const project = (await db.select().from(projects).where(eq(projects.id, row.projectId)))[0] ?? null;
  return {
    review: toPublicReview(row, await rewardStateFor(row.id)),
    project,
    verificationLimits: VERIFICATION_LIMITS,
  };
}

export async function getRankings() {
  const db = getDb();
  const supported = await db.select().from(projects).where(eq(projects.status, "supported"));
  const entries = [];
  const recent: Record<number, PublicReview[]> = {};
  for (const p of supported) {
    const rows = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.projectId, p.id), eq(reviews.status, "published")))
      .orderBy(desc(reviews.updatedAt));
    entries.push({
      projectId: p.id,
      reviews: rows.map((r) => ({ reviewer: r.reviewer, rating: r.rating, outcome: r.outcome })),
    });
    recent[p.id] = [];
    for (const r of rows.slice(0, 3)) recent[p.id].push(toPublicReview(r, await rewardStateFor(r.id)));
  }
  const ranks = rankProjects(entries);
  const byId = new Map(supported.map((p) => [p.id, p]));
  return {
    methodology: RANK_METHOD,
    limitations: VERIFICATION_LIMITS,
    rankings: ranks.map((r) => ({
      ...r,
      project: byId.get(r.projectId) ? {
        id: r.projectId,
        slug: byId.get(r.projectId)!.slug,
        name: byId.get(r.projectId)!.name,
      } : null,
      recentReviews: recent[r.projectId] ?? [],
    })),
  };
}
