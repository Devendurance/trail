import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { reviews } from "../src/db/schema";
import {
  getProjectFeed,
  getPublishedReview,
  getRankings,
  listSupportedProjects,
} from "../src/lib/discovery";

const HAS_DB = Boolean(process.env.DATABASE_URL);
const WALLETS = [
  `0x${"a1".repeat(20)}`,
  `0x${"b2".repeat(20)}`,
  `0x${"c3".repeat(20)}`,
];

const ALL_WALLETS = [...WALLETS, `0x${"d4".repeat(20)}`];

describe.skipIf(!HAS_DB)("public discovery (isolated test rows)", () => {
  afterAll(async () => {
    const db = getDb();
    for (const w of ALL_WALLETS) {
      await db.delete(reviews).where(eq(reviews.reviewer, w));
    }
  });

  it("publishes only real rows: drafts stay invisible, links are honest", async () => {
    const db = getDb();
    const mkProof = () => `0x${randomBytes(32).toString("hex")}`;
    for (let i = 0; i < 3; i++) {
      await db.insert(reviews).values({
        projectId: 1,
        reviewer: WALLETS[i],
        chainId: 31337,
        proofTxHash: mkProof(),
        reviewTxHash: mkProof(),
        rating: [5, 4, 3][i],
        outcome: i === 2 ? 1 : 0,
        normalizedBody: `Discovery test review number ${i} with enough characters to be realistic and useful for ranking checks.`,
        contentHash: mkProof(),
        status: "published",
        onchainReviewId: 900 + i,
      });
    }
    await db.insert(reviews).values({
      projectId: 1,
      reviewer: `0x${"d4".repeat(20)}`,
      chainId: 31337,
      proofTxHash: mkProof(),
      rating: 5,
      outcome: 0,
      normalizedBody: "A draft that must never appear publicly under any circumstance whatsoever here.",
      contentHash: mkProof(),
      status: "draft",
    });

    const projects = await listSupportedProjects();
    const botNames = projects.find((p) => p.slug === "bot-names");
    expect(botNames?.publishedReviews).toBeGreaterThanOrEqual(3);

    const feed = await getProjectFeed("bot-names");
    expect(feed?.reviews.length).toBeGreaterThanOrEqual(3);
    expect(feed?.reviews.every((r) => r.body.length > 0)).toBe(true);
    expect(feed?.reviews.some((r) => r.reviewer === `0x${"d4".repeat(20)}`)).toBe(false);
    const first = feed!.reviews[0];
    expect(first.proofUrl).toBe(`https://scan.botchain.ai/tx/${first.proofTxHash}`);
    expect(first.publicationUrl).toBe(`https://scan.botchain.ai/tx/${first.reviewTxHash}`);
    expect(typeof first.publishedAt).toBe("string");

    const detail = await getPublishedReview(first.id);
    expect(detail?.review.id).toBe(first.id);
    expect(detail?.project?.slug).toBe("bot-names");

    const missing = await getProjectFeed("no-such-app");
    expect(missing).toBeNull();

    const rankings = await getRankings();
    const entry = rankings.rankings.find((r) => r.project?.slug === "bot-names");
    expect(entry?.wallets).toBeGreaterThanOrEqual(3);
    expect(entry?.status).toBe("ranked");
    expect(entry?.rank).toBeGreaterThanOrEqual(1);
    expect(entry?.score).toBeGreaterThan(0);
    expect(rankings.methodology).toContain("Bayesian");
  });
});
