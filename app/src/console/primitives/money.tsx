import { formatCrorePlain, formatInrPlain } from "@/lib/money";
import { cn } from "@/console/lib/cn";

export function CMoney({
  crores,
  inr,
  className,
  compact = true,
}: {
  crores?: number | null;
  inr?: number | null;
  className?: string;
  compact?: boolean;
}) {
  let text = "—";
  if (crores != null && Number.isFinite(crores)) {
    text = formatCrorePlain(crores);
  } else if (inr != null && Number.isFinite(inr)) {
    text = formatInrPlain(inr, { compact });
  }
  return (
    <span
      className={cn(
        "font-mono tabular-nums tracking-tight text-[var(--c-ink)]",
        className,
      )}
    >
      {text}
    </span>
  );
}
