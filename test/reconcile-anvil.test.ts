import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createPublicClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getDb } from "../src/db";
import { reviews } from "../src/db/schema";
import { contentHashOf, normalizeBody, reviewAuthDomain, reviewAuthTypes } from "../src/lib/eip712";
import { reconcileReviewPublication } from "../src/lib/reconcile";
import { registryAbi } from "../src/lib/registry";
import type { PublicClient } from "../src/lib/chain";

const ANVIL_BIN = process.env.ANVIL_BIN ?? "C:/Users/USER/.foundry/bin/anvil.exe";
const ARTIFACT = new URL("../contracts/out/TrailReviewRegistry.sol/TrailReviewRegistry.json", import.meta.url);
const HAS_DEPS = Boolean(process.env.DATABASE_URL) && existsSync(ANVIL_BIN) && existsSync(ARTIFACT);
const VERIFIER_KEY = ("0x" + "33".repeat(32)) as Hex;

const describeOrSkip = HAS_DEPS ? describe : describe.skip;

describeOrSkip("reconciliation against a local registry", () => {
  let anvil: ChildProcess | null = null;
  let registry = "0x" as `0x${string}`;
  let reviewer = "0x" as `0x${string}`;
  const verifier = privateKeyToAccount(VERIFIER_KEY);
  const body = normalizeBody(
    "I minted a test name through the full local flow to verify reconciliation. The mint confirmed, the name resolved, and the auth matched the staged row exactly for this test.",
  );
  const contentHash = contentHashOf(body);
  const proofA = ("0x" + "a1".repeat(32)) as Hex;
  const proofB = ("0x" + "b2".repeat(32)) as Hex;

  const anvilChain = {
    id: 31337,
    name: "Anvil",
    nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
    rpcUrls: { default: { http: ["http://127.0.0.1:8546"] } },
  } as const;
  const url = "http://127.0.0.1:8546";
  const rpcAccount = (address: `0x${string}`) => ({ address, type: "json-rpc" }) as const;

  let client: ReturnType<typeof createPublicClient> | null = null;

  beforeAll(async () => {
    anvil = spawn(ANVIL_BIN, ["--port", "8546", "--silent"], { stdio: "ignore" });
    client = createPublicClient({ chain: anvilChain, transport: http(url) });
    for (let i = 0; i < 100; i++) {
      try {
        await client.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    const [deployer, reviewerAddr] = (await (client.request as (a: unknown) => Promise<[`0x${string}`, ...`0x${string}`[]]>)({ method: "eth_accounts" }));
    reviewer = reviewerAddr;
    const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
    const { createWalletClient } = await import("viem");
    const wallet = createWalletClient({ account: rpcAccount(deployer), chain: anvilChain, transport: http(url) });
    const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex, args: [verifier.address] });
    const rc = await client.waitForTransactionReceipt({ hash });
    registry = rc.contractAddress!;
    const actHash = await wallet.writeContract({ address: registry, abi: registryAbi, functionName: "setProjectActive", args: [BigInt(1), true] });
    const actRc = await client.waitForTransactionReceipt({ hash: actHash });
    if (actRc.status !== "success") throw new Error(`activation failed: ${actRc.status}`);
    const active = (await client.readContract({ address: registry, abi: registryAbi, functionName: "projectActive", args: [BigInt(1)] })) as boolean;
    if (!active) throw new Error("project 1 not active after activation");
    const act2Hash = await wallet.writeContract({ address: registry, abi: registryAbi, functionName: "setProjectActive", args: [BigInt(2), true] });
    await client.waitForTransactionReceipt({ hash: act2Hash });

    // Two staged rows for the same proof: one active (the winner), one
    // expired (simulates a stale retry that must be retired, not duplicated).
    const db = getDb();
    await db.insert(reviews).values({
      projectId: 1, reviewer: reviewer.toLowerCase(), chainId: 31337,
      proofTxHash: proofA.toLowerCase(), rating: 5, outcome: 0,
      normalizedBody: body, contentHash, status: "prepared",
      authDeadline: new Date(Date.now() + 600_000),
    });
    await db.insert(reviews).values({
      projectId: 1, reviewer: reviewer.toLowerCase(), chainId: 31337,
      proofTxHash: proofA.toLowerCase(), rating: 5, outcome: 0,
      normalizedBody: body, contentHash, status: "prepared",
      authDeadline: new Date(Date.now() - 1000),
    });
  }, 60_000);

  afterAll(async () => {
    anvil?.kill();
    const db = getDb();
    for (const p of [proofA, proofB]) {
      await db.delete(reviews).where(and(eq(reviews.reviewer, reviewer.toLowerCase()), eq(reviews.proofTxHash, p.toLowerCase())));
    }
  });

  async function publish(proof: Hex, rating = 5, projectId = BigInt(1)): Promise<Hex> {
    const { createWalletClient } = await import("viem");
    const c = client!;
    const nonce = (await c.readContract({ address: registry, abi: registryAbi, functionName: "nonces", args: [reviewer] })) as bigint;
    const auth = {
      reviewer, projectId, proofTxHash: proof, contentHash,
      rating, outcome: 0, nonce, deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
    };
    const signature = await verifier.signTypedData({
      domain: reviewAuthDomain(31337, registry),
      types: reviewAuthTypes,
      primaryType: "ReviewAuth",
      message: { ...auth },
    });
    const w = createWalletClient({ account: rpcAccount(reviewer), chain: anvilChain, transport: http(url) });
    const h = await w.writeContract({ address: registry, abi: registryAbi, functionName: "publishReview", args: [auth, signature] });
    await c.waitForTransactionReceipt({ hash: h });
    // Anvil only mines on demand: push real blocks past the confirmation threshold.
    for (let i = 0; i < 5; i++) {
      const mh = await w.sendTransaction({ to: reviewer, value: BigInt(0) });
      await c.waitForTransactionReceipt({ hash: mh });
    }
    return h;
  }

  it("accepts a genuine registry event and retires the stale duplicate", async () => {
    const pubHash = await publish(proofA);
    const res = await reconcileReviewPublication({
      client: client as unknown as PublicClient,
      chainId: 31337, registry, reviewerWallet: reviewer, txHash: pubHash,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.code).toBe("OK");
    expect(res.onchainReviewId).toBe(1);
    const db = getDb();
    const rows = await db.select().from(reviews).where(and(eq(reviews.reviewer, reviewer.toLowerCase()), eq(reviews.proofTxHash, proofA.toLowerCase())));
    const published = rows.filter((r) => r.status === "published");
    expect(published.length).toBe(1);
    expect(published[0].reviewTxHash).toBe(pubHash.toLowerCase());
    expect(published[0].onchainReviewId).toBe(1);
    expect(rows.filter((r) => r.status === "expired").length).toBe(1);
  });

  it("is idempotent on repeat calls", async () => {
    const db = getDb();
    const [row] = await db.select().from(reviews).where(and(eq(reviews.reviewer, reviewer.toLowerCase()), eq(reviews.proofTxHash, proofA.toLowerCase()), eq(reviews.status, "published")));
    const res = await reconcileReviewPublication({
      client: client as unknown as PublicClient,
      chainId: 31337, registry, reviewerWallet: reviewer, txHash: row.reviewTxHash as Hex,
    });
    expect(res.ok && res.code).toBe("ALREADY_PUBLISHED");
  });

  it("rejects a wrong-registry address", async () => {
    const db = getDb();
    const [row] = await db.select().from(reviews).where(and(eq(reviews.reviewer, reviewer.toLowerCase()), eq(reviews.status, "published")));
    const res = await reconcileReviewPublication({
      client: client as unknown as PublicClient,
      chainId: 31337,
      registry: ("0x" + "99".repeat(20)) as `0x${string}`,
      reviewerWallet: reviewer, txHash: row.reviewTxHash as Hex,
    });
    expect(!res.ok && res.code).toBe("NO_REVIEW_EVENT");
  });

  it("rejects unknown hashes and wrong wallets", async () => {
    const missing = await reconcileReviewPublication({
      client: client as unknown as PublicClient,
      chainId: 31337, registry, reviewerWallet: reviewer,
      txHash: ("0x" + "cc".repeat(32)) as Hex,
    });
    expect(!missing.ok && missing.code).toBe("TX_NOT_FOUND");
    const db = getDb();
    const [row] = await db.select().from(reviews).where(and(eq(reviews.reviewer, reviewer.toLowerCase()), eq(reviews.status, "published")));
    const stranger = await reconcileReviewPublication({
      client: client as unknown as PublicClient,
      chainId: 31337, registry,
      reviewerWallet: ("0x" + "dd".repeat(20)) as `0x${string}`,
      txHash: row.reviewTxHash as Hex,
    });
    expect(!stranger.ok && stranger.code).toBe("WRONG_WALLET");
  });

  it("never manufactures a review without a staged row", async () => {
    // Project 2 keeps the one-review-per-wallet rule intact for project 1.
    const pubHash = await publish(proofB, 5, BigInt(2));
    const res = await reconcileReviewPublication({
      client: client as unknown as PublicClient,
      chainId: 31337, registry, reviewerWallet: reviewer, txHash: pubHash,
    });
    expect(!res.ok && res.code).toBe("NO_STAGED_REVIEW");
  });

  it("rejects failed publication receipts", async () => {
    // proofB is already consumed on-chain: this publish reverts on-chain.
    const badHash = await publish(proofB, 5, BigInt(2));
    const res = await reconcileReviewPublication({
      client: client as unknown as PublicClient,
      chainId: 31337, registry, reviewerWallet: reviewer, txHash: badHash,
    });
    expect(!res.ok && res.code).toBe("TX_FAILED");
  });
});
