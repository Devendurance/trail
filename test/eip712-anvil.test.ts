import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  parseEventLogs,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { verifyMintProof, type VerifySuccess } from "../src/lib/verify-botnames";
import { contentHashOf, normalizeBody, reviewAuthDomain, reviewAuthTypes } from "../src/lib/eip712";
import { registryAbi } from "../src/lib/registry";
import type { SupportedAction } from "../src/db/schema";

const ANVIL_BIN =
  process.env.ANVIL_BIN ?? "C:/Users/USER/.foundry/bin/anvil.exe";
const ARTIFACT = new URL(
  "../contracts/out/TrailReviewRegistry.sol/TrailReviewRegistry.json",
  import.meta.url,
);
const HAS_DEPS = existsSync(ANVIL_BIN) && existsSync(ARTIFACT);

// Local key: never funded, only used as the off-chain verifier signer.
const VERIFIER_KEY = ("0x" + "11".repeat(32)) as Hex;
const DOMAIN_NFT = "0xbeb7b2bd305f0d9412eb1f4c49541fd048c363ce".toLowerCase();
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DOMAIN_MINTED_TOPIC = "0xcb748939c198a3ac8c51ea9027e77e3c96244f35ceda8277bd2af91c28a72416";

describe.skipIf(!HAS_DEPS)("EIP-712 parity: TS signature accepted by local registry", () => {
  let anvil: ChildProcess | null = null;
  let registry: `0x${string}` = "0x";
  let deployer: `0x${string}` = "0x";
  let reviewer: `0x${string}` = "0x";
  const verifier = privateKeyToAccount(VERIFIER_KEY);

  const anvilChain = {
    id: 31337,
    name: "Anvil",
    nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
    rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  } as const;
  function rpcAccount(address: `0x${string}`) {
    return { address, type: "json-rpc" } as const;
  }

  beforeAll(async () => {
    anvil = spawn(ANVIL_BIN, ["--port", "8545", "--silent"], { stdio: "ignore" });
    const client = createPublicClient({ chain: anvilChain, transport: http("http://127.0.0.1:8545") });
    for (let i = 0; i < 100; i++) {
      try {
        await client.getBlockNumber();
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    [deployer, reviewer] = (await (client.request as (args: unknown) => Promise<[`0x${string}`, `0x${string}`, ...`0x${string}`[]]>)({ method: "eth_accounts" })) as [`0x${string}`, `0x${string}`, ...`0x${string}`[]];
    const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
    const wallet = createWalletClient({
      account: rpcAccount(deployer),
      chain: anvilChain,
      transport: http("http://127.0.0.1:8545"),
    });
    const hash = await wallet.deployContract({
      abi: artifact.abi,
      bytecode: artifact.bytecode.object as Hex,
      args: [verifier.address],
    });
    const rc = await client.waitForTransactionReceipt({ hash });
    registry = rc.contractAddress!;
    const activateHash = await wallet.writeContract({
      address: registry,
      abi: registryAbi,
      functionName: "setProjectActive",
      args: [BigInt(1), true],
    });
    await client.waitForTransactionReceipt({ hash: activateHash });
  }, 60_000);

  afterAll(async () => {
    anvil?.kill();
  });

  function action(): SupportedAction {
    return {
      id: 1,
      projectId: 1,
      version: 1,
      chainId: 677,
      approvedTarget: DOMAIN_NFT,
      functionSelector: "0xc319a11f",
      eventEmitter: DOMAIN_NFT,
      eventTopic0: DOMAIN_MINTED_TOPIC,
      minBlock: 20000000,
      eligibleWalletRule: "eoa",
      sampleTxHash: null,
      enabled: true,
    } as unknown as SupportedAction;
  }

  it("deploys the real registry with the verifier address", async () => {
    const client = createPublicClient({ chain: anvilChain, transport: http("http://127.0.0.1:8545") });
    const nonce = await client.readContract({ address: registry, abi: registryAbi, functionName: "nonces", args: [reviewer] });
    expect(nonce).toBe(BigInt(0));
  });

  it("verifies a synthetic eligible proof, signs, and publishes on-chain", async () => {
    const name = "trailtest";
    const tokenId = BigInt(7);
    const proofTxHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;
    const tokenTopic = `0x${tokenId.toString(16).padStart(64, "0")}` as Hex;
    const fromTopic = `0x000000000000000000000000${reviewer.slice(2).toLowerCase()}` as Hex;
    const tx = {
      hash: proofTxHash,
      from: reviewer,
      to: DOMAIN_NFT,
      chainId: 677,
      blockNumber: BigInt(25760640),
      input: `0xc319a11f${encodeAbiParameters([{ type: "string" }], [name]).slice(2)}` as Hex,
    };
    const receipt = {
      status: "success",
      blockNumber: BigInt(25760640),
      logs: [
        {
          address: DOMAIN_NFT,
          topics: [TRANSFER_TOPIC, "0x0000000000000000000000000000000000000000000000000000000000000000", fromTopic, tokenTopic] as Hex[],
          data: "0x" as Hex,
        },
        {
          address: DOMAIN_NFT,
          topics: [DOMAIN_MINTED_TOPIC, fromTopic, tokenTopic] as Hex[],
          data: encodeAbiParameters([{ type: "string" }], [name]),
        },
      ],
    };
    const provider = {
      getChainId: async () => 677,
      getBlockNumber: async () => BigInt(25760700),
      getTransaction: async () => tx as never,
      getReceipt: async () => receipt as never,
      getCode: async () => "0x" as Hex,
    };
    const verified = await verifyMintProof({ provider, action: action(), wallet: reviewer, txHash: proofTxHash });
    expect(verified.eligible).toBe(true);
    expect((verified as VerifySuccess).domainName).toBe(name);

    const body = normalizeBody(
      "I minted a BOT name to test the full Trail flow. The mint confirmed quickly and the name showed up in my wallet. Fees were clear before signing and the whole process took a minute.",
    );
    expect(body.length).toBeGreaterThanOrEqual(100);

    const client = createPublicClient({ chain: anvilChain, transport: http("http://127.0.0.1:8545") });
    const nonce = await client.readContract({ address: registry, abi: registryAbi, functionName: "nonces", args: [reviewer] });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const auth = {
      reviewer,
      projectId: BigInt(1),
      proofTxHash,
      contentHash: contentHashOf(body),
      rating: 5,
      outcome: 0,
      nonce,
      deadline,
    };
    // Cross-language parity: viem signs here, the Solidity contract verifies.
    const signature = await verifier.signTypedData({
      domain: reviewAuthDomain(31337, registry),
      types: reviewAuthTypes,
      primaryType: "ReviewAuth",
      message: { ...auth },
    });

    const reviewWallet = createWalletClient({
      account: rpcAccount(reviewer),
      chain: anvilChain,
      transport: http("http://127.0.0.1:8545"),
    });
    const pubHash = await reviewWallet.writeContract({
      address: registry,
      abi: registryAbi,
      functionName: "publishReview",
      args: [auth, signature],
    });
    const pubRc = await client.waitForTransactionReceipt({ hash: pubHash });
    expect(pubRc.status).toBe("success");
    const events = parseEventLogs({ abi: registryAbi, logs: pubRc.logs });
    const published = events.find((e) => e.eventName === "ReviewPublished");
    expect(published).toBeDefined();
    expect((published!.args as { reviewer: string }).reviewer.toLowerCase()).toBe(reviewer.toLowerCase());

    const author = await client.readContract({
      address: registry,
      abi: [{ type: "function", name: "getReviewer", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] }] as const,
      functionName: "getReviewer",
      args: [BigInt(1)],
    });
    expect((author as string).toLowerCase()).toBe(reviewer.toLowerCase());
  });

  it("rejects a tampered rating with the same signature", async () => {
    const client = createPublicClient({ chain: anvilChain, transport: http("http://127.0.0.1:8545") });
    const nonce = await client.readContract({ address: registry, abi: registryAbi, functionName: "nonces", args: [reviewer] });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
    const proofTxHash = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as Hex;
    const base = {
      reviewer,
      projectId: BigInt(1),
      proofTxHash,
      contentHash: contentHashOf("x".repeat(120)),
      rating: 5,
      outcome: 0,
      nonce,
      deadline,
    };
    const signature = await verifier.signTypedData({
      domain: reviewAuthDomain(31337, registry),
      types: reviewAuthTypes,
      primaryType: "ReviewAuth",
      message: { ...base },
    });
    const reviewWallet = createWalletClient({
      account: rpcAccount(reviewer),
      chain: anvilChain,
      transport: http("http://127.0.0.1:8545"),
    });
    // Unlocked Anvil accounts do not simulate: a revert surfaces as a failed
    // receipt, not a thrown error.
    const badHash = await reviewWallet.writeContract({
      address: registry,
      abi: registryAbi,
      functionName: "publishReview",
      args: [{ ...base, rating: 1 }, signature],
    });
    const badRc = await client.waitForTransactionReceipt({ hash: badHash });
    expect(badRc.status).toBe("reverted");
  });
});
