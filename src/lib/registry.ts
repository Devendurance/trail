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

export { registryAbi } from "./registry-abi";
import { registryAbi } from "./registry-abi";

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
