import { cn } from "@/console/lib/cn";

type Tone = "neutral" | "accent" | "ok" | "warn" | "bad" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--c-surface-2)] text-[var(--c-ink-2)]",
  accent: "bg-[var(--c-accent-soft)] text-[var(--c-accent)]",
  ok: "bg-[var(--c-ok-bg)] text-[var(--c-ok)]",
  warn: "bg-[var(--c-warn-bg)] text-[var(--c-warn)]",
  bad: "bg-[var(--c-bad-bg)] text-[var(--c-bad)]",
  info: "bg-[var(--c-info-bg)] text-[var(--c-info)]",
};

export function CBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
