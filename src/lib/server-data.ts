import { getProjectFeed, getPublishedReview, getRankings, listSupportedProjects, VERIFICATION_LIMITS } from "./discovery";
import { rewardsProgramFlags } from "./config";
import { getDb } from "@/db";
import { qualityAssessments, rewardAllocations, reviews } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import type { ProjectFeed, ProjectsResponse, RankingsResponse, ReviewDetail, RewardsStatus } from "./client/types";

export type Loaded<T> = { state: "ok"; data: T } | { state: "not_found" } | { state: "unavailable" };

/// Server pages read the same discovery functions the /api routes use, so the
/// page and the API cannot drift. JSON round-trip yields the wire shape.
async function load<T>(fn: () => Promise<unknown | null>): Promise<Loaded<T>> {
  try {
    const v = await fn();
    if (v === null) return { state: "not_found" };
    return { state: "ok", data: JSON.parse(JSON.stringify(v)) as T };
  } catch {
    return { state: "unavailable" };
  }
}

export const loadProjects = () =>
  load<ProjectsResponse>(async () => ({ projects: await listSupportedProjects(), verificationLimits: VERIFICATION_LIMITS }));
export const loadProject = (slug: string) => load<ProjectFeed>(() => getProjectFeed(slug));
export const loadReview = (id: number) => load<ReviewDetail>(() => getPublishedReview(id));
export const loadRankings = () => load<RankingsResponse>(() => getRankings());

/// Mirrors /api/rewards/status.
export const loadRewards = () =>
  load<RewardsStatus>(async () => {
    const flags = rewardsProgramFlags();
    const db = getDb();
    const published = (await db.select({ n: count() }).from(reviews).where(eq(reviews.status, "published")))[0]?.n ?? 0;
    const assessed = (await db.select({ n: count() }).from(qualityAssessments))[0]?.n ?? 0;
    const unfunded = (await db.select({ n: count() }).from(rewardAllocations).where(eq(rewardAllocations.status, "approved_unfunded")))[0]?.n ?? 0;
    return {
      program: { ...flags, claimable: false, note: "Quality rewards are policy-defined but unfunded. No BOT amount is promised and nothing is claimable." },
      counts: { publishedReviews: published, assessments: assessed, approvedUnfunded: unfunded },
      policy: "Helpful reviews can earn BOT. Rating does not affect eligibility. Threshold 7/10, human moderated.",
    };
  });
