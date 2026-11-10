import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { clientIp, rateLimit } from "@/lib/auth";
import { botPublicClient, liveProvider } from "@/lib/chain";
import {
  AUTH_TTL_SECONDS,
  BOT_MAINNET_CHAIN_ID,
  getDeployedRegistry,
  getSessionSecret,
  getVerifierKey,
} from "@/lib/config";
import { bodyIsValid, contentHashOf, normalizeBody } from "@/lib/eip712";
import { findBlockingReview, loadSupportedAction, logAttempt } from "@/lib/proofs";
import { readRegistryState, signReviewAuth } from "@/lib/registry";
import { readSession } from "@/lib/session";
import { verifyMintProof } from "@/lib/verify-botnames";

const Body = z.object({
  projectId: z.number().int().positive(),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  rating: z.number().int().min(1).max(5),
  outcome: z.number().int().min(0).max(1),
  body: z.string().min(1).max(5000),
});

export async function POST(req: Request) {
  if (!rateLimit(`prepare:${clientIp(req.headers)}`, 20, 60_000)) {
    return NextResponse.json({ eligible: false, code: "RATE_LIMITED", message: "Too many requests." }, { status: 429 });
  }
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "projectId, transactionHash, rating 1-5, outcome 0-1, body required." } }, { status: 400 });
  }

  const registry = getDeployedRegistry(BOT_MAINNET_CHAIN_ID);
  const verifierKey = getVerifierKey();
  if (!registry || !verifierKey || !getSessionSecret()) {
    return NextResponse.json({
      error: { code: "NOT_CONFIGURED", message: "Review publication is not configured on this deployment." },
    }, { status: 503 });
  }

  const { projectId, transactionHash, rating, outcome, body } = parsed.data;
  const txHash = transactionHash.toLowerCase() as `0x${string}`;

  const loaded = await loadSupportedAction(projectId, BOT_MAINNET_CHAIN_ID).catch(() => null);
  if (!loaded) {
    return NextResponse.json({ eligible: false, code: "UNSUPPORTED_ACTION", message: "Project or action is not supported." });
  }

  const normalized = normalizeBody(body);
  if (!bodyIsValid(normalized)) {
    return NextResponse.json({
      eligible: false,
      code: "INVALID_BODY",
      message: "Review must be 100-700 characters after cleanup.",
      normalizedLength: normalized.length,
    });
  }
  const contentHash = contentHashOf(normalized);

  // Fresh proof verification; never trust a client-side verdict.
  const result = await verifyMintProof({
    provider: liveProvider(botPublicClient()),
    action: loaded.action,
    wallet: session.wallet,
    txHash,
  });
  await logAttempt({ wallet: session.wallet, projectId, txHash, resultCode: result.code });
  if (!result.eligible) {
    return NextResponse.json({ eligible: false, code: result.code, message: result.message });
  }

  const blocked = await findBlockingReview({
    chainId: BOT_MAINNET_CHAIN_ID,
    projectId,
    reviewer: session.wallet,
    proofTxHash: result.txHash,
  }).catch(() => "VERIFIER_UNAVAILABLE" as const);
  if (blocked) {
    return NextResponse.json({
      eligible: false,
      code: blocked,
      message: blocked === "DB_ERROR" || blocked === "VERIFIER_UNAVAILABLE" ? "Database unavailable." : "Proof or review already recorded.",
    });
  }

  // Authoritative on-chain state. Never trust client-supplied nonce/registry.
  const onchain = await readRegistryState({
    chainId: BOT_MAINNET_CHAIN_ID,
    reviewer: session.wallet,
    projectId: BigInt(projectId),
    proofTxHash: result.txHash,
  });
  if (!onchain) {
    return NextResponse.json({ eligible: false, code: "VERIFIER_UNAVAILABLE", message: "Registry is unreachable." });
  }
  if (!onchain.active) {
    return NextResponse.json({ eligible: false, code: "PROJECT_INACTIVE", message: "Project is not activated in the registry." });
  }
  if (onchain.reviewed) {
    return NextResponse.json({ eligible: false, code: "REVIEW_ALREADY_EXISTS", message: "This wallet already reviewed this project on-chain." });
  }
  if (onchain.used) {
    return NextResponse.json({ eligible: false, code: "PROOF_ALREADY_USED", message: "This transaction already backs an on-chain review." });
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + AUTH_TTL_SECONDS);
  const auth = {
    reviewer: session.wallet,
    projectId: BigInt(projectId),
    proofTxHash: result.txHash,
    contentHash,
    rating,
    outcome,
    nonce: onchain.nonce,
    deadline,
  };
  const signature = await signReviewAuth({ chainId: BOT_MAINNET_CHAIN_ID, registry, auth });
  if (!signature) {
    return NextResponse.json({ eligible: false, code: "VERIFIER_UNAVAILABLE", message: "Signer unavailable." });
  }

  const deadlineDate = new Date(Number(deadline) * 1000);
  try {
    await getDb().insert(reviews).values({
      projectId,
      reviewer: session.wallet.toLowerCase(),
      chainId: BOT_MAINNET_CHAIN_ID,
      proofTxHash: result.txHash.toLowerCase(),
      rating,
      outcome,
      normalizedBody: normalized,
      contentHash,
      authNonce: Number(onchain.nonce),
      authDeadline: deadlineDate,
      signature,
      status: "prepared",
    });
  } catch {
    return NextResponse.json({ eligible: false, code: "VERIFIER_UNAVAILABLE", message: "Could not stage the review." });
  }

  return NextResponse.json({
    eligible: true,
    code: "OK",
    auth: {
      reviewer: auth.reviewer,
      projectId: projectId.toString(),
      proofTxHash: auth.proofTxHash,
      contentHash: auth.contentHash,
      rating: auth.rating,
      outcome: auth.outcome,
      nonce: onchain.nonce.toString(),
      deadline: deadline.toString(),
    },
    signature,
    chainId: BOT_MAINNET_CHAIN_ID,
    registry,
    expiresAt: deadlineDate.toISOString(),
  });
}
