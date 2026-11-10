import { decodeAbiParameters, type Hex } from "viem";
import type { SupportedAction } from "@/db/schema";
import { CONFIRMATIONS_REQUIRED } from "./config";
import type { ProofProvider } from "./chain";

export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export const ZERO_TOPIC = "0x0000000000000000000000000000000000000000000000000000000000000000";

export type VerifyCode =
  | "OK"
  | "WRONG_CHAIN"
  | "WRONG_WALLET"
  | "TX_NOT_FOUND"
  | "TX_FAILED"
  | "INSUFFICIENT_CONFIRMATIONS"
  | "UNSUPPORTED_ACTION"
  | "PROOF_MISMATCH"
  | "VERIFIER_UNAVAILABLE";

export interface VerifySuccess {
  eligible: true;
  code: "OK";
  chainId: number;
  txHash: Hex;
  from: `0x${string}`;
  to: `0x${string}`;
  selector: Hex;
  domainName: string;
  tokenId: bigint;
  blockNumber: number;
  confirmations: number;
}

export interface VerifyFailure {
  eligible: false;
  code: Exclude<VerifyCode, "OK">;
  message: string;
}

export type VerifyResult = VerifySuccess | VerifyFailure;

function fail(code: VerifyFailure["code"], message: string): VerifyFailure {
  return { eligible: false, code, message };
}

function padAddress(addr: string): string {
  return ("0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0")).toLowerCase();
}

/**
 * Verify a transaction as an eligible mintDomain(string) proof for one
 * supported action. Pure against the provider: no hidden network access.
 */
export async function verifyMintProof(args: {
  provider: ProofProvider;
  action: SupportedAction;
  wallet: `0x${string}`;
  txHash: Hex;
  confirmationsRequired?: number;
}): Promise<VerifyResult> {
  const { provider, action, txHash } = args;
  const wallet = args.wallet.toLowerCase() as `0x${string}`;
  const required = args.confirmationsRequired ?? CONFIRMATIONS_REQUIRED;
  const target = action.approvedTarget.toLowerCase();
  const emitter = action.eventEmitter.toLowerCase();
  const domainMintedTopic = action.eventTopic0.toLowerCase();

  let tx;
  try {
    tx = await provider.getTransaction(txHash);
  } catch {
    return fail("VERIFIER_UNAVAILABLE", "Proof RPC is unreachable. Try again.");
  }
  if (!tx) return fail("TX_NOT_FOUND", "Transaction not found on BOT Chain mainnet.");

  let receipt;
  try {
    receipt = await provider.getReceipt(txHash);
  } catch {
    return fail("VERIFIER_UNAVAILABLE", "Receipt RPC is unreachable. Try again.");
  }
  if (!receipt) return fail("TX_NOT_FOUND", "Transaction receipt not found.");

  if (receipt.status !== "success") return fail("TX_FAILED", "Transaction failed on-chain.");
  if (tx.chainId != null && Number(tx.chainId) !== action.chainId) {
    return fail("WRONG_CHAIN", `Transaction is on chain ${String(tx.chainId)}, expected ${action.chainId}.`);
  }
  if (!tx.from || tx.from.toLowerCase() !== wallet) {
    return fail("WRONG_WALLET", "Transaction was not sent by the connected wallet.");
  }
  if (!tx.to || tx.to.toLowerCase() !== target) {
    return fail("UNSUPPORTED_ACTION", "Transaction does not call the approved contract.");
  }
  const input = (tx.input ?? "0x").toLowerCase();
  if (!input.startsWith(action.functionSelector.toLowerCase())) {
    return fail("UNSUPPORTED_ACTION", "Transaction does not call the approved action.");
  }

  let domainName: string;
  try {
    const data = `0x${input.slice(10)}` as Hex;
    const [name] = decodeAbiParameters([{ type: "string" }], data);
    if (!name || name.length === 0) throw new Error("empty");
    domainName = name;
  } catch {
    return fail("UNSUPPORTED_ACTION", "Calldata does not decode as mintDomain(string).");
  }

  const fromTopic = padAddress(tx.from);
  let transferTokenId: string | null = null;
  let mintedTokenId: string | null = null;
  let mintedName: string | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== emitter) continue;
    const t0 = (log.topics[0] ?? "").toLowerCase();
    if (t0 === TRANSFER_TOPIC) {
      if ((log.topics[1] ?? "").toLowerCase() !== ZERO_TOPIC) continue;
      if ((log.topics[2] ?? "").toLowerCase() !== fromTopic) continue;
      transferTokenId = (log.topics[3] ?? "").toLowerCase();
    } else if (t0 === domainMintedTopic) {
      if ((log.topics[1] ?? "").toLowerCase() !== fromTopic) continue;
      mintedTokenId = (log.topics[2] ?? "").toLowerCase();
      try {
        const [n] = decodeAbiParameters([{ type: "string" }], log.data as Hex);
        mintedName = n;
      } catch {
        return fail("PROOF_MISMATCH", "DomainMinted log data does not decode.");
      }
    }
  }
  if (!transferTokenId) return fail("PROOF_MISMATCH", "No matching ERC-721 mint log found.");
  if (!mintedTokenId) return fail("PROOF_MISMATCH", "No matching DomainMinted log found.");
  if (transferTokenId !== mintedTokenId) {
    return fail("PROOF_MISMATCH", "Token IDs differ between mint logs.");
  }
  if (mintedName !== domainName) {
    return fail("PROOF_MISMATCH", "Minted name differs from calldata.");
  }

  const blockNumber = Number(receipt.blockNumber);
  if (!Number.isFinite(blockNumber) || blockNumber < Number(action.minBlock)) {
    return fail("UNSUPPORTED_ACTION", "Transaction predates the supported action version.");
  }

  let tip: bigint;
  try {
    tip = await provider.getBlockNumber();
  } catch {
    return fail("VERIFIER_UNAVAILABLE", "Chain tip is unreachable. Try again.");
  }
  const confirmations = Number(tip) - blockNumber + 1;
  if (confirmations < required) {
    return fail("INSUFFICIENT_CONFIRMATIONS", `Only ${confirmations} confirmations; need ${required}.`);
  }

  if (action.eligibleWalletRule === "eoa") {
    let code: string | undefined;
    try {
      code = await provider.getCode(tx.from);
    } catch {
      return fail("VERIFIER_UNAVAILABLE", "Wallet check is unreachable. Try again.");
    }
    if (code !== undefined && code !== "0x" && code !== "0x0") {
      return fail("UNSUPPORTED_ACTION", "Contract wallets are not eligible in V1.");
    }
  }

  return {
    eligible: true,
    code: "OK",
    chainId: action.chainId,
    txHash: tx.hash.toLowerCase() as Hex,
    from: tx.from.toLowerCase() as `0x${string}`,
    to: tx.to!.toLowerCase() as `0x${string}`,
    selector: args.action.functionSelector.toLowerCase() as Hex,
    domainName,
    tokenId: BigInt(transferTokenId),
    blockNumber,
    confirmations,
  };
}
