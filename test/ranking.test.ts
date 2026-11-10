import { describe, expect, it } from "vitest";
import {
  bayesianScore,
  PRIOR_MEAN,
  PRIOR_WEIGHT,
  RANK_THRESHOLD,
  rankOne,
  rankProjects,
} from "../src/lib/ranking";

const w = (reviewer: string, rating: number, outcome = 0) => ({ reviewer, rating, outcome });

describe("ranking aggregation", () => {
  it("reports empty datasets honestly", () => {
    const r = rankOne(1, []);
    expect(r.status).toBe("early_feedback");
    expect(r.score).toBeNull();
    expect(r.rank).toBeNull();
    expect(r.wallets).toBe(0);
    expect(r.averageRating).toBeNull();
  });

  it("keeps one or two wallets in early feedback", () => {
    expect(rankOne(1, [w("0xa", 5)]).status).toBe("early_feedback");
    expect(rankOne(1, [w("0xa", 5), w("0xb", 1)]).status).toBe("early_feedback");
    const both = rankOne(1, [w("0xa", 5), w("0xb", 1)]);
    expect(both.score).toBeNull();
    expect(both.averageRating).toBe(3);
  });

  it("computes the documented Bayesian formula at threshold", () => {
    const reviews = [w("0xa", 5), w("0xb", 4), w("0xc", 3)];
    const r = rankOne(1, reviews);
    expect(r.status).toBe("ranked");
    expect(r.wallets).toBe(3);
    expect(r.averageRating).toBe(4);
    expect(r.score).toBeCloseTo((3 * 4 + PRIOR_WEIGHT * PRIOR_MEAN) / (3 + PRIOR_WEIGHT), 10);
    expect(bayesianScore(3, 4)).toBe(r.score);
  });

  it("counts rating distribution and outcome splits", () => {
    const r = rankOne(1, [w("0xa", 5, 0), w("0xb", 5, 1), w("0xc", 1, 1)]);
    expect(r.distribution).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 });
    expect(r.workedWell).toBe(1);
    expect(r.withFriction).toBe(2);
  });

  it("dedupes repeat wallets defensively", () => {
    const r = rankOne(1, [w("0xAA", 5), w("0xaa", 4), w("0xb", 3)]);
    expect(r.wallets).toBe(2);
    expect(r.status).toBe("early_feedback");
  });

  it("sorts ranked before early feedback, deterministically", () => {
    const out = rankProjects([
      { projectId: 9, reviews: [w("0xa", 5)] },
      { projectId: 3, reviews: [w("0xa", 4), w("0xb", 4), w("0xc", 4)] },
      { projectId: 5, reviews: [w("0xa", 5), w("0xb", 5), w("0xc", 5)] },
      { projectId: 7, reviews: [] },
    ]);
    // 5-star trio outranks 4-star trio; early feedback follows by wallets, id.
    expect(out.map((r) => r.projectId)).toEqual([5, 3, 9, 7]);
    expect(out[0].rank).toBe(1);
    expect(out[1].rank).toBe(2);
    expect(out[2].rank).toBeNull();
    const again = rankProjects([
      { projectId: 9, reviews: [w("0xa", 5)] },
      { projectId: 3, reviews: [w("0xa", 4), w("0xb", 4), w("0xc", 4)] },
      { projectId: 5, reviews: [w("0xa", 5), w("0xb", 5), w("0xc", 5)] },
      { projectId: 7, reviews: [] },
    ]);
    expect(again.map((r) => r.projectId)).toEqual([5, 3, 9, 7]);
  });

  it("breaks score ties by wallet count then project id", () => {
    const out = rankProjects([
      { projectId: 20, reviews: [w("0xa", 5), w("0xb", 5), w("0xc", 5)] },
      { projectId: 10, reviews: [w("0xa", 5), w("0xb", 5), w("0xc", 5)] },
    ]);
    expect(out.map((r) => r.projectId)).toEqual([10, 20]);
    expect(RANK_THRESHOLD).toBe(3);
  });
});
