import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHead, Stars, Unavailable } from "@/components/ui";
import { loadRankings } from "@/lib/server-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Rankings",
  description: "Community scores for BOT Chain apps, computed from verified-action reviews with a transparent method.",
};

export default async function RankingsPage() {
  const res = await loadRankings();
  const data = res.state === "ok" ? res.data : null;

  return (
    <>
      <PageHead eyebrow="Rankings" title="How apps are doing">
        Scores come only from published, verified-action reviews. Apps with too little feedback are labelled early, never ranked.
      </PageHead>
      <Container>
        {res.state === "unavailable" && <Unavailable what="Rankings" />}
        {data && data.rankings.length === 0 && (
          <EmptyState title="Nothing to rank yet">No supported apps are available.</EmptyState>
        )}
        <div className="space-y-6">
          {data?.rankings.map((r) => {
            const max = Math.max(1, ...Object.values(r.distribution));
            return (
              <section key={r.projectId} className="card" aria-labelledby={`rk-${r.projectId}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="grid h-10 min-w-10 place-items-center rounded-full bg-[var(--n800)] px-3 font-display text-sm">
                    {r.rank ? `#${r.rank}` : "Early"}
                  </span>
                  <h2 id={`rk-${r.projectId}`} className="text-[22px] font-semibold">
                    {r.project ? <Link href={`/apps/${r.project.slug}`} className="hover:underline">{r.project.name}</Link> : `Project ${r.projectId}`}
                  </h2>
                  <span className={`badge ${r.status === "ranked" ? "badge-ok" : "badge-warn"}`}>
                    {r.status === "ranked" ? "Ranked" : "Early feedback"}
                  </span>
                </div>
                {r.wallets === 0 ? (
                  <p className="muted mt-4 text-sm">No published reviews yet. No score or rank is shown.</p>
                ) : (
                  <div className="mt-5 grid gap-6 md:grid-cols-2">
                    <div>
                      {r.averageRating !== null && (
                        <div className="flex items-center gap-3">
                          <Stars value={r.averageRating} />
                          <span className="font-display text-2xl">{r.averageRating.toFixed(1)}</span>
                        </div>
                      )}
                      <p className="muted mt-2 text-sm">
                        {r.wallets} distinct reviewer {r.wallets === 1 ? "wallet" : "wallets"}.{" "}
                        {r.score !== null ? `Community score ${r.score.toFixed(2)}.` : "Needs 3 wallets for a community score."}
                      </p>
                      <p className="muted mt-1 text-sm">{r.workedWell} worked well, {r.withFriction} worked with friction.</p>
                    </div>
                    <div role="group" aria-label="Rating distribution">
                      {[5, 4, 3, 2, 1].map((s) => (
                        <div key={s} className="flex items-center gap-3 py-0.5 text-xs">
                          <span className="w-8 text-[var(--n400)]">{s} star</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--n800)]">
                            <div className="h-full rounded-full bg-white" style={{ width: `${((r.distribution[String(s)] ?? 0) / max) * 100}%` }} />
                          </div>
                          <span className="w-5 text-right text-[var(--n200)]">{r.distribution[String(s)] ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        {data && (
          <section className="card mt-10" aria-labelledby="meth-h">
            <h2 id="meth-h" className="text-[20px] font-semibold">Methodology</h2>
            <p className="muted mt-3 text-sm">{data.methodology}</p>
            <p className="muted mt-3 text-sm">{data.limitations}</p>
            <Link href="/methodology" className="btn btn-link mt-2 px-0">Read the full method</Link>
          </section>
        )}
      </Container>
    </>
  );
}
