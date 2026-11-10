# Fast Build State

## Product
- Name: Trail (BOT Chain ecosystem product reviews)
- Outcome: Real user proves a real eligible BOT Chain mainnet action with the same wallet, then publishes a wallet-signed on-chain review.
- Primary demo path: browse app -> paste underlying tx -> verification verdict -> 1-5 score + 100-700 char review -> sign + publish on-chain -> real receipt shown.

## MVP slices
- [x] Slice 1: Repo truth + toolchain + ONE real pilot tx evidence fixture (no UI)
- [ ] Slice 2: Foundry workspace + TrailReviewRegistry contract + pos/neg tests
- [ ] Slice 3: Postgres migrations + wallet nonce auth + receipt verifier + fixtures + signed prepare
- [ ] Slice 4: Reconcile + queries (catalog/feed/rankings) + quality states
- [ ] Slice 5: Frontend wired to real APIs/contracts (discover -> proof -> review -> receipt)
- [ ] Slice 6: Testnet E2E -> small-value mainnet registry deploy + verify -> prod + smoke checks

## Current slice
- Slice 2: Foundry workspace + TrailReviewRegistry + tests

## Completed
- Slice 1 (2026-11-10): GitHub repo exists but IS EMPTY (created 13:35Z, no refs); local Next.js starter on master, 1 commit, no remote. Toolchain: node 24, npm 11, gh OK; forge/cast MISSING. Pinned BOT Names mintDomain pilot tx 0xa04b7f06... (block 25760640, domain "settravaltd", tokenId 24, 0.1 BOT fee, ~4M confirmations). Evidence: evidence/pilot-proof.botnames-mint.json + evidence/domainnft.abi.json. BDEX router live but rejected for V1 (nested-swap verification risk).

## Existing capabilities
- capability: Next.js 16 + React 19 starter (gsap/lenis/lucide pre-added by user)
  - evidence: package.json, src/app/page.tsx (default template, untouched)
  - status: partial (scaffold only, no Trail code)

## Remaining MVP gaps
- gap: No contract, verifier, DB, or API yet; frontend is stock template
  - why it blocks the demo: core action (proof -> publish) has no backend
  - next smallest complete slice: Slice 2 contract + tests

## Blockers
- forge/cast missing (install Foundry before Slice 2). NoForge run yet.
- Push pending: remote empty; rename master->main on first push.

## Verification
- Slice 1: live RPC chainId 0x2a5=677 OK; eth_getCode both candidates OK; tx+receipt+logs fetched from RPC; DomainMinted topic0 recomputed via keccak matches log; tokenId cross-checked Transfer/DomainMinted; from EOA (code 0x); negative cases recorded, not yet executable tests.

## Next action
- Install Foundry, scaffold contracts/, write TrailReviewRegistry + Foundry tests (pos + adversarial), run forge test. Do NOT start frontend wiring.
