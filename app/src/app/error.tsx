"use client";

// Root error boundary - catches unhandled errors thrown by any route segment
// under the root layout and renders a calm, on-brand recovery surface INSTEAD
// of Next.js's default error chrome (which can leak raw exception text in dev
// and a stark "Application error" page in prod).
//
// CRITICAL: this NEVER renders `error.message`, `error.digest`, or a stack
// trace in the DOM - those are developer-only signals. The user gets a quiet
// Fraunces one-liner + a "Try again" button (calls `reset()` to re-render the
// errored segment). The error is logged to the console for the operator.
//
// Must be a Client Component (Next 16 error boundaries are client-side).

import * as React from "react";
import { WarningCircle } from "@phosphor-icons/react";

import { Button, Card } from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Operator-side only - never surfaced to the user.
    console.error("Unhandled route error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-16 md:px-10 md:py-24 lg:px-16">
      <Card>
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span
            aria-hidden
            className="inline-flex size-12 items-center justify-center rounded-full bg-gold/[0.06] text-gold/85 ring-1 ring-gold/20 [&_svg]:size-6"
          >
            <WarningCircle weight="light" />
          </span>
          <Eyebrow dot>Something broke</Eyebrow>
          <p className="text-[clamp(1.4rem,1.1rem+0.9vw,1.8rem)] font-light leading-tight tracking-[-0.01em] text-foreground">
            That page hit an unexpected error.
          </p>
          <p className="max-w-sm text-[13px] leading-[1.55] text-muted-foreground">
            Your data is safe. Try loading the page again - if the problem
            persists, the desk has been notified.
          </p>
          <div className="mt-1.5">
            <Button
              type="button"
              variant="primary-gold"
              size="md"
              onClick={() => reset()}
            >
              Try again
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}