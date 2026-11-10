import type { Metadata } from "next";
import { Banner, Container, PageHead, Unavailable } from "@/components/ui";
import { loadRewards } from "@/lib/server-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rewards",
  description: "How helpful reviews can earn BOT, the eligibility policy, and the current status of the program.",
};

const RUBRIC = ["Specificity", "Outcome clarity", "Helpfulness", "Originality", "Actionability"];

export default async function RewardsPage() {
  const res = await loadRewards();
  const d = res.state === "ok" ? res.data : null;
  const live = d ? d.program.funded && d.program.claimEnabled : false;

  return (
    <>
      <PageHead eyebrow="Rewards" title="Helpful reviews can earn BOT">
        Your rating does not affect reward eligibility. Honest negative feedback is as welcome as praise.
      </PageHead>
      <Container className="space-y-6">
        {res.state === "unavailable" && <Unavailable what="Program status" />}
        {d && (
          <Banner tone={live ? "ok" : "info"} title={live ? "Rewards are open" : "The rewards program is not open yet"}>
            {live
              ? "Approved reviews can be claimed."
              : "There is no funded reward pool and claiming is disabled. No BOT amount is promised, and nothing is claimable today."}
          </Banner>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="card">
            <p className="text-xs text-[var(--n400)]">Program funding</p>
            <p className="mt-2 font-display text-2xl">{d ? (d.program.funded ? "Funded" : "Not funded") : "Unknown"}</p>
          </div>
          <div className="card">
            <p className="text-xs text-[var(--n400)]">Claiming</p>
            <p className="mt-2 font-display text-2xl">{d ? (d.program.claimEnabled && d.program.claimable ? "Enabled" : "Disabled") : "Unknown"}</p>
          </div>
          <div className="card">
            <p className="text-xs text-[var(--n400)]">Published reviews</p>
            <p className="mt-2 font-display text-2xl">{d ? d.counts.publishedReviews : "–"}</p>
          </div>
        </div>

        <section className="card" aria-labelledby="how-h">
          <h2 id="how-h" className="text-[22px] font-semibold">How it will work</h2>
          <ol className="muted mt-4 list-decimal space-y-2 pl-5 text-[15px]">
            <li>You publish a verified review.</li>
            <li>A person scores its quality, separate from your DApp rating.</li>
            <li>Reviews scoring 7 out of 10 or more are approved.</li>
            <li>Approved reviews can be paid in BOT when the program is funded and open. Rewards are subject to approval and available funding.</li>
          </ol>
        </section>

        <section className="card" aria-labelledby="elig-h">
          <h2 id="elig-h" className="text-[22px] font-semibold">Eligibility policy</h2>
          <ul className="muted mt-4 list-disc space-y-2 pl-5 text-[15px]">
            <li>The authenticated wallet performed a real supported BOT Chain action.</li>
            <li>One review per wallet per app, and each proof transaction is used once.</li>
            <li>The review is original, specific, and 100 to 700 characters.</li>
            <li>It is not copied, purchased, abusive, misleading, or mainly promotional.</li>
            <li>Any relationship with the app (founder, team, affiliate) is disclosed. Conflicted reviews may be excluded or labelled.</li>
            <li>It is published on-chain and independently verifiable.</li>
          </ul>
          <h3 className="mt-6 text-[17px] font-semibold">Quality rubric</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {RUBRIC.map((x) => <li key={x} className="badge">{x} 0 to 2</li>)}
          </ul>
        </section>
      </Container>
    </>
  );
}
