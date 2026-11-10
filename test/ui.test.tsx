// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Banner, EmptyState, ReviewCard, safeHttp } from "../src/components/ui";
import type { PublicReview } from "../src/lib/client/types";

const review: PublicReview = {
  id: 7, onchainReviewId: 1, projectId: 1, reviewer: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  rating: 2, outcome: 1, body: "<script>alert(1)</script> it was slow", proofTxHash: "0x" + "ab".repeat(32),
  reviewTxHash: "0x" + "cd".repeat(32), proofUrl: "", publicationUrl: "", publishedAt: "2026-11-10T00:00:00.000Z", rewardState: "approved_unfunded",
};

describe("review rendering", () => {
  it("renders review text as plain text and links to the detail page", () => {
    const { container } = render(<ReviewCard r={review} />);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/<script>alert\(1\)<\/script> it was slow/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read review" }).getAttribute("href")).toBe("/reviews/7");
    expect(screen.getByText("Worked with friction")).toBeTruthy();
    expect(screen.getByText("Approved, awaiting funding")).toBeTruthy();
    expect(screen.getByRole("img", { name: "2 out of 5" })).toBeTruthy();
  });

  it("shows honest empty and error states", () => {
    render(<><EmptyState title="No verified reviews yet">Nothing is rated.</EmptyState><Banner tone="error" title="Wrong network">x</Banner></>);
    expect(screen.getByText("No verified reviews yet")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Wrong network");
  });
});

describe("safe outbound links", () => {
  it("allows only http(s)", () => {
    expect(safeHttp("https://botnames.example/")).toBe("https://botnames.example/");
    expect(safeHttp("javascript:alert(1)")).toBeNull();
    expect(safeHttp("data:text/html,x")).toBeNull();
    expect(safeHttp(null)).toBeNull();
    expect(safeHttp("not a url")).toBeNull();
  });
});
