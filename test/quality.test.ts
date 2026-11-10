import { describe, expect, it } from "vitest";
import { decisionForTotal, QUALITY_THRESHOLD, validateScores } from "../src/lib/quality";

describe("review-quality rubric", () => {
  it("scores five 0-2 dimensions up to 10", () => {
    const full = validateScores({ specificity: 2, outcomeClarity: 2, helpfulness: 2, originality: 2, actionability: 2 });
    expect("total" in full && full.total).toBe(10);
    const none = validateScores({ specificity: 0, outcomeClarity: 0, helpfulness: 0, originality: 0, actionability: 0 });
    expect("total" in none && none.total).toBe(0);
  });

  it("approves at 7/10 and rejects below, independent of the DApp rating", () => {
    expect(QUALITY_THRESHOLD).toBe(7);
    // A detailed negative review (rating 1) is fully eligible: rubric has no rating input.
    expect(decisionForTotal(9)).toBe("approved");
    expect(decisionForTotal(7)).toBe("approved");
    expect(decisionForTotal(6)).toBe("rejected");
  });

  it("rejects out-of-range or missing dimensions", () => {
    expect("error" in validateScores({ specificity: 3, outcomeClarity: 2, helpfulness: 2, originality: 2, actionability: 2 })).toBe(true);
    expect("error" in validateScores({ specificity: -1, outcomeClarity: 2, helpfulness: 2, originality: 2, actionability: 2 })).toBe(true);
    expect("error" in validateScores({ specificity: 1.5, outcomeClarity: 2, helpfulness: 2, originality: 2, actionability: 1 })).toBe(true);
    expect("error" in validateScores({ specificity: 2 })).toBe(true);
    expect("error" in validateScores(null)).toBe(true);
  });
});
