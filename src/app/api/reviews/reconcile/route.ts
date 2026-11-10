import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeployedRegistry, BOT_MAINNET_CHAIN_ID } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/auth";
import { reconcileReviewPublication } from "@/lib/reconcile";
import { readSession } from "@/lib/session";

const Body = z.object({
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  stagedId: z.number().int().positive().optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`reconcile:${clientIp(req.headers)}`, 20, 60_000)) {
    return NextResponse.json({ reconciled: false, code: "RATE_LIMITED", message: "Too many requests." }, { status: 429 });
  }
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "transactionHash required." } }, { status: 400 });
  }
  const registry = getDeployedRegistry(BOT_MAINNET_CHAIN_ID);
  if (!registry) {
    return NextResponse.json({
      reconciled: false,
      code: "NOT_CONFIGURED",
      message: "The Trail registry is not deployed on this network yet.",
    }, { status: 503 });
  }
  const result = await reconcileReviewPublication({
    chainId: BOT_MAINNET_CHAIN_ID,
    registry,
    reviewerWallet: session.wallet,
    txHash: parsed.data.transactionHash.toLowerCase() as `0x${string}`,
    stagedId: parsed.data.stagedId,
  });
  if (!result.ok) {
    const status = result.code === "VERIFIER_UNAVAILABLE" || result.code === "DB_ERROR" ? 503 : 200;
    return NextResponse.json({ reconciled: false, code: result.code, message: result.message }, { status });
  }
  return NextResponse.json({
    reconciled: true,
    code: result.code,
    review: {
      id: result.id,
      onchainReviewId: result.onchainReviewId,
      reviewTxHash: result.reviewTxHash,
      projectId: result.projectId,
    },
  });
}
