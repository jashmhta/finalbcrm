import { cn } from "@/console/lib/cn";

export function CPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-5 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--c-ink-3)] md:text-[11px]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-balance text-[1.35rem] font-semibold tracking-tight text-[var(--c-ink)] md:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-xl text-[13px] leading-relaxed text-[var(--c-ink-2)] md:text-[14px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap gap-2 md:w-auto">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
