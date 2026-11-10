import Link from "next/link";
import OrbitHero from "@/components/OrbitHero";
import { Container, EmptyState, ProjectTile, Unavailable } from "@/components/ui";
import { loadProjects } from "@/lib/server-data";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "1", t: "Use an app", d: "Do a supported action on BOT Chain with your own wallet." },
  { n: "2", t: "Prove it", d: "Paste the transaction. Trail checks the chain and confirms it was you." },
  { n: "3", t: "Write it up", d: "Share 100 to 700 characters about how it really went, good or bad." },
  { n: "4", t: "Publish on-chain", d: "Sign once. Your review gets a public receipt anyone can check." },
];

export default async function Home() {
  const projects = await loadProjects();
  const apps = projects.state === "ok" ? projects.data.projects : [];

  return (
    <>
      <section className="stage relative isolate flex min-h-[calc(100svh-64px)] items-center justify-center overflow-hidden">
        <OrbitHero apps={apps.map((p) => ({ name: p.name, href: `/apps/${p.slug}` }))} />
        <div className="relative z-10 mx-auto flex max-w-[460px] flex-col items-center px-6 pb-8 text-center" style={{ marginTop: "-4vh" }}>
          <h1 className="text-[32px] leading-[1.1] md:text-5xl">Reviews from people who actually used it</h1>
          <p className="mt-3 max-w-[440px] text-[17px] leading-[1.55] text-[var(--n400)]">
            Find BOT Chain apps through firsthand reviews, each backed by proof the reviewer did the real thing.
          </p>
          <Link href="/discover" className="btn btn-primary mt-6 w-full max-w-[320px] md:w-auto">
            Discover apps
          </Link>
          <Link href="/methodology" className="btn btn-link mt-4">
            How verification works
          </Link>
        </div>
      </section>

      <Container className="pt-24">
        <h2 className="text-[28px] md:text-4xl">Apps you can review today</h2>
        <p className="muted mt-3 max-w-xl">Only apps with a verified supported action appear here. More arrive as support is added.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.state === "unavailable" && <div className="md:col-span-3"><Unavailable what="The app list" /></div>}
          {projects.state === "ok" && apps.length === 0 && (
            <div className="md:col-span-3">
              <EmptyState title="No apps are open for review yet">Supported apps will appear here as soon as they are verified.</EmptyState>
            </div>
          )}
          {apps.map((p) => (
            <Link key={p.id} href={`/apps/${p.slug}`} className="card block">
              <ProjectTile name={p.name} />
              <h3 className="mt-5 text-[22px] font-semibold">{p.name}</h3>
              <p className="muted mt-2 line-clamp-2 text-[15px]">{p.description ?? "Supported BOT Chain app."}</p>
              <p className="mt-4 text-xs text-[var(--n400)]">
                {p.publishedReviews === 0 ? "No reviews yet. Be the first." : `${p.publishedReviews} verified ${p.publishedReviews === 1 ? "review" : "reviews"}`}
              </p>
            </Link>
          ))}
        </div>
      </Container>

      <Container className="pt-24">
        <h2 className="text-[28px] md:text-4xl">How a verified review works</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="card">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--n800)] font-display text-sm font-semibold">{s.n}</span>
              <h3 className="mt-4 text-[20px] font-semibold">{s.t}</h3>
              <p className="muted mt-2 text-[15px]">{s.d}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link href="/discover" className="btn btn-primary">Start exploring</Link>
        </div>
      </Container>
    </>
  );
}
