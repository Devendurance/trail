# Trail — Product Requirements Document (PRD)

**Status:** Implementation-ready draft v1.0 · **Date:** 2026-11-10  
**Brand:** Trail (locked; formerly TRIED) · **Network:** BOT Chain mainnet (677)  
**Launch target:** Friday, 2026-11-13 · **Related docs:** `TRD.md`, `architecture.md`, `projectplan.md`.

> **Proposed positioning, pending final copy:** Trail helps people discover BOT Chain apps through firsthand reports from wallets that completed a verified, supported on-chain action. It verifies use, **not review truthfulness, product safety or project legitimacy**.

## 1. Problem and market gap

A directory answers "what projects exist?" while social votes answer "which projects have attention?" Neither reliably tells a newcomer what a real user experienced after completing a product action. Builders likewise need readable feedback from people who have genuinely tried their app. Trail pairs a small curated directory with evidence-gated reviews and clear limitations.

**Job to be done:** "Before I connect to a new BOT Chain DApp, show me understandable experiences from people who actually used it; after I use one, let me help the next person with a transparent review."

**Audiences:** explorers and new users; builders shipping BOT Chain products; independent community reviewers.  
**Why BOT Chain benefits:** sends discovery traffic to existing DApps, improves useful product feedback, and gives real usage a voice distinct from popularity rankings.

**Not a security auditor, certification service, app store ranking guarantee, campaign quest engine or synthetic review generator.**

## 2. Core experience

1. **Explore:** Browse a small, intentionally curated collection of supported BOT Chain mainnet apps. Each listing has category, plain description, official outbound link and verification coverage label.
2. **Try:** Open an app and perform a real eligible action (for example a documented BDEX swap or a name registration **only once the exact contract and log pattern have been validated on mainnet**).
3. **Prove:** Connect the **same originating wallet** to Trail; provide that action's tx hash. Trail verifies chain, receipt success, tx sender and an allowlisted contract/action/event pattern.
4. **Review:** Write a concise, candid experience, select "worked smoothly" or "worked with friction," and publish a signed proof-authorized review on the Trail registry.
5. **Discover:** Others see the review, transaction explorer reference, reviewer address and status explanation, then can follow the official outbound link.

**Important distinction:** A successful qualifying transaction proves one eligible action occurred. It does not prove the user's comments are correct, that the user is unique, or that the underlying DApp is safe. Trail uses the label **"Eligible action verified"**, not "trusted" or "certified."

## 3. Scope and acceptance criteria

| ID | P0 requirement | Acceptance criterion |
| --- | --- | --- |
| T-P01 | Curated app directory | Start with **2** eligible apps; each has verified canonical domain, mainnet contract and an explicitly documented supported action. |
| T-P02 | Read-only app page | Public page shows what can be verified, where to perform it, plus reviews and any known limitations. |
| T-P03 | Wallet connect + session proof | Connect EVM wallet on chain 677; server authenticates review requester via signed nonce. |
| T-P04 | Eligible transaction validation | Reject unknown tx, wrong chain, failed receipt, incorrect originating wallet, unsupported target/action/log and reused proof. |
| T-P05 | Review content | 50–500 plain-text characters (configurable), `worked_smoothly` or `worked_with_friction`; show clear community guidelines. |
| T-P06 | Signed on-chain publication | Server provides short-lived typed authorization for a specific author, app, tx hash and content hash; wallet publishes a review registry tx. |
| T-P07 | Proof uniqueness | One transaction proof cannot back multiple Trail reviews; V1 one review per wallet per supported app. |
| T-P08 | Public verifiability | Review page shows wallet, underlying eligible tx, Trail publication tx, time and verification scope. |
| T-P09 | Moderation guardrails | Spam/abuse report route; hosted review text can be hidden if abusive while on-chain hash and public record remain. |
| T-P10 | Independent presence | Trail-specific site, X account and content; BOT Chain footer with website/explorer links; public uptime. |

### MVP screens/routes

- `/`: editorial discovery and "How verification works" explanation.
- `/apps`: curated supported dApps with categories and coverage labels.
- `/apps/[slug]`: details, official launch link, eligibility instructions and review feed.
- `/review/[projectId]`: connect, authenticate, tx hash, verification, review composer and publish.
- `/r/[reviewId]`: independently viewable review, evidence and explorer URLs.
- `/methodology`: policy, limitations and support contact.

### UX edge cases

- When no review exists: show honest empty state and how to become first reviewer, not fabricated social proof.
- Wallet connected but `tx.from` different: explain same-wallet requirement; never accept proof by screenshot alone.
- Failed transaction: do not label as verified-use; offer a separate **unverified feedback** channel later, not a fake proof.
- Successful transaction but unsupported route: explain exactly which action patterns are supported rather than implying all transactions qualify.
- On-chain proof published but review text not yet available: display canonical content hash and a retry/recovery state.

## 4. Distinctive value and content principles

Trail's moat in V1 is **evidence-scoped human feedback**: it connects real eligible on-chain usage to experience reports. Avoid generic five-star ratings, paid rankings, viral point farming, sybil-proof identity claims and investment advice. Listings should be curated for coverage quality, not pay-for-placement. Keep a useful feedback category: `worked_with_friction` allows honest reporting even when a transaction succeeded.

**No paid reviews** or any compensation conditional on positive sentiment. Reviewers should disclose material conflicts if applicable. Public addresses are pseudonymous, not an identity guarantee.

## 5. Measurable success and Mary's launch acceptance

**Product success:** Two supported app integrations, at least one actually verified mainnet receipt per supported app, one correctly verified and on-chain-published review, and publicly readable review records. To assess real value, track outbound visits, verification pass/fail by reason, completed publications and specific actionable feedback received by builders.

**Mary's separate criterion:** ≥3 distinct genuine wallets and ≥5 valid Trail **review-publication** transactions within seven days of Trail's live launch. A viable legitimate pattern is three reviewers each using two independently supported apps and publishing one honest review per app; that would allow up to six distinct reviews with real underlying activity. This is **a scenario**, not a plan to manufacture reviews. Request Mary's explicit confirmation of what she counts for an on-chain review product.

Mary's other checks apply independently: Trail X account with at least five posts in the preceding 30 days, explicit project-authored **"Trail has officially launched on BOT Chain mainnet"** announcement after it genuinely launches, working site with official BOT Chain links, usable app, distinct implementation/operations, ongoing availability and activity.

**Evidence bundle:** list of eligible projects and exact verified action schemas, Trail registry deployment/verification, underlying verified actions, real `ReviewPublished` transactions, reviewer consent, website, X posts, uptime records and reviewer feedback. Do not fabricate reviews, comments, transaction histories or participating wallets.

## 6. Non-goals and phase 2

**Not before Nov 13:** automated universal EVM contract verification; GitHub-wide or cross-chain reviews; tokens/rewards/quests; financial product endorsements; AI summaries; sophisticated ranking/reputation systems; audit badges; review editing or infinite revisions; anonymous testimony authenticated by a mere tx hash.

**Post-launch candidates:** more verified integrations, transparent moderation appeals, self-service project application with human approval, optional unaudited/failed-action reports labeled separately, builder analytics and structured feedback labels.

## 7. Dependencies and risk decisions

- **Biggest dependency:** two real BOT Chain applications with *auditable, low-friction and valid* eligible action proofs. Researching names is insufficient; implement action-specific verification from real transaction logs before marking a project "supported."
- **Trust boundary:** server attests that a proof passed an allowlist. Registry cannot independently validate arbitrary historic receipts on-chain; clearly disclose this limitation.
- **Operational dependency:** verification-signing key (non-custodial) and public metadata database; compromised signer or unavailable backend can delay new review publishing.
- **Contract dependency:** short-lived EIP-712 authorizations, author/proof uniqueness and content hash commitment.
- **Open items:** final UX copy, two verified pilot projects, exact status of third-party project permission, host/domain/X handles, Mary's count ruling.

## 8. P0 release acceptance

- [ ] Two pilot projects each have documented **actual mainnet tx** demonstrating validation logic.
- [ ] Unknown/wrong-wallet/reverted/reused txs are rejected automatically.
- [ ] Valid reviewer gets a short-lived authorization and creates on-chain review; proof can't be reused.
- [ ] Actual human review text stored and hash checked on display; malicious HTML doesn't execute.
- [ ] Public app and review routes work on mobile; listing outbound links are verified official URLs.
- [ ] Registry contract verified on BOTScan; independent X + site + footer + launch proof available.
- [ ] Clear user disclosure: Trail proves a supported action occurred; it does not endorse the dApp.

**References:** [BOT Chain developer guide](https://dev-docs.botchain.ai/docs/Developers/quick-guide/), [official explorer](https://scan.botchain.ai), [viem receipt and logs](https://viem.sh/docs/actions/public/getTransactionReceipt). Source concept was TRIED; locked name is Trail.
