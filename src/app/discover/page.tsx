import type { Metadata } from "next";
import Link from "next/link";
import { Container, EmptyState, PageHead, ProjectTile, Unavailable, safeHttp } from "@/components/ui";
import { loadProjects } from "@/lib/server-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Discover BOT Chain apps",
  description: "Browse BOT Chain apps with verified-action reviews, categories, and the actions that unlock a review.",
};

export default async function DiscoverPage() {
  const res = await loadProjects();
  const projects = res.state === "ok" ? res.data.projects : [];
  const categories = Array.from(new Set(projects.map((p) => p.category).filter(Boolean))) as string[];

  return (
    <>
      <PageHead eyebrow="Discover" title="Apps on BOT Chain">
        Every app here has a supported action Trail can verify on-chain. Reviews only come from wallets that completed it.
      </PageHead>
      <Container>
        {categories.length > 0 && (
          <ul className="mb-8 flex flex-wrap gap-2" aria-label="Categories">
            {categories.map((c) => (
              <li key={c} className="badge">{c}</li>
            ))}
          </ul>
        )}
        {res.state === "unavailable" && <Unavailable what="The app list" />}
        {res.state === "ok" && projects.length === 0 && (
          <EmptyState title="No apps are open for review yet">Supported apps appear here once Trail can verify their action.</EmptyState>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const site = safeHttp(p.officialUrl);
            return (
              <article key={p.id} className="card flex flex-col">
                <Link href={`/apps/${p.slug}`} className="block">
                  <ProjectTile name={p.name} />
                  <h2 className="mt-5 text-[22px] font-semibold">{p.name}</h2>
                </Link>
                {p.category && <p className="mt-1 text-xs text-[var(--n400)]">{p.category}</p>}
                <p className="muted mt-3 text-[15px]">{p.description ?? "Supported BOT Chain app."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="badge badge-ok">Verified action</span>
                  <span className="badge">
                    {p.publishedReviews} verified {p.publishedReviews === 1 ? "review" : "reviews"}
                  </span>
                </div>
                {p.supportedAction && (
                  <p className="mt-3 text-xs text-[var(--n400)]">Supported action version {p.supportedAction.version}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
                  <Link href={`/apps/${p.slug}`} className="btn btn-ghost">View profile</Link>
                  {site && (
                    <a href={site} target="_blank" rel="noopener noreferrer" className="btn btn-link">
                      Official site<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </>
  );
}
