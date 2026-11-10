# Fast Build State

## Product
- Name: Trail (BOT Chain ecosystem product reviews)
- Outcome: Real user proves a real eligible BOT Chain mainnet action with the same wallet, then publishes a wallet-signed on-chain review.
- Primary demo path: browse app -> paste underlying tx -> verification verdict -> 1-5 score + 100-700 char review -> sign + publish on-chain -> real receipt shown.

## MVP slices
- [x] Slice 1: Repo truth + toolchain + ONE real pilot tx evidence fixture (no UI)
- [x] Slice 2: Foundry workspace + TrailReviewRegistry + tests (forge 1.8.5, OZ v5.4.0, 23 tests pass)
- [x] Slice 3: Postgres migrations + wallet nonce auth + receipt verifier + fixtures + signed prepare
- [ ] Slice 4: Reconcile + queries (catalog/feed/rankings) + quality states
- [ ] Slice 5: Frontend wired to real APIs/contracts (discover -> proof -> review -> receipt)
- [ ] Slice 6: Testnet E2E -> small-value mainnet registry deploy + verify -> prod + smoke checks

## Current slice
- Slice 4: review reconciliation, public discovery queries, rankings, quality states

## Completed
- Slice 3 (2026-11-10): Backend done, no UI. Neon Postgres project `trail` (royal-bar-91555481, PG 18); drizzle schema (projects, supported_actions, login_nonces, reviews, verification_attempts) with partial-unique published guards; migrate via db:generate/db:migrate (no push). Docs nonce typeHash fixed to uint256 (contract is source of truth). Auth: challenge/verify/session/logout, single-use nonces, HMAC sessions. Verifier: 14 checks against live RPC; seeded BOT Names project 1 + v1 action. Endpoints: proofs/check, reviews/prepare (NOT_CONFIGURED until registry deploys). Tests: 24 vitest pass (verifier 9, auth 9, db 3, anvil parity 3); forge 23/23; typecheck/lint/build clean; live prod smoke (challenge->verify->session->check->prepare->reuse-reject) green.
- Slice 2 (2026-11-10): TrailReviewRegistry live in contracts/src/. EIP-712 auth (reviewer, projectId, proofTxHash, contentHash, rating, outcome, nonce, deadline). Guarantees: caller==reviewer, verifier sig, chain+contract-bound domain, expiry, rating 1-5, active projects, nonzero hashes, one review per wallet/app, proof single-use incl. cross-project, append-only reviews, admin rotate/toggle/pause. forge build clean, forge test 23/23 pass (3 pos incl. 2 fuzz x256 runs, 20 neg). Handoff doc docs/REGISTRY_BACKEND_CONTRACT.md. Foundry 1.8.5 official build (1.9.0 upgrade download timed out, retriable). OZ pinned v5.4.0 (c64a1ed), forge-std dc647cc. No deployment, no UI, no vault.
- Slice 1 pushed as 797b5f6 on origin/main. Pilot proof: BOT Names mintDomain tx 0xa04b7f06... block 25760640, tokenId 24, domain "settravaltd" (evidence/pilot-proof.botnames-mint.json). BDEX rejected for V1.

## Existing capabilities
- capability: Next.js 16 + React 19 starter (gsap/lenis/lucide pre-added by user)
  - evidence: package.json, src/app/page.tsx (default template, untouched)
  - status: partial (scaffold only, no Trail code)

## Remaining MVP gaps
- gap: No DB, verifier API, or frontend yet; registry done and tested
  - why it blocks the demo: proof must be verified off-chain and signed before publish
  - next smallest complete slice: Slice 3 backend

## Blockers
- None. REGISTRY_ADDRESS_MAINNET intentionally unset, prepare honestly returns NOT_CONFIGURED (Slice 6 deploys).

## Verification
- Slice 3: db:generate (no drift), db:migrate applied, db:check clean, vitest 24/24, tsc clean, eslint clean, next build clean (6 API routes), forge 23/23, live smoke on prod build green.
- Slice 2: forge build clean; forge test 23 passed / 0 failed. Root eslint skipped (no TS changes; contracts outside its scope).
- Slice 1: live RPC chainId 0x2a5=677 OK; eth_getCode both candidates OK; tx+receipt+logs fetched from RPC; DomainMinted topic0 recomputed via keccak matches log; tokenId cross-checked Transfer/DomainMinted; from EOA (code 0x); negative cases recorded, not yet executable tests.

## Next action
- Slice 4: reconcile endpoint, public catalog/feed/rankings aggregation, quality states. Do NOT build frontend or rewards vault.
