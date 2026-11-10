import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, EmptyState, ExtLink, ProjectTile, ReviewCard, Stars, Unavailable, safeHttp } from "@/components/ui";
import { explorerAddress, shortHash } from "@/lib/client/chain677";
import { loadProject, loadRankings } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await loadProject(slug);
  if (res.state !== "ok") return { title: "App" };
  return {
    title: `${res.data.project.name} reviews`,
    description: `Verified-action reviews of ${res.data.project.name} on BOT Chain.`,
  };
}

export default async function AppPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await loadProject(slug);
  if (res.state === "not_found") notFound();
  if (res.state === "unavailable") {
    return <Container className="py-16"><Unavailable what="This app profile" /></Container>;
  }
  const { project, action, reviews, verificationLimits } = res.data;
  const site = safeHttp(project.officialUrl);
  const ranks = await loadRankings();
  const rank = ranks.state === "ok" ? ranks.data.rankings.find((r) => r.projectId === project.id) : undefined;

  return (
    <Container className="pt-12 md:pt-16">
      <div className="flex flex-col gap-6 md:flex-row md:items-center">
        <ProjectTile name={project.name} size={80} />
        <div className="flex-1">
          <h1 className="text-[32px] leading-[1.1] md:text-5xl">{project.name}</h1>
          {project.category && <p className="muted mt-1 text-sm">{project.category}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/review/${project.slug}`} className="btn btn-primary">Write a review</Link>
          {site && (
            <a href={site} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              Official site<span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </div>
      </div>
      <p className="muted mt-6 max-w-2xl text-[17px]">{project.description ?? "Supported BOT Chain app."}</p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section aria-labelledby="reviews-h">
          <h2 id="reviews-h" className="text-[24px]">
            Reviews <span className="muted text-base">({reviews.length})</span>
          </h2>
          <div className="mt-5 space-y-5">
            {reviews.length === 0 ? (
              <EmptyState
                title="No verified reviews yet"
                action={<Link href={`/review/${project.slug}`} className="btn btn-primary">Become the first reviewer</Link>}
              >
                Nothing is rated or ranked yet. {action
                  ? "Anyone whose wallet completed the supported action below can publish the first review."
                  : "This app has no enabled action right now."}
              </EmptyState>
            ) : (
              reviews.map((r) => <ReviewCard key={r.id} r={r} />)
            )}
          </div>
        </section>

        <aside className="space-y-6" aria-label="App details">
          <div className="card">
            <h2 className="text-[20px] font-semibold">Reviewer score</h2>
            {rank && rank.status === "ranked" && rank.averageRating !== null ? (
              <div className="mt-3">
                <div className="flex items-center gap-3">
                  <Stars value={rank.averageRating} />
                  <span className="font-display text-2xl">{rank.averageRating.toFixed(1)}</span>
                </div>
                <p className="muted mt-2 text-sm">
                  From {rank.wallets} distinct reviewer wallets. Community score {rank.score?.toFixed(2)} (rank #{rank.rank}).
                </p>
              </div>
            ) : (
              <p className="muted mt-3 text-sm">
                {rank && rank.wallets > 0
                  ? `Early feedback from ${rank.wallets} ${rank.wallets === 1 ? "wallet" : "wallets"}. A score appears after 3 distinct reviewer wallets.`
                  : "No score yet. A score appears after 3 distinct reviewer wallets have published."}
              </p>
            )}
            <Link href="/methodology" className="btn btn-link mt-2 px-0">How scores work</Link>
          </div>

          <div className="card">
            <h2 className="text-[20px] font-semibold">Supported action</h2>
            {action ? (
              <>
                <p className="muted mt-3 text-sm">
                  To review {project.name}, complete this action on BOT Chain with your wallet, then prove it by pasting its transaction hash.
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-[var(--n400)]">Contract</dt>
                    <dd className="mt-1 font-mono">
                      <ExtLink href={explorerAddress(action.approvedTarget)}>{shortHash(action.approvedTarget, 8)}</ExtLink>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--n400)]">Function</dt>
                    <dd className="mt-1 font-mono">{action.functionSelector} (v{action.version})</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="muted mt-3 text-sm">No supported action is enabled right now.</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-[20px] font-semibold">What this evidence means</h2>
            <p className="muted mt-3 text-sm">{verificationLimits}</p>
          </div>
        </aside>
      </div>
    </Container>
  );
}
