import { keccak256, toHex, type Hex } from "viem";

/// Canonical EIP-712 schema. Must match contracts/src/TrailReviewRegistry.sol
/// REVIEW_AUTH_TYPEHASH exactly:
/// ReviewAuth(address reviewer,uint256 projectId,bytes32 proofTxHash,bytes32 contentHash,
///            uint8 rating,uint8 outcome,uint256 nonce,uint64 deadline)
export const REVIEW_AUTH_TYPEHASH =
  "0xb6cb8d697a7bf43f465a3f7456f08882609b6d76d773388d1292e773b210782a";

export const EIP712_DOMAIN_NAME = "TrailReviewRegistry";
export const EIP712_DOMAIN_VERSION = "1";

export const reviewAuthTypes = {
  ReviewAuth: [
    { name: "reviewer", type: "address" },
    { name: "projectId", type: "uint256" },
    { name: "proofTxHash", type: "bytes32" },
    { name: "contentHash", type: "bytes32" },
    { name: "rating", type: "uint8" },
    { name: "outcome", type: "uint8" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export interface ReviewAuthInput {
  reviewer: `0x${string}`;
  projectId: bigint;
  proofTxHash: `0x${string}`;
  contentHash: `0x${string}`;
  rating: number;
  outcome: number;
  nonce: bigint;
  deadline: bigint;
}

export function reviewAuthDomain(chainId: number, verifyingContract: `0x${string}`) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  } as const;
}

/// Collapse whitespace and trim. Canonical form hashed into contentHash.
export function normalizeBody(body: string): string {
  return body.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function bodyIsValid(normalized: string): boolean {
  return normalized.length >= 100 && normalized.length <= 700;
}

export function contentHashOf(normalized: string): Hex {
  return keccak256(toHex(normalized));
}
