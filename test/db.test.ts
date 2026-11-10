import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "../src/db";
import { loginNonces, reviews } from "../src/db/schema";
import { findBlockingReview, loadSupportedAction } from "../src/lib/proofs";
import { createHash, randomBytes } from "node:crypto";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("postgres backing store", () => {
  it("seeds BOT Names as project 1 with an enabled v1 action", async () => {
    const loaded = await loadSupportedAction(1, 677);
    expect(loaded?.project.slug).toBe("bot-names");
    expect(loaded?.action.functionSelector).toBe("0xc319a11f");
    expect(loaded?.action.version).toBe(1);
  });

  it("consumes a login nonce exactly once, even concurrently", async () => {
    const db = getDb();
    const nonce = randomBytes(32).toString("hex");
    const nonceHash = createHash("sha256").update(nonce).digest("hex");
    await db.insert(loginNonces).values({
      nonceHash,
      wallet: "0x00000000000000000000000000000000000test1",
      chainId: 677,
      domain: "test",
      expiresAt: new Date(Date.now() + 600_000),
    });
    const consume = () =>
      db.execute(sql`UPDATE login_nonces SET used_at = now()
        WHERE nonce_hash = ${nonceHash} AND used_at IS NULL AND expires_at > now()
        RETURNING nonce_hash`);
    const [a, b] = await Promise.all([consume(), consume()]);
    expect((a.rows.length + b.rows.length)).toBe(1);
  });

  it("blocks reused proofs and duplicate wallet reviews, then releases stale drafts", async () => {
    const db = getDb();
    const proof = `0x${"c3".repeat(32)}`;
    const wallet = `0x${"d4".repeat(20)}`;
    await db.insert(reviews).values({
      projectId: 1,
      reviewer: wallet,
      chainId: 677,
      proofTxHash: proof,
      rating: 5,
      outcome: 0,
      normalizedBody: "x".repeat(120),
      contentHash: `0x${"e5".repeat(32)}`,
      status: "prepared",
      authDeadline: new Date(Date.now() + 600_000),
    });
    expect(await findBlockingReview({ chainId: 677, projectId: 1, reviewer: wallet, proofTxHash: proof })).toBe("PROOF_ALREADY_USED");
    expect(
      await findBlockingReview({ chainId: 677, projectId: 1, reviewer: wallet, proofTxHash: `0x${"f6".repeat(32)}` }),
    ).toBe("REVIEW_ALREADY_EXISTS");
    await db.execute(sql`DELETE FROM reviews WHERE proof_tx_hash = ${proof}`);
    expect(await findBlockingReview({ chainId: 677, projectId: 1, reviewer: wallet, proofTxHash: proof })).toBeNull();
  });
});
