import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";

import { requireUser } from "@/lib/rbac";
import { globalSearch } from "@/features/search/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const KIND_TONE: Record<string, "accent" | "info" | "ok" | "warn" | "neutral"> =
  {
    party: "accent",
    lead: "info",
    deal: "ok",
    task: "warn",
    interaction: "neutral",
  };

export default async function ConsoleSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const result = q.length >= 1 ? await globalSearch(q, user) : null;

  return (
    <div>
      <CPageHeader
        eyebrow="Find anything"
        title="Search"
        description="Search-engine style results across clients, leads, mandates, tasks, and touches — ranked by relevance."
      />

      <form
        action="/console/search"
        method="get"
        className="mb-6"
        role="search"
      >
        <label className="relative block">
          <span className="sr-only">Search the firm book</span>
          <MagnifyingGlass
            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--c-ink-3)]"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Try a company, contact, mandate code, rating, sector…"
            className="h-14 w-full rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] pl-12 pr-28 text-[16px] text-[var(--c-ink)] shadow-[var(--c-shadow)] ring-1 ring-[var(--c-line-strong)] placeholder:text-[var(--c-ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--c-accent)]"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 h-10 -translate-y-1/2 rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-5 text-[13px] font-medium text-[var(--c-on-accent)]"
          >
            Search
          </button>
        </label>
      </form>

      {!q ? (
        <CCard className="space-y-2">
          <p className="text-[13px] font-medium text-[var(--c-ink)]">
            Tips for better hits
          </p>
          <ul className="list-disc space-y-1 pl-5 text-[12px] text-[var(--c-ink-3)]">
            <li>Company legal name or short name</li>
            <li>Mandate / deal code (e.g. SCALE-00012)</li>
            <li>Contact person or email fragment</li>
            <li>Sector, rating (AA), or investor type</li>
            <li>Press ⌘K anywhere, type, then Enter for full results</li>
          </ul>
        </CCard>
      ) : !result || result.hits.length === 0 ? (
        <CEmpty
          title="No results"
          body={`Nothing matched “${q}”. Try fewer words or a partial legal name.`}
          actionLabel="Client book"
          actionHref="/console/parties"
        />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-[var(--c-ink-3)]">
            <span>
              {result.hits.length} results in {result.tookMs} ms
            </span>
            {Object.entries(result.counts).map(([k, n]) => (
              <CBadge key={k} tone="neutral">
                {k} {n}
              </CBadge>
            ))}
          </div>
          <ul className="space-y-2">
            {result.hits.map((h) => (
              <li key={`${h.kind}-${h.id}`}>
                <Link href={h.href} className="block">
                  <CCard className="p-3 transition-colors hover:bg-[var(--c-surface-2)]/40 md:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(h.badges ?? [h.kind]).map((b) => (
                            <CBadge
                              key={b}
                              tone={KIND_TONE[h.kind] ?? "neutral"}
                            >
                              {b}
                            </CBadge>
                          ))}
                          <span className="text-[10px] tabular-nums text-[var(--c-ink-3)]">
                            score {h.score}
                          </span>
                        </div>
                        <p className="mt-1 text-[15px] font-semibold text-[var(--c-ink)]">
                          {highlight(h.title, q)}
                        </p>
                        {h.subtitle ? (
                          <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">
                            {h.subtitle}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-[12px] text-[var(--c-accent)]">
                        Open →
                      </span>
                    </div>
                  </CCard>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Lightweight server-side highlight using mark tags. */
function highlight(text: string, q: string): React.ReactNode {
  const token = q.trim().split(/\s+/)[0];
  if (!token || token.length < 2) return text;
  const idx = text.toLowerCase().indexOf(token.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-[var(--c-accent-soft)] px-0.5 text-[var(--c-ink)]">
        {text.slice(idx, idx + token.length)}
      </mark>
      {text.slice(idx + token.length)}
    </>
  );
}
