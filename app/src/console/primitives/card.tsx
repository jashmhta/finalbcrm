import { cn } from "@/console/lib/cn";

export function CCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={cn(
        "rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-4 shadow-[var(--c-shadow)] ring-1 ring-[var(--c-line)]",
        "md:p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CKpi({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
}) {
  return (
    <CCard className="flex min-h-[96px] flex-col justify-between gap-1.5 p-3 md:min-h-[104px] md:gap-2 md:p-5">
      <p className="text-[11px] font-medium text-[var(--c-ink-2)] md:text-[12px]">
        {label}
      </p>
      <div className="min-w-0">
        <p className="c-kpi-value font-semibold tracking-tight text-[var(--c-ink)] text-[1.5rem] tabular-nums leading-none md:text-[1.75rem]">
          {value}
        </p>
        {delta ? (
          <p className="mt-1 truncate text-[11px] text-[var(--c-ink-3)] md:mt-1.5 md:text-[12px]">
            {delta}
          </p>
        ) : null}
        {hint ? (
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--c-ink-3)] md:mt-1 md:text-[11px]">
            {hint}
          </p>
        ) : null}
      </div>
    </CCard>
  );
}
