import { NextResponse } from "next/server";
import { z } from "zod";
import { botPublicClient, liveProvider } from "@/lib/chain";
import { BOT_MAINNET_CHAIN_ID, explorerTxUrl } from "@/lib/config";
import { clientIp, rateLimit } from "@/lib/auth";
import { verifyMintProof } from "@/lib/verify-botnames";
import { findBlockingReview, loadSupportedAction, logAttempt } from "@/lib/proofs";
import { readSession } from "@/lib/session";

const Body = z.object({
  projectId: z.number().int().positive(),
  transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

export async function POST(req: Request) {
  if (!rateLimit(`proofs:${clientIp(req.headers)}`, 30, 60_000)) {
    return NextResponse.json({ eligible: false, code: "RATE_LIMITED", message: "Too many requests." }, { status: 429 });
  }
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Sign in first." } }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "INVALID_INPUT", message: "projectId and transactionHash required." } }, { status: 400 });
  }
  const { projectId, transactionHash } = parsed.data;
  const txHash = transactionHash.toLowerCase() as `0x${string}`;

  const loaded = await loadSupportedAction(projectId, BOT_MAINNET_CHAIN_ID).catch(() => null);
  if (!loaded) {
    await logAttempt({ wallet: session.wallet, projectId, txHash, resultCode: "UNSUPPORTED_ACTION" });
    return NextResponse.json({
      eligible: false,
      code: "UNSUPPORTED_ACTION",
      message: "Project or action is not supported.",
      explorerUrl: explorerTxUrl(txHash),
    });
  }

  const result = await verifyMintProof({
    provider: liveProvider(botPublicClient()),
    action: loaded.action,
    wallet: session.wallet,
    txHash,
  });
  await logAttempt({ wallet: session.wallet, projectId, txHash, resultCode: result.code });

  if (!result.eligible) {
    return NextResponse.json({ eligible: false, code: result.code, message: result.message, explorerUrl: explorerTxUrl(txHash) });
  }

  const blocked = await findBlockingReview({
    chainId: BOT_MAINNET_CHAIN_ID,
    projectId,
    reviewer: session.wallet,
    proofTxHash: result.txHash,
  }).catch(() => "DB_ERROR");
  if (blocked === "DB_ERROR") {
    await logAttempt({ wallet: session.wallet, projectId, txHash, resultCode: "VERIFIER_UNAVAILABLE" });
    return NextResponse.json({ eligible: false, code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." }, { status: 503 });
  }
  if (blocked) {
    await logAttempt({ wallet: session.wallet, projectId, txHash, resultCode: blocked });
    return NextResponse.json({
      eligible: false,
      code: blocked,
      message:
        blocked === "PROOF_ALREADY_USED"
          ? "This transaction already backs a review."
          : "This wallet already has a review for this project.",
      explorerUrl: explorerTxUrl(txHash),
    });
  }

  return NextResponse.json({
    eligible: true,
    code: "OK",
    project: { id: loaded.project.id, slug: loaded.project.slug, name: loaded.project.name },
    action: { selector: loaded.action.functionSelector, target: loaded.action.approvedTarget, version: loaded.action.version },
    proof: {
      txHash: result.txHash,
      from: result.from,
      domainName: result.domainName,
      tokenId: result.tokenId.toString(),
      blockNumber: result.blockNumber,
      confirmations: result.confirmations,
    },
    explorerUrl: explorerTxUrl(txHash),
  });
}
