import Link from "next/link";

import { Button, Card } from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";
import { Question } from "@/components/brand/icons";

// Root 404 - a calm, on-brand "not found" surface instead of Next.js's default
// stark 404. Server component (no hooks); renders within the root layout so the
// brand fonts + globals apply. Never leaks error/stack text (there is none
// here - a 404 is a routing outcome, not an exception).
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-16 md:px-10 md:py-24 lg:px-16">
      <Card>
        <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span
            aria-hidden
            className="inline-flex size-12 items-center justify-center rounded-full bg-foreground/[0.03] text-muted-foreground/75 ring-1 ring-hairline [&_svg]:size-6"
          >
            <Question weight="light" />
          </span>
          <Eyebrow dot>Not found</Eyebrow>
          <p className="text-[clamp(1.4rem,1.1rem+0.9vw,1.8rem)] font-light leading-tight tracking-[-0.01em] text-foreground">
            This page isn&rsquo;t here.
          </p>
          <p className="max-w-sm text-[13px] leading-[1.55] text-muted-foreground">
            The link may be old, or the record may have been removed. Head back
            to the command center to pick up where you left off.
          </p>
          <div className="mt-1.5">
            <Button asChild variant="primary-gold" size="md">
              <Link href="/">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
