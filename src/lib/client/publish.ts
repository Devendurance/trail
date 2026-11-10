import type { Hex, PublicClient, WalletClient } from "viem";
import { registryAbi } from "../registry-abi";
import { BOT_CHAIN_ID } from "./chain677";
import type { PreparedReview } from "./types";

/// Everything here is client-safe and framework-free so the exact same path
/// runs in the browser (wagmi clients) and in the Anvil integration test.

export interface ContractAuth {
  reviewer: `0x${string}`;
  projectId: bigint;
  proofTxHash: Hex;
  contentHash: Hex;
  rating: number;
  outcome: number;
  nonce: bigint;
  deadline: bigint;
}

/// Convert the prepared JSON payload EXACTLY into contract arguments.
/// uint256/uint64 fields arrive as decimal strings and become bigint;
/// uint8 fields stay numbers. Nothing is recomputed or reordered.
export function authToContractArgs(
  p: Pick<PreparedReview, "auth" | "signature">,
): readonly [ContractAuth, Hex] {
  const a = p.auth;
  return [
    {
      reviewer: a.reviewer as `0x${string}`,
      projectId: BigInt(a.projectId),
      proofTxHash: a.proofTxHash as Hex,
      contentHash: a.contentHash as Hex,
      rating: a.rating,
      outcome: a.outcome,
      nonce: BigInt(a.nonce),
      deadline: BigInt(a.deadline),
    },
    p.signature,
  ] as const;
}

export type GuardCode =
  | "NO_ACCOUNT"
  | "WRONG_ACCOUNT"
  | "WRONG_CHAIN"
  | "NOT_CONFIGURED"
  | "DEADLINE_PASSED"
  | "PAYLOAD_CHAIN_MISMATCH";

export const DEADLINE_MARGIN_SECONDS = 30;

export function checkPublishGuards(args: {
  prepared: Pick<PreparedReview, "auth" | "registry" | "chainId">;
  account: string | undefined;
  walletChainId: number | undefined;
  expectedChainId?: number;
  nowSeconds?: number;
}): GuardCode | null {
  const expected = args.expectedChainId ?? BOT_CHAIN_ID;
  if (!args.account) return "NO_ACCOUNT";
  if (!args.prepared.registry || !/^0x[0-9a-fA-F]{40}$/.test(args.prepared.registry)) return "NOT_CONFIGURED";
  if (args.prepared.chainId !== expected) return "PAYLOAD_CHAIN_MISMATCH";
  if (args.walletChainId !== expected) return "WRONG_CHAIN";
  if (args.account.toLowerCase() !== args.prepared.auth.reviewer.toLowerCase()) return "WRONG_ACCOUNT";
  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (BigInt(args.prepared.auth.deadline) <= BigInt(now + DEADLINE_MARGIN_SECONDS)) return "DEADLINE_PASSED";
  return null;
}

export const GUARD_MESSAGES: Record<GuardCode, string> = {
  NO_ACCOUNT: "Connect your wallet to publish.",
  WRONG_ACCOUNT: "The connected wallet is not the wallet this review was prepared for.",
  WRONG_CHAIN: "Switch your wallet to BOT Chain (677) to publish.",
  NOT_CONFIGURED: "Mainnet review publishing not yet available.",
  DEADLINE_PASSED: "The signed authorization expired. Prepare the review again.",
  PAYLOAD_CHAIN_MISMATCH: "The prepared review is for a different network.",
};

export type PublishResult =
  | { ok: true; txHash: Hex; blockNumber: bigint }
  | {
      ok: false;
      stage: "guard" | "simulate" | "wallet" | "receipt" | "revert";
      code: string;
      message: string;
      txHash?: Hex;
    };

function errText(e: unknown): string {
  if (e && typeof e === "object") {
    const o = e as { shortMessage?: string; message?: string };
    return o.shortMessage ?? o.message ?? "Unknown error";
  }
  return String(e);
}

export function isUserRejection(e: unknown): boolean {
  const s = errText(e).toLowerCase();
  const o = e as { code?: number; cause?: { code?: number } } | null;
  return o?.code === 4001 || o?.cause?.code === 4001 || s.includes("user rejected") || s.includes("user denied");
}

/// Simulate, request the wallet write, then wait for a successful receipt.
/// A tx is only "ok" when its receipt status is success.
export async function publishReviewOnChain(args: {
  publicClient: Pick<PublicClient, "simulateContract" | "waitForTransactionReceipt">;
  walletClient: Pick<WalletClient, "writeContract">;
  prepared: PreparedReview;
  account: `0x${string}`;
  walletChainId: number | undefined;
  expectedChainId?: number;
  nowSeconds?: number;
  confirmations?: number;
}): Promise<PublishResult> {
  const guard = checkPublishGuards({
    prepared: args.prepared,
    account: args.account,
    walletChainId: args.walletChainId,
    expectedChainId: args.expectedChainId,
    nowSeconds: args.nowSeconds,
  });
  if (guard) return { ok: false, stage: "guard", code: guard, message: GUARD_MESSAGES[guard] };

  const contractArgs = authToContractArgs(args.prepared);
  try {
    await args.publicClient.simulateContract({
      address: args.prepared.registry,
      abi: registryAbi,
      functionName: "publishReview",
      args: contractArgs,
      account: args.account,
    });
  } catch (e) {
    return { ok: false, stage: "simulate", code: "SIMULATION_FAILED", message: errText(e) };
  }

  let hash: Hex;
  try {
    hash = await args.walletClient.writeContract({
      address: args.prepared.registry,
      abi: registryAbi,
      functionName: "publishReview",
      args: contractArgs,
      account: args.account,
    } as never);
  } catch (e) {
    return isUserRejection(e)
      ? { ok: false, stage: "wallet", code: "USER_REJECTED", message: "You declined the transaction in your wallet." }
      : { ok: false, stage: "wallet", code: "WALLET_ERROR", message: errText(e) };
  }

  try {
    const receipt = await args.publicClient.waitForTransactionReceipt({
      hash,
      confirmations: args.confirmations ?? 1,
    });
    if (receipt.status !== "success") {
      return { ok: false, stage: "revert", code: "REVERTED", message: "The publication transaction reverted on-chain.", txHash: hash };
    }
    return { ok: true, txHash: hash, blockNumber: receipt.blockNumber };
  } catch (e) {
    return { ok: false, stage: "receipt", code: "RECEIPT_UNAVAILABLE", message: errText(e), txHash: hash };
  }
}
