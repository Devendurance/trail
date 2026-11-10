# Trail — Delivery and Launch Project Plan

**Plan date:** Tuesday, 2026-11-10 · **Mainnet target:** Friday, 2026-11-13 · **Usage window:** approximately Nov 13–20, depending on launch time.  
**Critical path:** validate eligible third-party mainnet action proof **before** building the fancy review experience.

## 1. Shipping definition

Trail is shipped when at least two BOT Chain apps have genuinely validated supported-action rules, eligible-wallet transactions can be checked, a signed authorization can be redeemed in a verified Trail mainnet registry, and public readers can see the review text plus both evidence transactions. The website, X account and support channel must be independently active.

**Do not ship a fake proof verifier:** A successful tx hash alone isn't enough, and an unsupported app must not be badged "verified."

## 2. Gated schedule (WAT / Lagos)

| Date | Milestone | Exit gate |
| --- | --- | --- |
| **Nov 10** | Identify real pilot apps, research contracts/ABIs/events; initialize standalone repo, review registry and app catalog | At least **one** actual mainnet eligible sample tx decoded; 2 distinct product-specific X posts |
| **Nov 11** | Second genuine proof adapter, receipt validation API, wallet-signed challenge, signed registry flow | **Two** tested proof adapters; rejected bogus/mismatched tx cases; third X post |
| **Nov 12** | End-to-end `publishReview`, DB reconciliation, content hash checks, public pages; verify contract on mainnet | At least one genuine testnet full review plus one controlled mainnet smoke test; fourth X post |
| **Nov 13** | Mobile QA, verified working launch, explicit mainnet announcement, Mary dossier | Verified real underlying action → real Trail publication → public review; fifth X post |
| **Nov 14–20** | Onboard authentic reviewers of supported apps; respond to feedback and keep uptime | 3 distinct genuine wallets, ≥5 real published review tx if participants organically qualify and Mary accepts them |

**If a second verifier is not proven by Nov 11:** pick a less complex supported BOT Chain DApp with known contract/events, or ship with one honest verified app and record that the two-app PRD goal is incomplete. Never fake verification coverage to meet a deadline.

## 3. Agent execution order

### T-01: confirm action feasibility (highest priority)

- [ ] Shortlist eligible mainnet DApps with public official domain and verifiable contract.
- [ ] Obtain actual successful sample tx and independently inspect sender, `to`, calldata selector and logs.
- [ ] Write first verifier adapter + unit tests with real fixture; document exact eligible action.
- [ ] Repeat with genuinely different second app and record sample tx/hash/contract details.
- [ ] Add policy version and explicitly reject unknown router/smart-wallet paths.

**Exit:** Real eligible tx accepted; wrong sender, unrelated selector and fake tx rejected for both adapters.

### T-02: review contract and proof signer

- [ ] Build append-only EIP-712 TrailReviewRegistry with content hash, reviewer, proof tx and outcome.
- [ ] Implement reviewer-bound `msg.sender`, deadline, nonces, used-proof and per-project review uniqueness.
- [ ] Implement verifier admin rotation / pause for emergency and publish trust disclosure.
- [ ] Test invalid signer/domain/replay/cross-project reuse and signature tampering.
- [ ] Secure server signer secret; environment-scoped DB and RPC config.

**Exit:** Cannot submit a review without valid specific authorization and reviewer's own wallet transaction.

### T-03: reviewer-facing end-to-end UX

- [ ] Build distinctive Trail editorial visual system and curated listings; no copied Quilt/Wink shell.
- [ ] Wallet connect and signed nonce challenge with replay/expiry protection.
- [ ] Evidence check UI with precise failed-proof reasons.
- [ ] Plain text review, outcome tags, content hash + EIP-712 authorization.
- [ ] Wallet submit registry transaction; receipt and review text reconciliation.
- [ ] Public share page with **two different** explorer receipts and verification scope disclaimer.
- [ ] Abuse report and hosted-text hide process.

**Exit:** Reviewer completes proof → review, reader verifies evidence in a new incognito browser.

### T-04: mainnet release and Mary's seven criteria

- [ ] Launch independent Trail site/X/support and public methodology explanation.
- [ ] Publish five substantive posts from Trail's own X within 30 days.
- [ ] Validate footer BOT Chain name/logo and both official ecosystem/explorer links.
- [ ] Deploy/verify Trail registry on chain 677; publish ABI/verified source and record real test txs.
- [ ] Complete at least one real eligible external DApp action and Trail review publication on mainnet.
- [ ] Announce **"Trail has officially launched on BOT Chain mainnet"** only after confirmed launch.
- [ ] Give Mary proof package, clarify whether review publication counts and what seven-day window applies.
- [ ] Maintain app, verification API, signer availability and user support.

## 4. Legitimate adoption and qualifying activity plan

Find genuine users already interested in testing BOT Chain applications. Invite them to try approved apps for their own reasons and to publish **honest** feedback. One review per wallet per supported app means with three authentic reviewers and two tested apps there can be up to six distinct eligible reviews — but nobody should be pressured to do five reviews or rewarded for favorable sentiment. Use only genuine underlying actions, avoid wash swaps and dummy transaction loops, and ask Mary to approve the type of registry interactions that count.

The goal is credible user-first product evidence; reject any instruction from marketing partners to manufacture wallets or review text.

## 5. Quality gates and release blockers

**Absolute blockers:** Proof checker accepts a wrong wallet/unrelated app/failed tx; backend signs without verifying action; reviews publish with forged auth; content hash mismatch; backend verifier secrets exposed; review tx has no public page; no genuine mainnet flow.  
**Defer:** AI summaries, advanced recommendation algorithm, social follows, token economics, universal app indexing, wallet reputation score and automated audit claims.

## 6. Risks / contingencies

| Risk | Why it matters | Contingency |
| --- | --- | --- |
| No eligible tx/ABI for target app | Can't verify real user | Select a different app with clear mainnet action and logs; don't mark unsupported as supported. |
| DEX route changes | Selector/log checks fail | Version allowlist and test new real fixtures; pause action. |
| Review signer stolen/unavailable | Could issue false attestations or block publishing | Key isolation, rotate signer, emergency pause, incident report. |
| Review count hard to reach | Mary's criterion unmet | Onboard real interested explorers; do not invent evidence or promise success. |
| DB and chain out of sync | Review disappears from UI | Idempotent reconciliation by event + `(reviewer,project)`; review remains on-chain. |
| Negative feedback conflicts | Community tension | Publish neutral methodology; moderate abuse, not unpopular opinions. |
| Looks like generic quest app | Weak category independence | Focus public product on readable firsthand experiences and evidence scope, no points/airdrop loop. |

## 7. Evidence log template

| Item | Actual evidence |
| --- | --- |
| Two live approved apps and action schemas | `TBD — verify and document` |
| Underlying valid tx hashes (one per app minimum) | `TBD` |
| Trail registry contract/verification URL | `TBD` |
| Published Trail review tx and share page | `TBD` |
| Failed-proof and forged-authorization test outputs | `TBD` |
| Trail URL, X account/posts, mainnet launch announcement | `TBD` |
| Mary counting acceptance and operations owner | `PENDING` |

## 8. Agent handoff prompt

> Build Trail as a distinct BOT Chain app discovery and evidence-gated review product. Start by validating one *real* third-party mainnet action against target/selector/logs; do not begin by fabricating generic review data. Then implement signed API verification, EIP-712 review registry and a public review page with both transaction references. Respect PRD scope, TRD authorization invariants and architecture trust boundaries. Inspect the repository, preserve unrelated work, implement a bounded slice, test negative cases and report actual external tx fixtures, registry txs and unresolved integration risks.

**Related:** [`PRD.md`](./PRD.md), [`TRD.md`](./TRD.md), [`architecture.md`](./architecture.md).
