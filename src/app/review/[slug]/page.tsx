import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewFlow from "@/components/ReviewFlow";
import { Container, PageHead, Unavailable } from "@/components/ui";
import { loadProject } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const res = await loadProject(slug);
  return {
    title: res.state === "ok" ? `Review ${res.data.project.name}` : "Write a review",
    description: "Prove your BOT Chain action, write an honest review, and publish it on-chain.",
  };
}

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const res = await loadProject(slug);
  if (res.state === "not_found") notFound();
  if (res.state === "unavailable") return <Container className="py-16"><Unavailable what="This app" /></Container>;
  const { project, action } = res.data;

  return (
    <>
      <PageHead eyebrow="Write a review" title={`Review ${project.name}`}>
        <Link href={`/apps/${project.slug}`} className="underline underline-offset-4 hover:text-white">Back to {project.name}</Link>
      </PageHead>
      <Container className="max-w-[820px]">
        {!action ? (
          <Unavailable what="Reviewing this app" />
        ) : (
          <ReviewFlow
            project={{ id: project.id, slug: project.slug, name: project.name }}
            actionDescription={null}
          />
        )}
      </Container>
    </>
  );
}
