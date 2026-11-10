import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, decodeEventLog, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { contentHashOf, normalizeBody, reviewAuthDomain, reviewAuthTypes } from "../src/lib/eip712";
import { registryAbi } from "../src/lib/registry-abi";
import { publishReviewOnChain } from "../src/lib/client/publish";
import type { PreparedReview } from "../src/lib/client/types";

/// Isolated local Anvil harness (chain 31337, no database, no network).
/// It exercises the SAME client publish path the browser uses against the
/// real compiled TrailReviewRegistry. This is NOT a BOT mainnet end-to-end
/// test: that is reserved for Slice 6.

const ANVIL_BIN = process.env.ANVIL_BIN ?? "C:/Users/USER/.foundry/bin/anvil.exe";
const ARTIFACT = new URL("../contracts/out/TrailReviewRegistry.sol/TrailReviewRegistry.json", import.meta.url);
const HAS_DEPS = existsSync(ANVIL_BIN) && existsSync(ARTIFACT);
const PORT = 8547;
const URL_ = `http://127.0.0.1:${PORT}`;
const VERIFIER_KEY = ("0x" + "44".repeat(32)) as Hex;
const CHAIN_ID = 31337;

const chain = {
  id: CHAIN_ID,
  name: "Anvil",
  nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
  rpcUrls: { default: { http: [URL_] } },
} as const;

describe.skipIf(!HAS_DEPS)("client publish path against a local registry", () => {
  let anvil: ChildProcess | null = null;
  let registry = "0x" as `0x${string}`;
  let reviewer = "0x" as `0x${string}`;
  let other = "0x" as `0x${string}`;
  const verifier = privateKeyToAccount(VERIFIER_KEY);
  const publicClient = createPublicClient({ chain, transport: http(URL_) });
  const body = normalizeBody("Local publish test. The flow connected, the signed authorization converted to contract arguments, the transaction confirmed, and the receipt was read back by the client.");

  async function prepare(proof: Hex, who: `0x${string}`, deadline?: bigint): Promise<PreparedReview> {
    const nonce = (await publicClient.readContract({ address: registry, abi: registryAbi, functionName: "nonces", args: [who] })) as bigint;
    const dl = deadline ?? BigInt(Math.floor(Date.now() / 1000) + 600);
    const auth = { reviewer: who, projectId: BigInt(1), proofTxHash: proof, contentHash: contentHashOf(body), rating: 4, outcome: 0, nonce, deadline: dl };
    const signature = await verifier.signTypedData({ domain: reviewAuthDomain(CHAIN_ID, registry), types: reviewAuthTypes, primaryType: "ReviewAuth", message: auth });
    // Same wire shape /api/reviews/prepare returns: decimal strings for big numbers.
    return {
      eligible: true, code: "OK",
      auth: { reviewer: who, projectId: "1", proofTxHash: proof, contentHash: auth.contentHash, rating: 4, outcome: 0, nonce: nonce.toString(), deadline: dl.toString() },
      signature, chainId: CHAIN_ID, registry, expiresAt: new Date(Number(dl) * 1000).toISOString(),
    };
  }
  const walletFor = (address: `0x${string}`) => createWalletClient({ account: address, chain, transport: http(URL_) });

  beforeAll(async () => {
    anvil = spawn(ANVIL_BIN, ["--port", String(PORT), "--silent"], { stdio: "ignore" });
    for (let i = 0; i < 100; i++) {
      try { await publicClient.getBlockNumber(); break; } catch { await new Promise((r) => setTimeout(r, 100)); }
    }
    const accounts = (await (publicClient.request as (a: unknown) => Promise<`0x${string}`[]>)({ method: "eth_accounts" }));
    const deployer = accounts[0];
    reviewer = accounts[1];
    other = accounts[2];
    const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
    const dep = walletFor(deployer);
    const h = await dep.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode.object as Hex, args: [verifier.address] });
    registry = (await publicClient.waitForTransactionReceipt({ hash: h })).contractAddress!;
    const act = await dep.writeContract({ address: registry, abi: registryAbi, functionName: "setProjectActive", args: [BigInt(1), true] });
    await publicClient.waitForTransactionReceipt({ hash: act });
  }, 60_000);

  afterAll(() => { anvil?.kill(); });

  it("simulates, writes, confirms, and the event matches the prepared auth", async () => {
    const proof = ("0x" + "a1".repeat(32)) as Hex;
    const prepared = await prepare(proof, reviewer);
    const res = await publishReviewOnChain({
      publicClient, walletClient: walletFor(reviewer), prepared, account: reviewer, walletChainId: CHAIN_ID, expectedChainId: CHAIN_ID,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const receipt = await publicClient.getTransactionReceipt({ hash: res.txHash });
    expect(receipt.status).toBe("success");
    const log = receipt.logs.find((l) => l.address.toLowerCase() === registry.toLowerCase())!;
    const ev = decodeEventLog({ abi: registryAbi, data: log.data, topics: log.topics });
    expect(ev.eventName).toBe("ReviewPublished");
    const a = ev.args as unknown as { reviewer: string; projectId: bigint; proofTxHash: string; contentHash: string; rating: number };
    expect(a.reviewer.toLowerCase()).toBe(reviewer.toLowerCase());
    expect(a.projectId).toBe(BigInt(1));
    expect(a.proofTxHash).toBe(proof);
    expect(a.contentHash).toBe(contentHashOf(body));
    expect(a.rating).toBe(4);
    expect(await publicClient.readContract({ address: registry, abi: registryAbi, functionName: "hasReviewed", args: [BigInt(1), reviewer] })).toBe(true);
  });

  it("refuses a second publish for the same wallet and does not hit the wallet", async () => {
    const prepared = await prepare(("0x" + "a2".repeat(32)) as Hex, reviewer);
    let wrote = false;
    const wallet = walletFor(reviewer);
    const res = await publishReviewOnChain({
      publicClient, walletClient: { writeContract: ((...a: unknown[]) => { wrote = true; return (wallet.writeContract as (...x: unknown[]) => unknown)(...a); }) as never },
      prepared, account: reviewer, walletChainId: CHAIN_ID, expectedChainId: CHAIN_ID,
    });
    expect(res).toMatchObject({ ok: false, stage: "simulate" });
    expect(wrote).toBe(false);
  });

  it("fails when the registry-side deadline has passed even if the client clock lags", async () => {
    const prepared = await prepare(("0x" + "a3".repeat(32)) as Hex, other, BigInt(Math.floor(Date.now() / 1000) - 100));
    const res = await publishReviewOnChain({
      publicClient, walletClient: walletFor(other), prepared, account: other, walletChainId: CHAIN_ID, expectedChainId: CHAIN_ID,
      nowSeconds: 0,
    });
    expect(res).toMatchObject({ ok: false, stage: "simulate" });
  });

  it("blocks a connected wallet that is not the prepared reviewer", async () => {
    const prepared = await prepare(("0x" + "a4".repeat(32)) as Hex, other);
    const res = await publishReviewOnChain({
      publicClient, walletClient: walletFor(reviewer), prepared, account: reviewer, walletChainId: CHAIN_ID, expectedChainId: CHAIN_ID,
    });
    expect(res).toMatchObject({ ok: false, stage: "guard", code: "WRONG_ACCOUNT" });
  });
});
