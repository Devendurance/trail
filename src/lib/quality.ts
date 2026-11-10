/// Review-quality assessment per QUALITY_REWARDS_POLICY.md.
/// Quality is independent of the user's 1-5 DApp rating: a detailed 1-star
/// review can score 10/10, a glowing one-liner can score near zero.

export const QUALITY_THRESHOLD = 7;

export interface QualityScores {
  specificity: number;
  outcomeClarity: number;
  helpfulness: number;
  originality: number;
  actionability: number;
}

export function validateScores(input: unknown): { scores: QualityScores; total: number } | { error: string } {
  if (typeof input !== "object" || input === null) return { error: "scores required" };
  const out: Record<string, number> = {};
  for (const key of ["specificity", "outcomeClarity", "helpfulness", "originality", "actionability"] as const) {
    const v = (input as Record<string, unknown>)[key];
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 2) {
      return { error: `${key} must be an integer 0-2` };
    }
    out[key] = v as number;
  }
  const scores = out as unknown as QualityScores;
  const total = scores.specificity + scores.outcomeClarity + scores.helpfulness + scores.originality + scores.actionability;
  return { scores, total };
}

export function decisionForTotal(total: number): "approved" | "rejected" {
  return total >= QUALITY_THRESHOLD ? "approved" : "rejected";
}

export interface AssessmentLike {
  id: number;
  decision: string;
  assessedAt: Date | string;
}

/// Deterministic "current" assessment: newest assessedAt, ties broken by
/// highest id. The table is audit history, so older rows never override.
export function latestAssessment<T extends AssessmentLike>(rows: T[]): T | null {
  let best: T | null = null;
  for (const r of rows) {
    if (!best) {
      best = r;
      continue;
    }
    const a = new Date(r.assessedAt).getTime();
    const b = new Date(best.assessedAt).getTime();
    if (a > b || (a === b && r.id > best.id)) best = r;
  }
  return best;
}

export function rewardStateOf(
  assessment: AssessmentLike | null,
  allocationStatus: string | null,
): string {
  if (!assessment) return "pending_review";
  if (assessment.decision !== "approved") return "rejected";
  if (allocationStatus === "claimed") return "claimed";
  if (allocationStatus === "claimable") return "claimable";
  return "approved_unfunded";
}
