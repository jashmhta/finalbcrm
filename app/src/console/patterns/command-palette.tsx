"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MagnifyingGlass,
  X,
  ArrowRight,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import type { NavItemDef } from "@/console/rbac/nav";
import { NavIcon } from "@/console/shells/icons";
import { cn } from "@/console/lib/cn";

type LiveHit = {
  kind: string;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  score: number;
  badges?: string[];
};

const RECENT_KEY = "bcrm-cmd-recent";

function loadRecent(): { label: string; href: string }[] {
  try {
    const raw = sessionStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { label: string; href: string }[];
    return Array.isArray(parsed) ? parsed.slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecent(item: { label: string; href: string }) {
  try {
    const prev = loadRecent().filter((r) => r.href !== item.href);
    const next = [item, ...prev].slice(0, 6);
    sessionStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

const QUICK_ACTIONS: { label: string; href: string; hint: string }[] = [
  { label: "Add client", href: "/console/parties?new=1", hint: "New company" },
  {
    label: "Import clients",
    href: "/console/parties/import",
    hint: "Excel / CSV",
  },
  { label: "Client book", href: "/console/parties", hint: "Your book" },
  { label: "Leads", href: "/console/leads", hint: "Pipeline" },
  { label: "Alerts", href: "/console/alerts", hint: "Inbox" },
  { label: "Full search", href: "/console/search", hint: "Engine" },
];

export function CommandPalette({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: NavItemDef[];
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<LiveHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [recent, setRecent] = React.useState<{ label: string; href: string }[]>(
    [],
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      setRecent(loadRecent());
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      // Lock body scroll on mobile sheet
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Debounced live search
  React.useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/console/search?q=${encodeURIComponent(term)}`,
          { credentials: "same-origin" },
        );
        if (!res.ok) {
          setHits([]);
          return;
        }
        const data = (await res.json()) as { hits?: LiveHit[] };
        setHits(data.hits ?? []);
        setActive(0);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => clearTimeout(handle);
  }, [q, open]);

  if (!open) return null;

  const term = q.trim();
  const navFiltered = items.filter((i) =>
    i.label.toLowerCase().includes(term.toLowerCase()),
  );

  const go = (href: string, label?: string) => {
    if (label) pushRecent({ label, href });
    onOpenChange(false);
    router.push(href);
  };

  type Row = {
    key: string;
    label: string;
    sub?: string;
    href: string;
    icon?: NavItemDef["icon"];
    kind?: string;
  };

  const combined: Row[] = [];

  if (term.length >= 1) {
    combined.push({
      key: "full-search",
      label: `Search “${term}” in full results`,
      sub: "Open search engine view",
      href: `/console/search?q=${encodeURIComponent(term)}`,
    });
  }

  for (const h of hits) {
    combined.push({
      key: `hit-${h.kind}-${h.id}`,
      label: h.title,
      sub: h.subtitle ?? h.badges?.join(" · "),
      href: h.href,
      kind: h.kind,
    });
  }

  for (const item of navFiltered) {
    combined.push({
      key: `nav-${item.href}`,
      label: item.label,
      sub: "Go to page",
      href: item.href,
      icon: item.icon,
    });
  }

  // Idle state: quick actions + recent
  const showIdle = term.length === 0;

  function onKeyDown(e: React.KeyboardEvent) {
    const max = showIdle
      ? QUICK_ACTIONS.length + recent.length - 1
      : Math.max(combined.length - 1, 0);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(max, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showIdle) {
        const all = [
          ...QUICK_ACTIONS.map((a) => ({ href: a.href, label: a.label })),
          ...recent,
        ];
        const item = all[active] ?? all[0];
        if (item) go(item.href, item.label);
        return;
      }
      const item = combined[active] ?? combined[0];
      if (item) go(item.href, item.label);
      else if (term) go(`/console/search?q=${encodeURIComponent(term)}`, term);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[var(--c-ink)]/40 sm:items-start sm:bg-[var(--c-ink)]/25 sm:px-4 sm:pt-[8vh] sm:backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Search and jump"
      onClick={() => onOpenChange(false)}
    >
      <div
        className={cn(
          "flex w-full flex-col overflow-hidden bg-[var(--c-surface)] shadow-[var(--c-shadow)]",
          // Mobile: bottom sheet almost full height
          "max-h-[92dvh] rounded-t-[20px] ring-1 ring-[var(--c-line-strong)]",
          // Desktop: centered card
          "sm:max-h-[min(72vh,560px)] sm:max-w-xl sm:rounded-[var(--c-radius-lg)]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle (mobile) */}
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-full bg-[var(--c-line-strong)]" />
        </div>

        <div className="flex items-center gap-2 border-b border-[var(--c-line)] px-3 pb-1 pt-1 sm:pt-0">
          <MagnifyingGlass
            className="size-5 shrink-0 text-[var(--c-ink-3)] sm:size-4"
            weight="bold"
          />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, leads, mandates…"
            className="h-12 w-full bg-transparent text-[16px] text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] sm:h-12 sm:text-[14px]"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
          />
          {loading ? (
            <span className="text-[11px] text-[var(--c-ink-3)]">…</span>
          ) : null}
          {q ? (
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--c-ink-3)] hover:bg-[var(--c-surface-2)]"
              aria-label="Clear"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--c-ink-3)] hover:bg-[var(--c-surface-2)] sm:hidden"
              aria-label="Close search"
              onClick={() => onOpenChange(false)}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <ul
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 sm:max-h-80 sm:p-1.5"
        >
          {showIdle ? (
            <>
              <li className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                Quick actions
              </li>
              {QUICK_ACTIONS.map((a, idx) => (
                <li key={a.href}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[14px] sm:py-2.5 sm:text-[13px]",
                      idx === active
                        ? "bg-[var(--c-accent-soft)] text-[var(--c-ink)]"
                        : "text-[var(--c-ink)] active:bg-[var(--c-accent-soft)] hover:bg-[var(--c-accent-soft)]",
                    )}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(a.href, a.label)}
                  >
                    <ArrowRight className="size-4 shrink-0 text-[var(--c-accent)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{a.label}</span>
                      <span className="block text-[11px] text-[var(--c-ink-3)]">
                        {a.hint}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {recent.length > 0 ? (
                <>
                  <li className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                    Recent
                  </li>
                  {recent.map((r, i) => {
                    const idx = QUICK_ACTIONS.length + i;
                    return (
                      <li key={`${r.href}-${i}`}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[14px] sm:py-2.5 sm:text-[13px]",
                            idx === active
                              ? "bg-[var(--c-accent-soft)]"
                              : "active:bg-[var(--c-accent-soft)] hover:bg-[var(--c-accent-soft)]",
                          )}
                          onMouseEnter={() => setActive(idx)}
                          onClick={() => go(r.href, r.label)}
                        >
                          <ClockCounterClockwise className="size-4 shrink-0 text-[var(--c-ink-3)]" />
                          <span className="truncate font-medium">{r.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </>
              ) : null}
            </>
          ) : combined.length === 0 ? (
            <li className="px-3 py-10 text-center text-[13px] text-[var(--c-ink-3)]">
              {term.length < 2
                ? "Type at least 2 characters to search your book"
                : "No matches — try a shorter name"}
            </li>
          ) : (
            combined.map((item, idx) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[14px] sm:gap-2.5 sm:py-2.5 sm:text-[13px]",
                    idx === active
                      ? "bg-[var(--c-accent-soft)] text-[var(--c-ink)]"
                      : "text-[var(--c-ink)] active:bg-[var(--c-accent-soft)] hover:bg-[var(--c-accent-soft)]",
                  )}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(item.href, item.label)}
                >
                  {item.icon ? (
                    <NavIcon
                      name={item.icon}
                      className="size-5 shrink-0 text-[var(--c-ink-2)] sm:size-4"
                    />
                  ) : (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-[var(--c-surface-2)] text-[9px] font-bold uppercase text-[var(--c-ink-3)] sm:size-4">
                      {(item.kind ?? "go").slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {item.label}
                    </span>
                    {item.sub ? (
                      <span className="block truncate text-[11px] text-[var(--c-ink-3)]">
                        {item.sub}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-[var(--c-line)] px-3 py-2.5 text-[10px] text-[var(--c-ink-3)]">
          <span className="hidden sm:inline">
            ↑↓ navigate · Enter open · Esc close · ⌘K
          </span>
          <span className="sm:hidden">Scoped to your book · no cross-desk leak</span>
          <button
            type="button"
            className="rounded-full px-2 py-1 font-medium text-[var(--c-ink-2)] ring-1 ring-[var(--c-line)] sm:hidden"
            onClick={() => onOpenChange(false)}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
