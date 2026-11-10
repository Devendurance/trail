# Trail — Technical Requirements Document (TRD)

**Status:** Build specification v1.0 · **Date:** 2026-11-10 · **Network:** BOT Chain mainnet (chain ID 677)

## 1. Technical objective

Provide a curated list of BOT Chain DApps and allow authenticated users to register **one on-chain review per wallet per approved app**, backed by an **unused, independently verified successful eligible transaction**. The server checks transaction evidence and signs an EIP-712 authorization; the user's own wallet must send the review publication transaction to the on-chain registry. Never claim the on-chain registry itself verifies arbitrary past chain history.

## 2. Proposed stack and environment

- Frontend/server: Next.js App Router, React, TypeScript, Tailwind, `viem` + `wagmi`; API routes deployed on Vercel or equivalent.
- Database: Postgres (Neon or other provider) with migrations and unique constraints; server-side query layer; no sensitive secrets in frontend.
- Contracts: Solidity `^0.8.24`, Foundry, OpenZeppelin 5.x `EIP712`, `ECDSA`, `Ownable` and optionally `Pausable` for publication emergencies. Keep on-chain payload compact.
- Signing: dedicated verification signer with no project funds, stored as a server secret/key-management credential. Prefer protected production secret/KMS; never commit or expose as `NEXT_PUBLIC_*`.
- Chain: testnet 968 / `https://rpc.bohr.life` / `https://scan.bohr.life`, mainnet 677 / `https://rpc.botchain.ai` / `https://scan.botchain.ai`.

## 3. Eligible transaction verifier — explicit algorithm

For each supported project maintain a **versioned allowlist** record:

```ts
type SupportedAction = {
  projectId: number;
  chainId: 677;
  approvedContract: `0x${string}`; // canonical tx target
  allowedSelector: `0x${string}`;   // 4-byte function selector
  requiredLogAddress: `0x${string}`;
  requiredTopic0: `0x${string}`;    // eligible event signature topic
  walletBinding: 'tx.from';        // V1 strict EOA path
  minBlock: bigint;                // block after genuine project deploy
  isEnabled: boolean;
};
```

**Server check sequence (all required):**

1. Validate session signature with nonce, domain, expiration and reviewer wallet ownership (e.g. SIWE-like challenge).
2. Require a 32-byte tx hash and an approved `(projectId, supportedActionVersion)`; look up tx + receipt using a trusted chain-677 RPC.
3. Require canonical chain 677, transaction included in a block, receipt status **success**, and chosen minimum confirmation policy satisfied.
4. Require `tx.from == authenticated reviewer` for V1. No smart-wallet or delegated action support unless a separate identity-binding rule is implemented and tested.
5. Require `tx.to == approvedContract`, first 4 calldata bytes equal allowlisted selector, block >= minBlock; inspect receipt logs for allowed `address` + `topic0` and any *action-specific* decoded argument checks. Generic `Transfer` logs, gas spending, wallet connects and unrelated router events are **not** sufficient evidence.
6. Reject globally used proof tx hashes (`chainId + txHash` uniqueness), and reviewer/app duplicates. Also reject unsupported selector/routes even if a receipt succeeded.
7. Verify review text length/sanitation, normalized outcome, and compute content hash. Store staged review + proof metadata in DB; issue signed **short-lived** EIP-712 authorization binding `reviewer`, `projectId`, `txHash`, `contentHash`, `outcome`, `nonce`, `deadline`.
8. User submits the signature to `publishReview` on-chain. After receipt confirmation, index `ReviewPublished`, reconcile staged text and expose a shareable review page. Recheck idempotently if client closes.

**Do not pretend BDEX or BOT Names work with this schema until their real target/selector/log patterns have been verified.** Complex router paths may need custom adapters and are not automatically supported by the generic allowlist. Pilot projects can be changed if integration proves too difficult.

## 4. On-chain review registry — proposed interface

```solidity
enum Outcome { WorkedSmoothly, WorkedWithFriction }

struct ReviewAuth {
  address reviewer;
  uint256 projectId;
  bytes32 proofTxHash;
  bytes32 contentHash;
  Outcome outcome;
  uint256 nonce;
  uint64 deadline;
}

function publishReview(ReviewAuth calldata auth, bytes calldata signature) external;
function hasReviewed(uint256 projectId, address reviewer) external view returns (bool);
function proofUsed(bytes32 proofTxHash) external view returns (bool);
function setVerifier(address nextVerifier) external onlyOwner;

event ReviewPublished(
  uint256 indexed reviewId,
  uint256 indexed projectId,
  address indexed reviewer,
  bytes32 proofTxHash,
  bytes32 contentHash,
  Outcome outcome
);
```

**Contract checks:** `msg.sender == auth.reviewer`; `block.timestamp <= auth.deadline`; `auth.reviewer != address(0)`; valid approved outcome enum; correct EIP-712 domain (name/version/**chainId**/**verifying contract**) and signature from current trusted verifier; reviewer nonce equals expected; `!hasReviewed[projectId][reviewer]`; `!proofUsed[proofTxHash]`; nonzero content/proof hashes; mark nonce/proof/reviewer-app used before emit. Project validity must also be enforced **on-chain** (e.g., an owner-managed set of valid project IDs), or the trusted verifier must be treated as sole authority for supported IDs with that tradeoff documented.

**Security note:** Signer compromise could allow misleading authorization. On-chain wallet binding prevents impersonating an unrelated reviewer, but does **not** make backend verification trustless. Set signer-rotation policy and emergency disable/pause policy; disclose human-controlled verifier.

## 5. Database schema / API contracts

Suggested relational tables:

```text
projects(id PK, slug UNIQUE, name, official_url, category, status, created_at)
supported_actions(id PK, project_id FK, contract_address, selector, event_address,
                  topic0, min_block, version, enabled, verified_sample_tx)
reviews(id PK, review_id_onchain UNIQUE NULL, project_id FK, reviewer_address,
        proof_tx_hash UNIQUE, content_hash, outcome, body_plain_text,
        review_tx_hash UNIQUE NULL, status, created_at)
auth_challenges(nonce_hash PK, wallet, expires_at, consumed_at)
verification_attempts(id PK, project_id, tx_hash, result_code, created_at)
```

Enforce unique `(project_id, lower(reviewer_address))` for committed/staged review policy; `proof_tx_hash` globally unique across Trail reviews. Normalize addresses consistently; manage pending authorization expiry/retry without permanently blocking a legitimate proof after failed submission. Keep project verification config versioned for audits.

Routes: `GET /api/projects`, `GET /api/projects/{slug}`, `POST /api/auth/challenge`, `POST /api/auth/verify`, `POST /api/proofs/check`, `POST /api/reviews/prepare`, `GET /api/reviews/{reviewId}`, `POST /api/reviews/reconcile`. Use authentication on protected endpoints, rate limits, body-size caps and response codes such as `WRONG_SENDER`, `TX_FAILED`, `UNSUPPORTED_ACTION`, `PROOF_USED`, `REVIEW_EXISTS`, `VERIFIER_UNAVAILABLE`.

## 6. Transaction and content verification details

- The underlying tx and Trail `publishReview` tx are **different** transactions. Store and display both.
- A tx hash is neither proof of ownership nor evidence of app use by itself. Decode transaction calldata and allowed event logs with the *correct ABI* and mainnet contract addresses.
- Review body is **off-chain**; its canonical UTF-8 hash is anchored on-chain. On the public page, compare the text hash with the registry value; show mismatch rather than silently serving edited text.
- Review outcome is self-reported; only underlying transaction eligibility is server-verified.
- Permit a text moderation hide/unpublish **in the website** while preserving public immutable on-chain record and its hash. Never represent chain data as erased.
- Restrict preview renderer to escaped plain text, not raw HTML; strip addresses or personal data from operational logs if not needed.

## 7. Threat model / test matrix

| Threat | Required test/control |
| --- | --- |
| Reusing a receipt | Global `proofUsed` and DB unique tx hash; on-chain replay rejection. |
| Copying another wallet's tx | `tx.from == reviewer` and `msg.sender == signed reviewer`. |
| Transaction to unapproved contract | Approved address + selector + event/topic checks. |
| Fake failed transaction | Only confirmed successful receipts accepted. |
| Altering review after authorization | `contentHash` and outcome included in signed typed data. |
| Replaying signature on another chain/contract | EIP-712 chain ID + verifying contract domain. |
| Expired or copied signature | Deadline and nonce, wallet-bound `msg.sender`. |
| Server verifier unavailable | New review disabled with truthful error; old reviews still readable. |
| Signer compromised | Rotate on-chain verifier and disable new authorizations while investigating. |
| Review brigading / false opinions | One review per app/wallet, no paid reviews, rate limits, report/hide policy. |

**Foundry tests:** forged signer, expired auth, wrong domain, invalid project, wrong msg.sender, nonce replay, reused proof cross-project, second review same project/wallet, outcome tampering, signer rotation, malicious empty hash. **Server tests:** wrong chain, receipt failures, wallet mismatch, unknown selector, unrelated event, spoofed RPC, duplicate tx, missing confirmations, old pre-deploy tx, content hash mismatch. **E2E:** real eligible external tx → signed authorization → `publishReview` receipt → correct public page.

## 8. Nonfunctional and operational requirements

- Read-only browse/reviews must remain available without wallet or verifier signer.
- Verification endpoint should be bounded and rate-limited; cache results by tx hash but re-check policy version and reuse state before signature issuance.
- All secrets server-only; no hidden signing key in generated static bundle; deploys separate from Quilt/Wink.
- Use real 677 tx receipts, independent source-verified contract and clear labels for verification coverage. Monitor API 5xx, DB, registry reads, publish failures and expired authorization frequency.
- Never store wallet seed phrases, X credentials or reviewers' real identities.

**External references:** [BOT developer docs](https://dev-docs.botchain.ai/docs/Developers/quick-guide/), [viem event parsing](https://viem.sh/docs/contract/parseEventLogs), [OpenZeppelin EIP-712](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography), [BOT explorer](https://scan.botchain.ai).
