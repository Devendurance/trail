import { beforeEach, describe, expect, it, vi } from "vitest";

const WALLET = "0x1111111111111111111111111111111111111111";
const HASH = "0x" + "ab".repeat(32);

const mocks = vi.hoisted(() => ({
  loadSupportedAction: vi.fn(),
  findBlockingReview: vi.fn(),
  logAttempt: vi.fn(async () => undefined),
}));

vi.mock("@/lib/session", () => ({ readSession: async () => ({ wallet: WALLET, chainId: 677 }) }));
vi.mock("@/lib/chain", () => ({ botPublicClient: () => ({}), liveProvider: () => ({}) }));
vi.mock("@/lib/proofs", () => mocks);
vi.mock("@/lib/verify-botnames", () => ({
  verifyMintProof: async () => ({
    eligible: true,
    code: "OK",
    txHash: HASH,
    from: WALLET,
    domainName: "x",
    tokenId: 1n,
    blockNumber: 1,
    confirmations: 5,
  }),
}));

const loaded = {
  project: { id: 1, slug: "bot-names", name: "BOT Names" },
  action: { functionSelector: "0x", approvedTarget: "0x", version: 1 },
};

async function call() {
  const { POST } = await import("@/app/api/proofs/check/route");
  const res = await POST(
    new Request("http://localhost/api/proofs/check", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": Math.random().toString() },
      body: JSON.stringify({ projectId: 1, transactionHash: HASH }),
    }),
  );
  return { status: res.status, json: await res.json() };
}

describe("/api/proofs/check fails closed on DB errors", () => {
  beforeEach(() => {
    mocks.loadSupportedAction.mockReset();
    mocks.findBlockingReview.mockReset();
  });

  it("DB_ERROR from reuse check is VERIFIER_UNAVAILABLE, never eligible", async () => {
    mocks.loadSupportedAction.mockResolvedValue(loaded);
    mocks.findBlockingReview.mockResolvedValue("DB_ERROR");
    const { status, json } = await call();
    expect(status).toBe(503);
    expect(json.eligible).toBe(false);
    expect(json.code).toBe("VERIFIER_UNAVAILABLE");
  });

  it("a thrown reuse check is VERIFIER_UNAVAILABLE, never eligible", async () => {
    mocks.loadSupportedAction.mockResolvedValue(loaded);
    mocks.findBlockingReview.mockRejectedValue(new Error("db down"));
    const { status, json } = await call();
    expect(status).toBe(503);
    expect(json.eligible).toBe(false);
    expect(json.code).toBe("VERIFIER_UNAVAILABLE");
  });

  it("a DB failure loading the action is not reported as UNSUPPORTED_ACTION", async () => {
    mocks.loadSupportedAction.mockRejectedValue(new Error("db down"));
    const { status, json } = await call();
    expect(status).toBe(503);
    expect(json.code).toBe("VERIFIER_UNAVAILABLE");
  });

  it("no blocker yields eligible", async () => {
    mocks.loadSupportedAction.mockResolvedValue(loaded);
    mocks.findBlockingReview.mockResolvedValue(null);
    const { json } = await call();
    expect(json.eligible).toBe(true);
  });
});
