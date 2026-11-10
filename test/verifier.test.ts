import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { encodeAbiParameters, type Hex, type Transaction, type TransactionReceipt } from "viem";
import { verifyMintProof, type VerifySuccess } from "../src/lib/verify-botnames";
import type { ProofProvider } from "../src/lib/chain";
import type { SupportedAction } from "../src/db/schema";

const PILOT = JSON.parse(readFileSync(new URL("../evidence/pilot-proof.botnames-mint.json", import.meta.url), "utf8"));
const SAFE_TRANSFER = JSON.parse(readFileSync(new URL("../evidence/negative-safetransfer.json", import.meta.url), "utf8"));
const BDEX_SWAP = JSON.parse(readFileSync(new URL("../evidence/negative-bdex-swap.json", import.meta.url), "utf8"));

const ACTION = {
  id: 1,
  projectId: 1,
  version: 1,
  chainId: 677,
  approvedTarget: "0xbeb7b2bd305f0d9412eb1f4c49541fd048c363ce",
  functionSelector: "0xc319a11f",
  eventEmitter: "0xbeb7b2bd305f0d9412eb1f4c49541fd048c363ce",
  eventTopic0: "0xcb748939c198a3ac8c51ea9027e77e3c96244f35ceda8277bd2af91c28a72416",
  minBlock: 20000000,
  eligibleWalletRule: "eoa",
  sampleTxHash: PILOT.tx.hash,
  enabled: true,
} as unknown as SupportedAction;

function stubProvider(tx: unknown, receipt: unknown, tip: bigint, code: Hex | undefined = "0x"): ProofProvider {
  return {
    chainId: () => 677,
    getBlockNumber: async () => tip,
    getTransaction: async () => tx as Transaction,
    getReceipt: async () => receipt as TransactionReceipt,
    getCode: async () => code,
  };
}

function pilotStub(tip = BigInt(29780000)) {
  const input = `0xc319a11f${encodeAbiParameters([{ type: "string" }], ["settravaltd"]).slice(2)}` as Hex;
  const from = "0xb60d4aadf678c7104b97ff21f552dd288bc525ac" as `0x${string}`;
  const tokenTopic = "0x0000000000000000000000000000000000000000000000000000000000000018";
  const fromTopic = `0x000000000000000000000000${from.slice(2).toLowerCase()}`;
  const tx = {
    hash: PILOT.tx.hash,
    from,
    to: "0xbeb7b2bd305f0d9412eb1f4c49541fd048c363ce",
    chainId: 677,
    blockNumber: BigInt(25760640),
    input,
  };
  const logs = PILOT.logs.map((l: { address: string; topics: Hex[]; data: Hex }) => ({
    address: l.address as `0x${string}`,
    topics: l.topics as Hex[],
    data: l.data as Hex,
  }));
  void tokenTopic;
  void fromTopic;
  const receipt = { status: "success", blockNumber: BigInt(25760640), logs };
  return { tx, receipt, tip };
}

/// Mirror viem's formatting of raw RPC responses (hex status -> success, etc.).
function viemTx(t: Record<string, unknown>) {
  return { ...(t as object), chainId: (t.chainId as number) ?? 677, blockNumber: BigInt(t.blockNumber as string) };
}

function viemReceipt(r: Record<string, unknown>) {
  return {
    status: r.status === "0x1" ? "success" : "reverted",
    blockNumber: BigInt(r.blockNumber as string),
    logs: (r.logs as { address: string; topics: Hex[]; data: Hex }[]).map((l) => ({
      address: l.address as `0x${string}`,
      topics: l.topics as Hex[],
      data: l.data as Hex,
    })),
  };
}

describe("BOT Names mint verifier (recorded fixtures)", () => {
  it("accepts the real historical mint", async () => {
    const { tx, receipt, tip } = pilotStub();
    const res = await verifyMintProof({
      provider: stubProvider(tx, receipt, tip),
      action: ACTION,
      wallet: "0xb60d4aadf678c7104b97ff21f552dd288bc525ac",
      txHash: PILOT.tx.hash,
    });
    expect(res.eligible).toBe(true);
    const ok = res as VerifySuccess;
    expect(ok.domainName).toBe("settravaltd");
    expect(ok.tokenId).toBe(BigInt(24));
    expect(ok.blockNumber).toBe(25760640);
    expect(ok.confirmations).toBeGreaterThan(1000);
  });

  it("rejects safeTransferFrom to the same contract", async () => {
    const res = await verifyMintProof({
      provider: stubProvider(viemTx(SAFE_TRANSFER.tx), viemReceipt(SAFE_TRANSFER.receipt), BigInt(29780000)),
      action: ACTION,
      wallet: SAFE_TRANSFER.tx.from,
      txHash: SAFE_TRANSFER.tx.hash,
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("UNSUPPORTED_ACTION");
  });

  it("rejects the BDEX router swap", async () => {
    const res = await verifyMintProof({
      provider: stubProvider(viemTx(BDEX_SWAP.tx), viemReceipt(BDEX_SWAP.receipt), BigInt(29780000)),
      action: ACTION,
      wallet: BDEX_SWAP.tx.from,
      txHash: BDEX_SWAP.tx.hash,
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("UNSUPPORTED_ACTION");
  });

  it("rejects another wallet claiming the pilot mint", async () => {
    const { tx, receipt, tip } = pilotStub();
    const res = await verifyMintProof({
      provider: stubProvider(tx, receipt, tip),
      action: ACTION,
      wallet: "0x000000000000000000000000000000000000dEaD",
      txHash: PILOT.tx.hash,
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("WRONG_WALLET");
  });

  it("rejects a reverted transaction", async () => {
    const { tx, receipt, tip } = pilotStub();
    const badReceipt = { ...receipt, status: "reverted" };
    const res = await verifyMintProof({
      provider: stubProvider(tx, badReceipt, tip),
      action: ACTION,
      wallet: "0xb60d4aadf678c7104b97ff21f552dd288bc525ac",
      txHash: PILOT.tx.hash,
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("TX_FAILED");
  });

  it("rejects mismatched token IDs across logs", async () => {
    const { tx, receipt, tip } = pilotStub();
    const logs = (receipt.logs as { topics: Hex[] }[]).map((l) => ({ ...l, topics: [...l.topics] }));
    logs[1].topics[2] = "0x0000000000000000000000000000000000000000000000000000000000000019";
    const res = await verifyMintProof({
      provider: stubProvider(tx, { ...receipt, logs }, tip),
      action: ACTION,
      wallet: "0xb60d4aadf678c7104b97ff21f552dd288bc525ac",
      txHash: PILOT.tx.hash,
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("PROOF_MISMATCH");
  });

  it("rejects insufficient confirmations", async () => {
    const { tx, receipt } = pilotStub();
    const res = await verifyMintProof({
      provider: stubProvider(tx, receipt, BigInt(25760641)),
      action: ACTION,
      wallet: "0xb60d4aadf678c7104b97ff21f552dd288bc525ac",
      txHash: PILOT.tx.hash,
      confirmationsRequired: 3,
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("INSUFFICIENT_CONFIRMATIONS");
  });

  it("rejects contract wallets", async () => {
    const { tx, receipt, tip } = pilotStub();
    const res = await verifyMintProof({
      provider: stubProvider(tx, receipt, tip, "0x1234"),
      action: ACTION,
      wallet: "0xb60d4aadf678c7104b97ff21f552dd288bc525ac",
      txHash: PILOT.tx.hash,
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("UNSUPPORTED_ACTION");
  });

  it("returns TX_NOT_FOUND for unknown hashes", async () => {
    const provider: ProofProvider = {
      chainId: () => 677,
      getBlockNumber: async () => BigInt(29780000),
      getTransaction: async () => null,
      getReceipt: async () => null,
      getCode: async () => "0x",
    };
    const res = await verifyMintProof({
      provider,
      action: ACTION,
      wallet: "0xb60d4aadf678c7104b97ff21f552dd288bc525ac",
      txHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
    });
    expect(res.eligible).toBe(false);
    expect(res.code).toBe("TX_NOT_FOUND");
  });
});
