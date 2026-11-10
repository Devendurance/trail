# Trail — Paste this into Pi at the start of the fresh build session

```text
/skill:fast-build

We're building Trail, a new stand-alone BOT Chain ecosystem product, from an empty GitHub repository: https://github.com/Devendurance/trail.git . I have about five focused hours for the first working mainnet release. Our implementation order is BACKEND FIRST; do not start frontend feature wiring until the contract, real-action verification, and review-publication backend gates pass.

Read docs/TRAIL_V2_5H_EXECUTION_PLAN.md and docs/QUALITY_REWARDS_POLICY.md first. Those are the current requirements and supersede earlier Trail/TRIED material where they conflict. The product is NOT a generic review form. A real user must prove a real, eligible BOT Chain on-chain action with the same wallet; only then can they publish a wallet-signed, on-chain review with a verified underlying transaction link. We also need honest, sample-size-aware ecosystem rankings and a quality-first BOT rewards policy, with actual rewards disabled until tested, budgeted, funded and safe. No fake data or synthetic user activity.

Repo truth: the GitHub repository was created as public, main branch, apparently empty on Nov 10. Recheck that rather than assuming there is a starter project; clone it if needed. Prefer initializing a Next.js/TypeScript app in the cloned repo (do not create nested project directories by accident). Setup a Foundry workspace for contracts, Postgres migration plan and clean .env.example. Preserve any real files found, and commit/push each verified vertical slice.

Chain specifics: BOT Chain mainnet chain ID 677, RPC https://rpc.botchain.ai, explorer https://scan.botchain.ai; Bohr testnet 968, RPC https://rpc.bohr.life. Never confuse networks or invent deployment/proof evidence. Wallet writes must verify chain ID.

Critical first slice: independently investigate and pin ONE REAL eligible BOT Chain mainnet transaction from a supported third-party DApp. BOT Names has published DomainNFT contract 0xBeB7B2BD305F0d9412EB1f4C49541FD048C363CE and mintDomain(string) (https://botn.in/docs). BDEX V2 has router 0x1414eD29FdFD322c3c0a830330ed982E2D629e76 (https://dev-docs.botchain.ai/docs/DEX/contract-addresses/). These are CANDIDATES only. Record an actual sample tx, ABI, tx.from, tx.to, selector, success receipt, event emitter, event topic, relevant decoded args, block and negative cases. If neither is a clean choice, use a different verifiable real BOT Chain DApp. Don't mark apps supported on reputation or link alone.

Build sequence and hard gates:
(1) Contract: TrailReviewRegistry with EIP-712 verifier authorization, msg.sender==reviewer, domain/chain binding, active project IDs, 1-5 rating, hash of normalized text, 1 review per wallet/app, 1 use per underlying proof tx, nonce/expiry, events, admin signer rotation/pause. Add positive and adversarial Foundry tests.
(2) Backend: database migrations, session challenge/nonce verification, versioned supported-action allowlist, real receipt+tx+log verifier and fixtures, typed API errors, proof uniqueness, signed review prepare, actual event/receipt reconciliation.
(3) Queries: app catalog, review feed with BOTH underlying action and Trail tx, Bayesian-smoothed ranking with explicit review counts and unranked status below three independent eligible wallets. Never rank by rewards or on-chain voting counts.
(4) Quality reward workflow: 0-10 sentiment-neutral usefulness rubric, moderator decision/audit status, transparent pool status, reward allocations schema. If core gates and time allow, implement separately funded TrailRewards vault with reviewer-bound once-only claims, caps and complete tests. Otherwise preserve the reward policy, expose “not funded/not active”, and do NOT advertise claimable BOT.
(5) Frontend: connect wallet; browse real apps; paste underlying tx; display verification verdict; choose 1-5 score/outcome; submit 100-700 character review; sign on-chain publish; show real receipt; public discovery, app, review, methodology and rewards info pages. Mobile and wallet error states.
(6) Testnet E2E, small-value mainnet registry deployment and source verification only after tests; then production frontend and public smoke checks. Report exact real tx hashes, contract addresses, tests, wallet flow, deploy URL and blockers. A launch announcement must only be drafted or published after the site and mainnet flow are genuinely live.

Mary's criteria: own X account and five substantive posts within 30 days; actual mainnet-launch announcement; own working site with BOT Chain and botchain.ai and scan.botchain.ai links; wallet-connected working core action; independent code/operations; at least 3 genuine wallets and 5 eligible Trail review-publication transactions within 7 days; continuous operation. Don't use paid, faked, coordinated or copied review content to manufacture quota. Ask Mary whether neutral quality incentives are permitted; no assumption that reward claims count as core interactions.

Use available preconfigured Fast-Build skills appropriately; persist progress in .fast-build/STATE.md so fresh Pi sessions can continue without redundant audits. Never broaden scope to a full generalized review protocol or all-chain indexer. Preserve unrelated changes. Run necessary tests once per slice with meaningful regression checks. Record deterministic next action after every slice. If the backend is not ready, don't pretend frontend mock data is real. If a safety gate fails, report the blocker and stop short of unsupported production claims.

Start NOW with repository truth, toolchain check and a REAL pilot transaction evidence fixture (not UI). Report the first slice's actual result and what slice should start next.
```

### Local setup if your agent does not clone itself

```bash
git clone https://github.com/Devendurance/trail.git trail
cd trail
# If blank, initialize the app IN THIS DIRECTORY, not trail/trail.
# Keep secrets in .env.local (gitignored). Never commit them.
```

### How to continue after first Pi slice

```text
Continue Trail from .fast-build/STATE.md and the latest tested commit. Complete only the next highest-priority vertical slice from docs/TRAIL_V2_5H_EXECUTION_PLAN.md. Do not re-audit implemented work unless a targeted verification fails. Show executed tests and genuine chain evidence; do not claim mainnet launch before a real successful Trail publishReview transaction exists.
```
