import { MagnifyingGlass } from "@phosphor-icons/react/ssr";

/**
 * Server-friendly GET search form for list / board pages.
 * Preserves extra query params via hidden fields when needed.
 */
export function ListSearch({
  action,
  q,
  placeholder = "Search…",
  preserve,
}: {
  action: string;
  q?: string;
  placeholder?: string;
  /** Extra query params to keep when searching (e.g. filters). */
  preserve?: Record<string, string | undefined>;
}) {
  return (
    <form
      action={action}
      method="get"
      className="mb-4 flex flex-wrap items-center gap-2"
      role="search"
    >
      {preserve
        ? Object.entries(preserve).map(([k, v]) =>
            v ? (
              <input key={k} type="hidden" name={k} value={v} />
            ) : null,
          )
        : null}
      <label className="relative min-w-[min(100%,18rem)] flex-1">
        <span className="sr-only">Search</span>
        <MagnifyingGlass
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--c-ink-3)]"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          className="h-10 w-full rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] pl-9 pr-3 text-[13px] text-[var(--c-ink)] ring-1 ring-[var(--c-line-strong)] placeholder:text-[var(--c-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]"
        />
      </label>
      <button
        type="submit"
        className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]"
      >
        Search
      </button>
      {q ? (
        <a
          href={action}
          className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-3 text-[13px] text-[var(--c-ink-2)] ring-1 ring-[var(--c-line)]"
        >
          Clear
        </a>
      ) : null}
    </form>
  );
}
