import { afterEach, describe, expect, it, vi } from "vitest";
import { deriveAuthStatus, signInWithWallet } from "../src/lib/client/auth";
import { PROOF_STATES, REWARD_STATE_LABELS, stateFor } from "../src/lib/client/states";
import { checkBody, checkProof, prepareReview, reconcileWithRetry, reusablePrepared } from "../src/lib/client/review-flow";
import type { PreparedReview } from "../src/lib/client/types";

const W = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";

function mockFetch(routes: Record<string, (body: unknown) => { status?: number; json: unknown }>) {
  const calls: { url: string; body: unknown }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, body });
    const h = routes[url];
    if (!h) throw new Error(`unmocked ${url}`);
    const r = h(body);
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, json: async () => r.json } as Response;
  });
  return calls;
}
afterEach(() => vi.unstubAllGlobals());

describe("review body validation (100-700)", () => {
  it("rejects short, accepts the bounds, rejects long, counts normalized length", () => {
    expect(checkBody("a".repeat(99)).ok).toBe(false);
    expect(checkBody("a".repeat(100)).ok).toBe(true);
    expect(checkBody("a".repeat(700)).ok).toBe(true);
    expect(checkBody("a".repeat(701)).ok).toBe(false);
    expect(checkBody("  " + "a".repeat(98) + "   \n\n  ").ok).toBe(false);
    expect(checkBody("a ".repeat(60)).length).toBe(119);
  });
});

describe("auth status derivation", () => {
  const session = { authenticated: true, wallet: W };
  it("walks the wallet states", () => {
    expect(deriveAuthStatus({ hasProvider: false, account: undefined, chainId: undefined, session: null })).toBe("no_wallet");
    expect(deriveAuthStatus({ hasProvider: true, account: undefined, chainId: undefined, session: null })).toBe("disconnected");
    expect(deriveAuthStatus({ hasProvider: true, account: W, chainId: 1, session: null })).toBe("wrong_network");
    expect(deriveAuthStatus({ hasProvider: true, account: W, chainId: 677, session: null })).toBe("needs_signin");
    expect(deriveAuthStatus({ hasProvider: true, account: W, chainId: 677, session: { authenticated: false } })).toBe("needs_signin");
    expect(deriveAuthStatus({ hasProvider: true, account: "0x" + "22".repeat(20), chainId: 677, session })).toBe("session_mismatch");
    expect(deriveAuthStatus({ hasProvider: true, account: W.toUpperCase().replace("0X", "0x"), chainId: 677, session })).toBe("authenticated");
  });
});

describe("wallet sign-in flow", () => {
  it("signs the exact challenge, verifies, then confirms the session", async () => {
    const calls = mockFetch({
      "/api/auth/challenge": () => ({ json: { message: "Sign in\nNonce: abc\nWallet: x" } }),
      "/api/auth/verify": () => ({ json: { authenticated: true, wallet: W } }),
      "/api/auth/session": () => ({ json: { authenticated: true, wallet: W, chainId: 677 } }),
    });
    const signed: string[] = [];
    const r = await signInWithWallet({ wallet: W, chainId: 677, sign: async (m) => { signed.push(m); return "0x" + "1".repeat(130); } });
    expect(r).toEqual({ ok: true, wallet: W });
    expect(signed).toEqual(["Sign in\nNonce: abc\nWallet: x"]);
    expect(calls[0].body).toEqual({ wallet: W, chainId: 677 });
    expect(calls[1].body).toMatchObject({ message: "Sign in\nNonce: abc\nWallet: x" });
  });

  it("handles signature rejection without calling verify", async () => {
    const calls = mockFetch({ "/api/auth/challenge": () => ({ json: { message: "m" } }) });
    const r = await signInWithWallet({ wallet: W, chainId: 677, sign: async () => { throw Object.assign(new Error("User rejected"), { code: 4001 }); } });
    expect(r).toMatchObject({ ok: false, code: "REJECTED" });
    expect(calls.map((c) => c.url)).toEqual(["/api/auth/challenge"]);
  });

  it("refuses to start on the wrong chain", async () => {
    const calls = mockFetch({});
    const r = await signInWithWallet({ wallet: W, chainId: 1, sign: async () => "0x" });
    expect(r).toMatchObject({ ok: false, code: "WRONG_CHAIN" });
    expect(calls).toHaveLength(0);
  });

  it("detects a session that belongs to another wallet", async () => {
    mockFetch({
      "/api/auth/challenge": () => ({ json: { message: "m" } }),
      "/api/auth/verify": () => ({ json: { authenticated: true, wallet: W } }),
      "/api/auth/session": () => ({ json: { authenticated: true, wallet: "0x" + "22".repeat(20) } }),
    });
    const r = await signInWithWallet({ wallet: W, chainId: 677, sign: async () => "0x" + "1".repeat(130) });
    expect(r).toMatchObject({ ok: false, code: "SESSION_MISMATCH" });
  });

  it("reports an unavailable database from the challenge", async () => {
    mockFetch({ "/api/auth/challenge": () => ({ status: 503, json: { error: { code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } } }) });
    const r = await signInWithWallet({ wallet: W, chainId: 677, sign: async () => "0x" });
    expect(r).toMatchObject({ ok: false, code: "UNAVAILABLE" });
  });
});

describe("proof check consumption", () => {
  const hash = "0x" + "ab".repeat(32);
  it("treats only eligible:true as verified", async () => {
    mockFetch({
      "/api/proofs/check": () => ({
        json: {
          eligible: true, code: "OK",
          project: { id: 1, slug: "bot-names", name: "BOT Names" },
          action: { selector: "0x", target: "0x", version: 1 },
          proof: { txHash: hash, from: W, domainName: "a", tokenId: "1", blockNumber: 1, confirmations: 9 },
          explorerUrl: "https://scan.botchain.ai/tx/" + hash,
        },
      }),
    });
    const r = await checkProof(1, hash);
    expect(r.kind).toBe("ok");
  });

  it.each(["WRONG_WALLET", "UNSUPPORTED_ACTION", "TX_FAILED", "PROOF_ALREADY_USED", "REVIEW_ALREADY_EXISTS"])("%s is an ineligible state", async (code) => {
    mockFetch({ "/api/proofs/check": () => ({ json: { eligible: false, code, message: "no" } }) });
    const r = await checkProof(1, hash);
    expect(r).toMatchObject({ kind: "no", code });
    expect(PROOF_STATES[code]).toBeDefined();
  });

  it("a 503 VERIFIER_UNAVAILABLE body is never eligible", async () => {
    mockFetch({ "/api/proofs/check": () => ({ status: 503, json: { eligible: false, code: "VERIFIER_UNAVAILABLE", message: "Database unavailable." } }) });
    const r = await checkProof(1, hash);
    expect(r.kind).toBe("no");
    expect(stateFor("VERIFIER_UNAVAILABLE").retryable).toBe(true);
  });

  it("network failure is a retryable NETWORK state", async () => {
    vi.stubGlobal("fetch", async () => { throw new Error("offline"); });
    const r = await checkProof(1, hash);
    expect(r).toMatchObject({ kind: "no", code: "NETWORK" });
  });
});

describe("prepare, reconcile and reuse", () => {
  const prepared: PreparedReview = {
    eligible: true, code: "OK",
    auth: { reviewer: W, projectId: "1", proofTxHash: "0x" + "ab".repeat(32), contentHash: "0x" + "cd".repeat(32), rating: 5, outcome: 0, nonce: "0", deadline: "999" },
    signature: ("0x" + "11".repeat(65)) as `0x${string}`, chainId: 677,
    registry: "0x5FbDB2315678afecb367f032d93F642f64180aa3", expiresAt: new Date(Date.now() + 600_000).toISOString(),
  };

  it("surfaces NOT_CONFIGURED from prepare", async () => {
    mockFetch({ "/api/reviews/prepare": () => ({ status: 503, json: { error: { code: "NOT_CONFIGURED", message: "x" } } }) });
    const r = await prepareReview({ projectId: 1, transactionHash: "0x" + "ab".repeat(32), rating: 5, outcome: 0, body: "x" });
    expect(r).toMatchObject({ kind: "no", code: "NOT_CONFIGURED" });
    expect(stateFor("NOT_CONFIGURED").message).toBe("Mainnet review publishing not yet available.");
  });

  it("reuses a prepared authorization only for identical input and before expiry", () => {
    const cache = { prepared, key: "k" };
    expect(reusablePrepared(cache, "k")).toBe(prepared);
    expect(reusablePrepared(cache, "other")).toBeNull();
    expect(reusablePrepared(cache, "k", Date.now() + 600_000)).toBeNull();
    expect(reusablePrepared(null, "k")).toBeNull();
  });

  it("retries confirmations then reconciles; only reconciled counts as published", async () => {
    let n = 0;
    mockFetch({
      "/api/reviews/reconcile": () => (++n < 3
        ? { json: { reconciled: false, code: "INSUFFICIENT_CONFIRMATIONS", message: "wait" } }
        : { json: { reconciled: true, code: "OK", review: { id: 42, onchainReviewId: 3, reviewTxHash: "0x" + "ee".repeat(32), projectId: 1 } } }),
    });
    const r = await reconcileWithRetry("0x" + "ee".repeat(32), { delayMs: 0, sleep: async () => undefined });
    expect(r).toMatchObject({ kind: "ok", reviewId: 42 });
    expect(n).toBe(3);
  });

  it("stops on a non-retryable reconcile failure", async () => {
    let n = 0;
    mockFetch({ "/api/reviews/reconcile": () => { n++; return { json: { reconciled: false, code: "TX_FAILED", message: "reverted" } }; } });
    const r = await reconcileWithRetry("0x" + "ee".repeat(32), { sleep: async () => undefined });
    expect(r).toMatchObject({ kind: "no", code: "TX_FAILED" });
    expect(n).toBe(1);
  });
});

describe("reward state labels", () => {
  it("covers every backend reward state", () => {
    for (const s of ["pending_review", "approved_unfunded", "rejected", "claimable", "claimed"]) expect(REWARD_STATE_LABELS[s]).toBeTruthy();
  });
});
