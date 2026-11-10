import type { Metadata } from "next";
import { Container, PageHead } from "@/components/ui";
import { PRIOR_MEAN, PRIOR_WEIGHT, RANK_THRESHOLD } from "@/lib/ranking";
import { VERIFICATION_LIMITS } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Trail verifies proof, ranks apps, assesses review quality, and what the evidence cannot show.",
};

const checks = [
  "The transaction exists on BOT Chain (chain 677) and succeeded.",
  "It was sent by the wallet you signed in with.",
  "It called the approved contract and function for that app's supported action.",
  "It produced the expected on-chain result, and has enough confirmations.",
  "The transaction has not already backed another review, and your wallet has not reviewed this app.",
];

export default function MethodologyPage() {
  return (
    <>
      <PageHead eyebrow="Methodology" title="How Trail decides what to trust">
        Plain rules, published up front, so you can judge the evidence yourself.
      </PageHead>
      <Container className="max-w-[820px] space-y-6 pb-8">
        <section className="card" aria-labelledby="p-h">
          <h2 id="p-h" className="text-[22px] font-semibold">Proof verification</h2>
          <p className="muted mt-3">Before you can review, Trail checks the chain itself, not your word.</p>
          <ul className="muted mt-4 list-disc space-y-2 pl-5">{checks.map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="muted mt-4">Signing in is an off-chain signature that proves you control the wallet. It publishes nothing and costs no gas. Publishing a review is a separate on-chain transaction you approve.</p>
        </section>
        <section className="card" aria-labelledby="r-h">
          <h2 id="r-h" className="text-[22px] font-semibold">Ranking</h2>
          <p className="muted mt-3">
            Community score = (n × average + {PRIOR_WEIGHT} × {PRIOR_MEAN}) / (n + {PRIOR_WEIGHT}), a Bayesian average
            that starts from a neutral {PRIOR_MEAN} out of 5. Apps need at least {RANK_THRESHOLD} distinct reviewer wallets to be
            ranked. Fewer than that is shown as early feedback. Reward amounts and quality scores never enter the formula.
          </p>
        </section>
        <section className="card" aria-labelledby="q-h">
          <h2 id="q-h" className="text-[22px] font-semibold">Review quality</h2>
          <p className="muted mt-3">
            For rewards only, a person scores each review on five dimensions from 0 to 2: specificity, outcome clarity,
            helpfulness, originality and actionability. 7 out of 10 approves. This is independent of the 1 to 5 app rating,
            so a detailed one-star review can score full marks.
          </p>
        </section>
        <section className="card" aria-labelledby="l-h">
          <h2 id="l-h" className="text-[22px] font-semibold">Limitations</h2>
          <p className="muted mt-3">{VERIFICATION_LIMITS}</p>
          <p className="muted mt-3">Version 1 proof requires a successful supported action, so people who could not complete the action are not represented yet.</p>
        </section>
      </Container>
    </>
  );
}
