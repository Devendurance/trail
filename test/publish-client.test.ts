import { describe, expect, it } from "vitest";
import { authToContractArgs, checkPublishGuards, publishReviewOnChain } from "../src/lib/client/publish";
import type { PreparedReview } from "../src/lib/client/types";

const REVIEWER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
const prepared: PreparedReview = {
  eligible: true,
  code: "OK",
  auth: {
    reviewer: REVIEWER,
    projectId: "1",
    proofTxHash: "0x" + "ab".repeat(32),
    contentHash: "0x" + "cd".repeat(32),
    rating: 4,
    outcome: 1,
    nonce: "7",
    deadline: "4102444800",
  },
  signature: ("0x" + "11".repeat(65)) as `0x${string}`,
  chainId: 677,
  registry: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  expiresAt: "2100-01-01T00:00:00.000Z",
};

describe("prepared authorization to contract args", () => {
  it("converts decimal strings to bigint and leaves uint8 as numbers", () => {
    const [auth, sig] = authToContractArgs(prepared);
    expect(auth.projectId).toBe(BigInt(1));
    expect(auth.nonce).toBe(BigInt(7));
    expect(auth.deadline).toBe(BigInt(4102444800));
    expect(auth.rating).toBe(4);
    expect(auth.outcome).toBe(1);
    expect(typeof auth.rating).toBe("number");
    expect(auth.reviewer).toBe(REVIEWER);
    expect(auth.proofTxHash).toBe(prepared.auth.proofTxHash);
    expect(auth.contentHash).toBe(prepared.auth.contentHash);
    expect(sig).toBe(prepared.signature);
  });
});

describe("publish guards", () => {
  const base = { prepared, account: REVIEWER, walletChainId: 677, nowSeconds: 1_000 };
  it("passes when everything lines up", () => {
    expect(checkPublishGuards(base)).toBeNull();
  });
  it("requires a connected account", () => {
    expect(checkPublishGuards({ ...base, account: undefined })).toBe("NO_ACCOUNT");
  });
  it("rejects a different connected wallet, case-insensitively matching the right one", () => {
    expect(checkPublishGuards({ ...base, account: "0x" + "22".repeat(20) })).toBe("WRONG_ACCOUNT");
    expect(checkPublishGuards({ ...base, account: REVIEWER.toLowerCase() })).toBeNull();
  });
  it("rejects the wrong wallet chain", () => {
    expect(checkPublishGuards({ ...base, walletChainId: 1 })).toBe("WRONG_CHAIN");
    expect(checkPublishGuards({ ...base, walletChainId: undefined })).toBe("WRONG_CHAIN");
  });
  it("reports an unconfigured registry", () => {
    expect(checkPublishGuards({ ...base, prepared: { ...prepared, registry: "" as `0x${string}` } })).toBe("NOT_CONFIGURED");
  });
  it("rejects an expired or nearly expired deadline", () => {
    expect(checkPublishGuards({ ...base, nowSeconds: 4102444800 })).toBe("DEADLINE_PASSED");
    expect(checkPublishGuards({ ...base, nowSeconds: 4102444800 - 10 })).toBe("DEADLINE_PASSED");
  });
});

describe("publishReviewOnChain failure handling", () => {
  const okPublic = {
    simulateContract: async () => ({}) as never,
    waitForTransactionReceipt: async () => ({ status: "success", blockNumber: BigInt(5) }) as never,
  };
  const common = { prepared, account: REVIEWER as `0x${string}`, walletChainId: 677, nowSeconds: 1_000 };

  it("does not call the wallet when a guard fails", async () => {
    let called = false;
    const r = await publishReviewOnChain({
      ...common,
      walletChainId: 1,
      publicClient: okPublic,
      walletClient: { writeContract: async () => { called = true; return "0x" as never; } },
    });
    expect(r).toMatchObject({ ok: false, stage: "guard", code: "WRONG_CHAIN" });
    expect(called).toBe(false);
  });

  it("maps a wallet rejection to USER_REJECTED", async () => {
    const r = await publishReviewOnChain({
      ...common,
      publicClient: okPublic,
      walletClient: { writeContract: async () => { throw Object.assign(new Error("User rejected the request."), { code: 4001 }); } },
    });
    expect(r).toMatchObject({ ok: false, stage: "wallet", code: "USER_REJECTED" });
  });

  it("never reports success for a reverted receipt", async () => {
    const r = await publishReviewOnChain({
      ...common,
      publicClient: { ...okPublic, waitForTransactionReceipt: async () => ({ status: "reverted", blockNumber: BigInt(5) }) as never },
      walletClient: { writeContract: async () => ("0x" + "ee".repeat(32)) as never },
    });
    expect(r).toMatchObject({ ok: false, stage: "revert", code: "REVERTED" });
  });

  it("stops before the wallet when simulation fails", async () => {
    let called = false;
    const r = await publishReviewOnChain({
      ...common,
      publicClient: { ...okPublic, simulateContract: async () => { throw new Error("ProofAlreadyUsed"); } },
      walletClient: { writeContract: async () => { called = true; return "0x" as never; } },
    });
    expect(r).toMatchObject({ ok: false, stage: "simulate" });
    expect(called).toBe(false);
  });
});
