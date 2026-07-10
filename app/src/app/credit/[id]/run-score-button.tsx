"use client";

import * as React from "react";
import { useTransition } from "react";
import { Sparkle, CheckCircle, Warning } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/brand";
import { runRatiosAndScore, type RunRatiosState } from "@/features/credit/actions";

/**
 * Triggers the ratio + scorecard recompute server action. The action takes a
 * single analysisId argument (no FormData), so it is invoked directly inside
 * a transition. Surfaces the resulting score/band or error inline.
 */
export function RunScoreButton({
  analysisId,
  variant = "primary-gold",
  size = "md",
  className,
}: {
  analysisId: string;
  variant?: "primary-emerald" | "primary-gold" | "secondary-hairline";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = React.useState<RunRatiosState>(undefined);

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={isPending}
        leadingIcon={<Sparkle weight="light" className="size-4" />}
        onClick={() => {
          startTransition(async () => {
            const r = await runRatiosAndScore(analysisId);
            setResult(r);
          });
        }}
      >
        {isPending ? "Running…" : "Run ratios + score"}
      </Button>
      {result && "error" in result && result.error ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-down">
          <Warning weight="light" className="size-4" />
          {result.error}
        </span>
      ) : null}
      {result && "ok" in result && result.ok ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-gold" role="status" aria-live="polite">
          <CheckCircle weight="light" className="size-4" />
          Scored{" "}
          <span className="nums tabular-nums font-medium">
            {typeof result.score === "number" && Number.isFinite(result.score)
              ? result.score.toFixed(1)
              : "-"}
          </span>{" "}
          → {result.band ?? "-"}
        </span>
      ) : null}
    </div>
  );
}