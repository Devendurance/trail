import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, EvidenceBadge, ExtLink, Stars, TxLink, Unavailable } from "@/components/ui";
import { explorerAddress } from "@/lib/client/chain677";
import { OUTCOME_LABELS, REWARD_STATE_LABELS } from "@/lib/client/states";
import { loadReview } from "@/lib/server-data";

export const dynamic = "force-dynamic";

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = parseId((await params).id);
  if (!id) return { title: "Review" };
  const res = await loadReview(id);
  if (res.state !== "ok") return { title: "Review" };
  const { review, project } = res.data;
  return {
    title: `${review.rating}/5 review of ${project?.name ?? "a BOT Chain app"}`,
    description: review.body.slice(0, 160),
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) notFound();
  const res = await loadReview(id);
  if (res.state === "not_found") notFound();
  if (res.state === "unavailable") return <Container className="py-16"><Unavailable what="This review" /></Container>;
  const { review: r, project, verificationLimits } = res.data;

  return (
    <Container className="max-w-[820px] pt-12 md:pt-16">
      <p className="text-sm text-[var(--n400)]">
        {project ? <Link href={`/apps/${project.slug}`} className="underline underline-offset-4 hover:text-white">{project.name}</Link> : "BOT Chain app"}
        {" / Review"}
      </p>
      <h1 className="mt-3 text-[32px] leading-[1.1] md:text-4xl">Review of {project?.name ?? "a BOT Chain app"}</h1>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Stars value={r.rating} />
        <span className="font-display text-xl">{r.rating}/5</span>
        <span className="badge">{OUTCOME_LABELS[r.outcome] ?? "Outcome unknown"}</span>
        <EvidenceBadge />
      </div>

      <article className="card mt-8">
        <p className="whitespace-pre-wrap break-words text-[17px] leading-relaxed">{r.body}</p>
      </article>

      <section className="card mt-6" aria-labelledby="evidence-h">
        <h2 id="evidence-h" className="text-[20px] font-semibold">Evidence</h2>
        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs text-[var(--n400)]">Reviewer wallet</dt>
            <dd className="mt-1 break-all font-mono text-sm">
              <ExtLink href={explorerAddress(r.reviewer)}>{r.reviewer}</ExtLink>
            </dd>
          </div>
          <TxLink hash={r.proofTxHash} label="Original app action" />
          {r.reviewTxHash && <TxLink hash={r.reviewTxHash} label="Review published on-chain" />}
          <div>
            <dt className="text-xs text-[var(--n400)]">Published</dt>
            <dd className="mt-1 text-sm"><time dateTime={r.publishedAt}>{new Date(r.publishedAt).toISOString().replace("T", " ").slice(0, 16)} UTC</time></dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--n400)]">Reward quality assessment</dt>
            <dd className="mt-1 text-sm">{REWARD_STATE_LABELS[r.rewardState] ?? r.rewardState}</dd>
          </div>
        </dl>
        <p className="muted mt-6 text-sm">{verificationLimits}</p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        {project && <Link href={`/apps/${project.slug}`} className="btn btn-ghost">More about {project.name}</Link>}
        {project && <Link href={`/review/${project.slug}`} className="btn btn-primary">Write your own review</Link>}
      </div>
    </Container>
  );
}
