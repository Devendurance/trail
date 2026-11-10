import { describe, expect, it } from "vitest";
import { latestAssessment, rewardStateOf } from "../src/lib/quality";

const t = (s: string) => new Date(s);

describe("latest quality assessment", () => {
  it("newer rejection overrides older approval regardless of row order", () => {
    const rows = [
      { id: 2, decision: "rejected", assessedAt: t("2026-02-01") },
      { id: 1, decision: "approved", assessedAt: t("2026-01-01") },
    ];
    for (const order of [rows, [...rows].reverse()]) {
      expect(latestAssessment(order)?.decision).toBe("rejected");
      expect(rewardStateOf(latestAssessment(order), "approved_unfunded")).toBe("rejected");
    }
  });

  it("newer approval overrides older rejection", () => {
    const rows = [
      { id: 1, decision: "rejected", assessedAt: t("2026-01-01") },
      { id: 2, decision: "approved", assessedAt: t("2026-02-01") },
    ];
    expect(rewardStateOf(latestAssessment(rows), null)).toBe("approved_unfunded");
  });

  it("ties on timestamp break by highest id", () => {
    const same = t("2026-01-01");
    const rows = [
      { id: 5, decision: "approved", assessedAt: same },
      { id: 9, decision: "rejected", assessedAt: same },
      { id: 3, decision: "approved", assessedAt: same },
    ];
    expect(latestAssessment(rows)?.id).toBe(9);
  });

  it("no assessment is pending", () => {
    expect(rewardStateOf(latestAssessment([]), null)).toBe("pending_review");
  });
});
