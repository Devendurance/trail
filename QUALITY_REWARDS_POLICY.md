# Trail — Quality-First BOT Reviewer Rewards Policy

**Proposed policy v1.0, November 10, 2026**  
**Status:** Proposed design for implementation planning, **not yet an active funded reward program**. The project operator must explicitly set the amount, pool budget and start date before any UI claims rewards are claimable.

## Why reward reviewers at all?

Trail's reviews help people make better choices and give ecosystem builders constructive product feedback. Thorough reviewers spend time trying real features and writing useful experience reports. A small BOT thank-you can recognize that effort and attract engaged contributors. But the reward must be for **review usefulness**, not positivity, not the volume of on-chain activity, and not money spent in the reviewed DApp.

**Headline:** “Helpful reviews can earn BOT. Your rating doesn't affect reward eligibility.”

## Eligibility checks (all mandatory)

- Reviewer authenticated the wallet that performed a genuine supported BOT Chain action, with a validated real receipt.
- Exactly one Trail review per wallet/app, and a unique eligible proof tx is used once.
- Review has enough original detail to be genuinely useful to the next user (suggested 100–700 plain-text characters).
- Content is not copied, purchased, abusive, misleading or primarily promotional.
- Material relationship to an app (founder, team, affiliate) is disclosed; Trail can exclude conflicted/affiliated reviews from rewards or label them separately.
- Review has been on-chain published and can be independently verified.
- Budget exists and the reward program is explicitly open. No payment promise before that.

## Reviewer-quality rubric (10 points total)

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Specificity | Vague “nice app” | Mentions a feature | Describes the exact feature and context of use |
| Outcome clarity | No result | General outcome | Clear observed result and expectation |
| Helpful explanation | No detail | Some detail | Practical steps, UX feedback or constraints |
| Originality | Duplicated/spam | Limited original insight | Distinct first-person perspective |
| Actionability | No takeaway | Broad suggestion | Specific advice/bug/positive detail future users can act on |

**Suggested threshold:** 7/10 for quality reward review, subject to independent human moderation. A low rating can score 10/10 for review quality. A glowing low-detail review can score 1/10. Quality is not DApp rating, and quality scores never change public review ratings or ranking formula.

**Moderation:** A policy-grounded human reviewer makes the final approval. AI may flag potential spam or help sort the queue, but must not automatically pay. Record reason codes and moderation timestamps; provide an appeal route. Don't delete on-chain reviews when hiding abusive off-chain text; explain that the hash remains public.

## Rewards model and funding

**Fund first:** Deploy a separate `TrailRewards` vault only after contract tests, verification and a small funded-budget test. Administrator deposits BOT; the contract stores bounded, reviewer-specific allocations tied to published review IDs.

- Each `reviewId` can be rewarded **at most once**.
- `approveReward(reviewId, amountWei)` is allowed only for an authorized moderator/operator and only after checking the published author against registry `getReviewer(reviewId)`.
- The vault must prevent approving more reward liabilities than the available funded and unreserved balance.
- `claimReward(reviewId)` is callable only by that review's wallet, reduces the reserved balance and transfers BOT once; it must be non-reentrant and safe on failed recipient calls.
- Set a transparent per-review maximum and per-wallet program cap; cap the pool and stop new commitments when exhausted. The operator must manually choose the amount based on available funds; **no default BOT amount is promised here**.
- User pays gas for a V1 claim. Don't say rewards automatically cover gas or are gasless.
- The vault must not introduce owner powers to change review text, scores, or recipients.

**Reconciliation:** `quality_assessments` and `reward_allocations` track review submitted -> assessment -> (rejected/approved) -> funded/claimable -> claimed. UI should read claimable/payout from the vault when live, not only DB claims.

## Fairness and sybil-resistance

- One review per wallet/app is a **spam throttle, not proof of unique human identity**.
- Avoid rewarding rapid loops, self-review by project teams, coordinated copy-paste and accounts obviously controlled by a single operator. Apply manual review and transparent policy, and keep funding capped.
- Do not pay extra for larger swaps, higher gas consumption, multiple low-value transactions, favorable ratings or five-star average.
- Allow honest negative reports to qualify. Publish counts of rewarded positive versus negative reviews as transparency data when meaningful.
- For ranking, exclude the payout amount and quality score; rank only community ratings from eligible published reviews with a minimum-sample warning.
- Once a reward is granted under a published program, don't silently rescind it through hidden policy changes; document amendments and appeal steps.

## Mary's KPI and integrity

A review-publication tx is the Trail product's core action. Reward funding/approval/claim are **secondary operational or incentive actions**, not evidence that another DApp was actually reviewed, and shouldn't be counted toward 5 eligible core interactions. Confirm in writing with Mary whether compensated quality reviews remain eligible under the rules. No manufactured wallets, sham reviews, fake action receipts or wash swaps.

## Feature launch flags

- `REWARDS_PROGRAM_VISIBLE`: show explanation and current status, **not** guaranteed earnings.
- `REWARDS_ACCEPTING_SUBMISSIONS`: allow published reviews to enter the quality queue.
- `REWARDS_CLAIM_ENABLED`: only true after the funded/verified reward vault exists, tests pass, operator caps set and a small-value real claim succeeded.

No frontend should display **“cashback available,” “you earned X BOT,” or “claim now”** solely because the text passed a local quality heuristic. Only show claimable amounts confirmed by an allocation in the funded live vault.

## Reward vault test checklist

- [ ] Cannot allocate to nonexistent or unpublished review.
- [ ] Allocation recipient equals `TrailReviewRegistry.getReviewer(reviewId)`.
- [ ] Cannot allocate twice to same review or exceed available/unreserved pool.
- [ ] Cannot claim from another wallet or claim twice.
- [ ] Reverting recipient transfer doesn't destroy allocation.
- [ ] Reentrancy attempts fail, no accounting mismatch.
- [ ] Admin can pause new allocations in incident; existing liabilities handled transparently.
- [ ] BOT pool balance, reserved liabilities and unallocated funds reconcile.
- [ ] No public reward claim without real small-value mainnet test and a verified contract.
