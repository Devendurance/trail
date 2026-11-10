/// Transparent, sample-size-aware ranking. Only eligible published reviews
/// feed this formula. Reward status, quality scores, votes and volume are
/// never inputs. Distinct wallets are counted, never claimed as distinct humans.

export const PRIOR_MEAN = 3.0;
export const PRIOR_WEIGHT = 5;
export const RANK_THRESHOLD = 3;

export interface RankInput {
  reviewer: string;
  rating: number;
  outcome: number;
}

export interface ProjectRank {
  projectId: number;
  wallets: number;
  averageRating: number | null;
  distribution: { [rating: number]: number };
  workedWell: number;
  withFriction: number;
  score: number | null;
  status: "ranked" | "early_feedback";
  rank: number | null;
}

export function bayesianScore(n: number, avg: number): number {
  return (n * avg + PRIOR_WEIGHT * PRIOR_MEAN) / (n + PRIOR_WEIGHT);
}

export function rankOne(projectId: number, reviews: RankInput[]): ProjectRank {
  const wallets = new Set(reviews.map((r) => r.reviewer.toLowerCase()));
  const n = wallets.size;
  const distribution: { [rating: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let workedWell = 0;
  for (const r of reviews) {
    // One review per wallet per project is enforced upstream; dedupe defensively.
    sum += r.rating;
    distribution[r.rating] = (distribution[r.rating] ?? 0) + 1;
    if (r.outcome === 0) workedWell += 1;
  }
  if (n < RANK_THRESHOLD) {
    return {
      projectId, wallets: n, averageRating: n > 0 ? sum / reviews.length : null,
      distribution, workedWell, withFriction: reviews.length - workedWell,
      score: null, status: "early_feedback", rank: null,
    };
  }
  const avg = sum / reviews.length;
  return {
    projectId, wallets: n, averageRating: avg, distribution,
    workedWell, withFriction: reviews.length - workedWell,
    score: bayesianScore(n, avg), status: "ranked", rank: null,
  };
}

/// Deterministic order: ranked by score desc, then wallets desc, then
/// projectId asc. Early-feedback projects follow by wallets desc, id asc.
export function rankProjects(entries: { projectId: number; reviews: RankInput[] }[]): ProjectRank[] {
  const ranked = entries.map((e) => rankOne(e.projectId, e.reviews));
  const solid = ranked.filter((r) => r.status === "ranked").sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0) || b.wallets - a.wallets || a.projectId - b.projectId,
  );
  solid.forEach((r, i) => { r.rank = i + 1; });
  const early = ranked.filter((r) => r.status === "early_feedback").sort(
    (a, b) => b.wallets - a.wallets || a.projectId - b.projectId,
  );
  return [...solid, ...early];
}
