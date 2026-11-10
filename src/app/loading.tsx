import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-16" >
      <div role="status" aria-label="Loading" className="space-y-4">
        <div className="skeleton h-10 w-2/3" />
        <div className="skeleton h-5 w-1/2" />
        <div className="grid gap-6 pt-6 md:grid-cols-3">
          <div className="skeleton h-48" /><div className="skeleton h-48" /><div className="skeleton h-48" />
        </div>
      </div>
    </Container>
  );
}
