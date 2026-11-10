import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { botMainnet } from "./chain";
import { BOT_MAINNET_RPC, getDeployedRegistry, getVerifierKey } from "./config";
import { reviewAuthTypes, reviewAuthDomain, type ReviewAuthInput } from "./eip712";

export const registryAbi = [
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "reviewer", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "hasReviewed",
    stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }, { name: "reviewer", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "proofUsed",
    stateMutability: "view",
    inputs: [{ name: "proofTxHash", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "projectActive",
    stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "verifier",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "event",
    name: "ReviewPublished",
    inputs: [
      { name: "reviewId", type: "uint256", indexed: true },
      { name: "projectId", type: "uint256", indexed: true },
      { name: "reviewer", type: "address", indexed: true },
      { name: "proofTxHash", type: "bytes32", indexed: false },
      { name: "contentHash", type: "bytes32", indexed: false },
      { name: "rating", type: "uint8", indexed: false },
      { name: "outcome", type: "uint8", indexed: false },
    ],
  },
  {
    type: "function",
    name: "setProjectActive",
    stateMutability: "nonpayable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "publishReview",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "auth",
        type: "tuple",
        components: [
          { name: "reviewer", type: "address" },
          { name: "projectId", type: "uint256" },
          { name: "proofTxHash", type: "bytes32" },
          { name: "contentHash", type: "bytes32" },
          { name: "rating", type: "uint8" },
          { name: "outcome", type: "uint8" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint64" },
        ],
      },
      { name: "sig", type: "bytes" },
    ],
    outputs: [{ name: "reviewId", type: "uint256" }],
  },
] as const;

export function registryClient() {
  return createPublicClient({ chain: botMainnet, transport: http(BOT_MAINNET_RPC) });
}

export async function readRegistryState(args: {
  chainId: number;
  reviewer: `0x${string}`;
  projectId: bigint;
  proofTxHash: Hex;
}): Promise<{ nonce: bigint; reviewed: boolean; used: boolean; active: boolean } | null> {
  const registry = getDeployedRegistry(args.chainId);
  if (!registry) return null;
  try {
    const client = registryClient();
    const [nonce, reviewed, used, active] = await Promise.all([
      client.readContract({ address: registry, abi: registryAbi, functionName: "nonces", args: [args.reviewer] }),
      client.readContract({ address: registry, abi: registryAbi, functionName: "hasReviewed", args: [args.projectId, args.reviewer] }),
      client.readContract({ address: registry, abi: registryAbi, functionName: "proofUsed", args: [args.proofTxHash] }),
      client.readContract({ address: registry, abi: registryAbi, functionName: "projectActive", args: [args.projectId] }),
    ]);
    return { nonce, reviewed, used, active };
  } catch {
    return null;
  }
}

export async function signReviewAuth(args: {
  chainId: number;
  registry: `0x${string}`;
  auth: ReviewAuthInput;
}): Promise<Hex | null> {
  const key = getVerifierKey();
  if (!key) return null;
  const account = privateKeyToAccount(key);
  return account.signTypedData({
    domain: reviewAuthDomain(args.chainId, args.registry),
    types: reviewAuthTypes,
    primaryType: "ReviewAuth",
    message: { ...args.auth },
  });
}

export function registryWalletClient(chainId: number, key: Hex) {
  const account = privateKeyToAccount(key);
  return createWalletClient({ account, chain: botMainnet, transport: http(BOT_MAINNET_RPC) });
}
