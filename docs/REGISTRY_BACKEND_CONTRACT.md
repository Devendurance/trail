# TrailReviewRegistry: backend integration contract

Status: implemented and tested in Slice 2. No deployment yet.

## Contract

- Source: `contracts/src/TrailReviewRegistry.sol` (Solidity 0.8.28, OZ 5.4.0)
- EIP-712 domain: name `TrailReviewRegistry`, version `1`, chainId of deployment
  chain, verifyingContract = registry address.
- No BOT custody, no rewards logic, no upgradeability. Reviews are append-only.

## Canonical EIP-712 schema (backend must reproduce exactly)

```text
domain:    { name: "TrailReviewRegistry", version: "1", chainId, verifyingContract }
type:      ReviewAuth(address reviewer,uint256 projectId,bytes32 proofTxHash,
             bytes32 contentHash,uint8 rating,uint8 outcome,uint256 nonce,uint64 deadline)
typeHash:  keccak256("ReviewAuth(address reviewer,uint256 projectId,bytes32 proofTxHash,bytes32 contentHash,uint8 rating,uint8 outcome,uint256 nonce,uint64 deadline)")
rating:    1..5 user-reported. outcome: 0 = WorkedWell, 1 = WorkedWithFriction.
nonce:     reg.nonces(reviewer), starts at 0, consumed on every publishReview.
deadline:  unix seconds, inclusive. Recommended TTL 10 minutes from signing.
```

## Backend signing payload (prepare endpoint)

1. Verify session wallet, then run the Slice 3 receipt verifier for the
   project-specific supported action. Only sign when it passes.
2. Normalize body (100-700 chars), keccak256 it as `contentHash`.
3. Read `nonce = reg.nonces(reviewer)` on the deployment chain. Never cache it.
4. Build the auth above, sign with the server verifier key (EIP-712), return
   `{ auth, signature, registry, chainId }`. Never accept client-made auths.

## On-chain checks (do not rely on client)

- `msg.sender == auth.reviewer`; signature recovers to `verifier()`.
- Deadline, project active, rating 1-5, nonzero hashes.
- Nonce match, proof unused (`proofUsed(proofTxHash)`), no prior wallet review
  (`hasReviewed(projectId, reviewer)`). Proof key binds `block.chainid`.
- Paused registry rejects everything; admin cannot edit stored reviews.

## Reads for Slice 3

- `publishReview(auth, sig) -> reviewId`, event `ReviewPublished(reviewId,
  projectId, reviewer, proofTxHash, contentHash, rating, outcome)`.
- `hasReviewed`, `proofUsed`, `getReviewer(reviewId)`, `getReview(reviewId)`,
  `nonces`, `projectActive`, `verifier`, `reviewCount`.
- Reconcile by matching a successful receipt whose logs contain
  `ReviewPublished` from the exact registry address.

## Trust assumptions

- The contract does NOT verify any historical external transaction. Proof
  validity is entirely the Slice 3 verifier's job before signing.
- Verifier key is server-only. Rotation kills outstanding authorizations.
- Owner (deployer) can rotate verifier, toggle projects, pause. Compromise of
  owner or verifier is out of scope for the contract and must be handled
  operationally (rotation + pause).
