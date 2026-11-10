import Link from "next/link";
import { Container, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-20">
      <EmptyState title="We could not find that page" action={<Link href="/discover" className="btn btn-primary">Discover apps</Link>}>
        The link may be wrong, or the review or app is not published.
      </EmptyState>
    </Container>
  );
}
