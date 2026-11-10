import { and, eq, inArray } from "drizzle-orm";
import { parseEventLogs, type Hex } from "viem";
import { getDb } from "@/db";
import { reviews } from "@/db/schema";
import { botPublicClient, type PublicClient } from "./chain";
import { CONFIRMATIONS_REQUIRED } from "./config";
import { logAttempt } from "./proofs";
import { registryAbi } from "./registry";

export type ReconcileCode =
  | "OK"
  | "ALREADY_PUBLISHED"
  | "NOT_CONFIGURED"
  | "TX_NOT_FOUND"
  | "TX_FAILED"
  | "WRONG_CHAIN"
  | "WRONG_WALLET"
  | "INSUFFICIENT_CONFIRMATIONS"
  | "NO_REVIEW_EVENT"
  | "EVENT_MISMATCH"
  | "NO_STAGED_REVIEW"
  | "VERIFIER_UNAVAILABLE"
  | "DB_ERROR";

export interface ReconcileSuccess {
  ok: true;
  code: "OK" | "ALREADY_PUBLISHED";
  id: number;
  onchainReviewId: number;
  reviewTxHash: Hex;
  projectId: number;
}

export interface ReconcileFailure {
  ok: false;
  code: Exclude<ReconcileCode, "OK" | "ALREADY_PUBLISHED">;
  message: string;
}

export type ReconcileResult = ReconcileSuccess | ReconcileFailure;

function fail(code: ReconcileFailure["code"], message: string): ReconcileFailure {
  return { ok: false, code, message };
}

export interface PublishedEvent {
  reviewId: bigint;
  projectId: bigint;
  reviewer: `0x${string}`;
  proofTxHash: Hex;
  contentHash: Hex;
  rating: number;
  outcome: number;
}

function sameHex(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Reconcile a staged review against its real on-chain publication.
 * Never manufactures a published review: every field is cross-checked
 * between the staged row, the ReviewPublished event, and getReview().
 */
export async function reconcileReviewPublication(args: {
  client?: PublicClient;
  chainId: number;
  registry: `0x${string}`;
  reviewerWallet: `0x${string}`;
  txHash: Hex;
  stagedId?: number;
}): Promise<ReconcileResult> {
  const { chainId, reviewerWallet, txHash, stagedId } = args;
  const registry = args.registry.toLowerCase() as `0x${string}`;
  const reviewer = reviewerWallet.toLowerCase() as `0x${string}`;
  const client = (args.client ?? botPublicClient()) as PublicClient;

  let rpcChain: number | null = null;
  let tx: Awaited<ReturnType<PublicClient["getTransaction"]>> | null = null;
  let receipt: Awaited<ReturnType<PublicClient["getTransactionReceipt"]>> | null = null;
  let tip = BigInt(0);
  try {
    rpcChain = await client.getChainId();
    tx = await client.getTransaction({ hash: txHash }).catch(() => null);
    receipt = tx ? await client.getTransactionReceipt({ hash: txHash }).catch(() => null) : null;
    tip = await client.getBlockNumber();
  } catch {
    return fail("VERIFIER_UNAVAILABLE", "Registry RPC is unreachable. Try again.");
  }
  if (rpcChain !== chainId) {
    return fail("WRONG_CHAIN", `Connected RPC reports chain ${String(rpcChain)}, expected ${chainId}.`);
  }
  if (!tx || !receipt) return fail("TX_NOT_FOUND", "Publication transaction not found.");
  if (receipt.status !== "success") return fail("TX_FAILED", "Publication transaction failed on-chain.");
  if (!tx.to || !sameHex(tx.to, registry)) {
    return fail("NO_REVIEW_EVENT", "Transaction does not call the Trail registry.");
  }
  if (!tx.from || !sameHex(tx.from, reviewer)) {
    return fail("WRONG_WALLET", "Transaction was not sent by the authenticated reviewer.");
  }
  const confirmations = Number(tip) - Number(receipt.blockNumber) + 1;
  if (confirmations < CONFIRMATIONS_REQUIRED) {
    return fail("INSUFFICIENT_CONFIRMATIONS", `Only ${confirmations} confirmations; need ${CONFIRMATIONS_REQUIRED}.`);
  }

  const decoded = parseEventLogs({ abi: registryAbi, logs: receipt.logs }).filter(
    (e) => e.eventName === "ReviewPublished" && sameHex(e.address, registry),
  );
  if (decoded.length === 0) {
    return fail("NO_REVIEW_EVENT", "No ReviewPublished event from the Trail registry in this receipt.");
  }
  const events = decoded.map((e) => (e.args ?? {}) as unknown as PublishedEvent);

  let onchain: { reviewer: string } | null = null;
  let event: PublishedEvent | null = null;
  try {
    for (const candidate of events) {
      if (!sameHex(candidate.reviewer, reviewer)) continue;
      const raw = (await client.readContract({
        address: registry,
        abi: registryAbi,
        functionName: "getReview",
        args: [candidate.reviewId],
      })) as unknown as Record<string, unknown> | readonly unknown[];
      // viem may return named keys, positional indices, or both.
      const pick = (named: string, index: number): unknown =>
        (raw as Record<string, unknown>)[named] ?? (raw as readonly unknown[])[index];
      const stored = {
        reviewer: String(pick("reviewer", 0)),
        projectId: BigInt(String(pick("projectId", 1))),
        proofTxHash: String(pick("proofTxHash", 2)),
        contentHash: String(pick("contentHash", 3)),
        rating: Number(pick("rating", 4)),
        outcome: Number(pick("outcome", 5)),
      };
      if (
        sameHex(stored.reviewer, candidate.reviewer) &&
        stored.projectId === candidate.projectId &&
        sameHex(stored.proofTxHash, candidate.proofTxHash) &&
        sameHex(stored.contentHash, candidate.contentHash) &&
        stored.rating === candidate.rating &&
        stored.outcome === candidate.outcome
      ) {
        onchain = stored;
        event = candidate;
        break;
      }
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : "read failed";
    return fail("VERIFIER_UNAVAILABLE", `Registry read failed: ${detail}`);
  }
  if (!event || !onchain) {
    return fail("EVENT_MISMATCH", "No registry event matches this reviewer and stored review.");
  }

  const db = getDb();
  try {
    const candidates = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.chainId, chainId),
          eq(reviews.reviewer, reviewer),
          inArray(reviews.status, ["draft", "prepared", "published"]),
        ),
      );
    const done = candidates.find(
      (r) => r.status === "published" && r.reviewTxHash && sameHex(r.reviewTxHash, txHash),
    );
    if (done) {
      return {
        ok: true,
        code: "ALREADY_PUBLISHED",
        id: done.id,
        onchainReviewId: done.onchainReviewId ?? Number(event.reviewId),
        reviewTxHash: txHash,
        projectId: done.projectId,
      };
    }
    const pool = candidates.filter(
      (r) =>
        r.status !== "published" &&
        (!stagedId || r.id === stagedId) &&
        r.projectId === Number(event!.projectId) &&
        sameHex(r.proofTxHash, event!.proofTxHash) &&
        sameHex(r.contentHash, event!.contentHash) &&
        r.rating === event!.rating &&
        r.outcome === event!.outcome,
    );
    if (pool.length === 0) {
      return fail("NO_STAGED_REVIEW", "No staged review matches this on-chain publication.");
    }
    const winner = pool.sort((a, b) => a.id - b.id)[0];
    const others = candidates
      .filter((r) => r.status !== "published" && r.id !== winner.id && sameHex(r.proofTxHash, event!.proofTxHash))
      .map((r) => r.id);
    await db.transaction(async (t) => {
      await t
        .update(reviews)
        .set({ status: "published", reviewTxHash: txHash.toLowerCase(), onchainReviewId: Number(event!.reviewId), updatedAt: new Date() })
        .where(eq(reviews.id, winner.id));
      if (others.length > 0) {
        await t.update(reviews).set({ status: "expired", updatedAt: new Date() }).where(inArray(reviews.id, others));
      }
    });
    await logAttempt({ wallet: reviewer, projectId: winner.projectId, txHash, resultCode: "OK" });
    return {
      ok: true,
      code: "OK",
      id: winner.id,
      onchainReviewId: Number(event.reviewId),
      reviewTxHash: txHash,
      projectId: winner.projectId,
    };
  } catch {
    return fail("DB_ERROR", "Database unavailable. On-chain publication is unaffected; retry reconciliation.");
  }
}
