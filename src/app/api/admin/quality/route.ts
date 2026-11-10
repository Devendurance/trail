import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { qualityAssessments, reviews, rewardAllocations } from "@/db/schema";
import { clientIp, rateLimit } from "@/lib/auth";
import { getAdminAddresses, getAppDomain } from "@/lib/config";
import { decisionForTotal, validateScores } from "@/lib/quality";
import { rewardStateFor } from "@/lib/discovery";
import { readSession } from "@/lib/session";

const Body = z.object({
  reviewId: z.number().int().positive(),
  scores: z.unknown(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().min(10).max(1000),
});

function originAllowed(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    const host = new URL(origin).host;
    const reqHost = new URL(req.url).host;
    return host === reqHost || host === getAppDomain();
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!rateLimit(`adminq:${clientIp(req.headers)}`, 30, 60_000)) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "Too many requests." } }, { status: 429 });
  }
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  }
  if (!getAdminAddresses().includes(session.wallet.toLowerCase())) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Admin access required." } }, { status: 403 });
  }
  if (!originAllowed(req)) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Cross-origin request rejected." } }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "reviewId, scores, decision, reason required." } }, { status: 400 });
  }
  const { reviewId, decision, reason } = parsed.data;
  const checked = validateScores(parsed.data.scores);
  if ("error" in checked) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: checked.error } }, { status: 400 });
  }
  // Human override is allowed but must be justified at length.
  if (decisionForTotal(checked.total) !== decision && reason.trim().length < 20) {
    return NextResponse.json({
      error: { code: "INVALID_INPUT", message: "Overriding the threshold requires a reason of at least 20 characters." },
    }, { status: 400 });
  }

  const db = getDb();
  try {
    const review = (await db.select().from(reviews).where(eq(reviews.id, reviewId)))[0];
    if (!review || review.status !== "published") {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Published review not found." } }, { status: 404 });
    }
    const [assessment] = await db
      .insert(qualityAssessments)
      .values({
        reviewId,
        specificity: checked.scores.specificity,
        outcomeClarity: checked.scores.outcomeClarity,
        helpfulness: checked.scores.helpfulness,
        originality: checked.scores.originality,
        actionability: checked.scores.actionability,
        total: checked.total,
        decision,
        assessor: session.wallet.toLowerCase(),
        reason: reason.trim(),
      })
      .returning();
    if (decision === "approved") {
      await db
        .insert(rewardAllocations)
        .values({ reviewId, claimant: review.reviewer, status: "approved_unfunded" })
        .onConflictDoUpdate({
          target: rewardAllocations.reviewId,
          set: { status: "approved_unfunded", updatedAt: new Date() },
          setWhere: eq(rewardAllocations.status, "rejected"),
        });
    } else {
      const existing = (await db.select().from(rewardAllocations).where(eq(rewardAllocations.reviewId, reviewId)))[0];
      if (existing && existing.status !== "claimed") {
        await db.update(rewardAllocations).set({ status: "rejected", updatedAt: new Date() }).where(eq(rewardAllocations.reviewId, reviewId));
      }
    }
    const history = await db
      .select()
      .from(qualityAssessments)
      .where(eq(qualityAssessments.reviewId, reviewId))
      .orderBy(desc(qualityAssessments.assessedAt));
    return NextResponse.json({
      assessment,
      historyCount: history.length,
      rewardState: await rewardStateFor(reviewId),
    });
  } catch {
    return NextResponse.json({ error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }, { status: 503 });
  }
}
