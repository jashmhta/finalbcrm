"use client";

// Global error boundary - the LAST-RESORT boundary that catches errors thrown
// by the ROOT LAYOUT itself (Next 16). It replaces the root layout entirely
// while active, so it must render its own <html>/<body> + import the global
// styles (the layout's globals.css import is bypassed here).
//
// CRITICAL: never renders `error.message` / `error.digest` / a stack trace -
// those are operator-only. The user gets a calm message + a "Try again" button
// (reset()). Kept dependency-free (no brand components, no phosphor) so a
// failure inside the brand layer or the phosphor client boundary can't take
// this fallback down with it.

import * as React from "react";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Operator-side only - never surfaced to the user.
    console.error("Global layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="relative min-h-[100dvh] bg-background text-foreground antialiased">
        <div
          aria-hidden
          className="bg-mesh pointer-events-none fixed inset-0 -z-20"
        />
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[640px] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
          <span
            aria-hidden
            className="inline-flex size-12 items-center justify-center rounded-full bg-gold/[0.06] text-gold/85 ring-1 ring-gold/20"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 8v5M12 16.5v.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Something broke
            </p>
            <p className="text-[clamp(1.4rem,1.1rem+0.9vw,1.8rem)] font-light leading-tight tracking-[-0.01em] text-foreground">
              The application hit an unexpected error.
            </p>
            <p className="mx-auto max-w-sm text-[13px] leading-[1.55] text-muted-foreground">
              Your data is safe. Try loading the page again - if the problem
              persists, the desk has been notified.
            </p>
          </div>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2.5 text-[13.5px] font-medium text-on-gold shadow-pill transition-transform duration-200 ease-soft active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}