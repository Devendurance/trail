import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { qualityAssessments, rewardAllocations, reviews } from "@/db/schema";
import { rewardsProgramFlags } from "@/lib/config";

/// Read-only reward-program status. No vault exists in Slice 4, so nothing
/// is ever claimable here. Approved reviews report approved_unfunded.
export async function GET() {
  const flags = rewardsProgramFlags();
  try {
    const db = getDb();
    const published = (await db.select({ n: count() }).from(reviews).where(eq(reviews.status, "published")))[0]?.n ?? 0;
    const assessed = (await db.select({ n: count() }).from(qualityAssessments))[0]?.n ?? 0;
    const unfunded = (
      await db.select({ n: count() }).from(rewardAllocations).where(eq(rewardAllocations.status, "approved_unfunded"))
    )[0]?.n ?? 0;
    return NextResponse.json({
      program: {
        ...flags,
        claimable: false,
        note: "Quality rewards are policy-defined but unfunded. No BOT amount is promised and nothing is claimable.",
      },
      counts: { publishedReviews: published, assessments: assessed, approvedUnfunded: unfunded },
      policy: "Helpful reviews can earn BOT. Rating does not affect eligibility. Threshold 7/10, human moderated.",
    });
  } catch {
    return NextResponse.json({ error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }, { status: 503 });
  }
}
