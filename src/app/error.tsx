"use client";

import { Banner, Container } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="py-20">
      <Banner tone="error" title="Something went wrong" action={<button className="btn btn-primary" onClick={reset}>Try again</button>}>
        This page hit an unexpected problem. Your wallet and funds are not affected.
      </Banner>
    </Container>
  );
}
