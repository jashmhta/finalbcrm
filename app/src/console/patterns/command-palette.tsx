"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
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
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Debounced live search (search-engine feel)
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
    }, 180);
    return () => clearTimeout(handle);
  }, [q, open]);

  if (!open) return null;

  const navFiltered = items.filter((i) =>
    i.label.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const combined: {
    key: string;
    label: string;
    sub?: string;
    href: string;
    icon?: NavItemDef["icon"];
    kind?: string;
  }[] = [
    ...hits.map((h) => ({
      key: `hit-${h.kind}-${h.id}`,
      label: h.title,
      sub: h.subtitle ?? h.badges?.join(" · "),
      href: h.href,
      kind: h.kind,
    })),
    ...navFiltered.map((item) => ({
      key: `nav-${item.href}`,
      label: item.label,
      sub: "Go to page",
      href: item.href,
      icon: item.icon,
    })),
  ];

  if (q.trim().length >= 1) {
    combined.unshift({
      key: "full-search",
      label: `Search “${q.trim()}” in full results`,
      sub: "Open search engine view",
      href: `/console/search?q=${encodeURIComponent(q.trim())}`,
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(combined.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = combined[active] ?? combined[0];
      if (item) go(item.href);
      else if (q.trim()) go(`/console/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-[var(--c-ink)]/25 px-4 pt-[10vh] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] shadow-[var(--c-shadow)] ring-1 ring-[var(--c-line-strong)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--c-line)] px-3">
          <MagnifyingGlass className="size-4 text-[var(--c-ink-3)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, leads, mandates, tasks… or jump to a page"
            className="h-12 w-full bg-transparent text-[14px] text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)]"
            autoComplete="off"
          />
          {loading ? (
            <span className="text-[11px] text-[var(--c-ink-3)]">…</span>
          ) : null}
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {combined.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-[var(--c-ink-3)]">
              {q.trim().length < 2
                ? "Type at least 2 characters to search the book"
                : "No matches — try a shorter name"}
            </li>
          ) : (
            combined.map((item, idx) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px]",
                    idx === active
                      ? "bg-[var(--c-accent-soft)] text-[var(--c-ink)]"
                      : "text-[var(--c-ink)] hover:bg-[var(--c-accent-soft)]",
                  )}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => go(item.href)}
                >
                  {item.icon ? (
                    <NavIcon
                      name={item.icon}
                      className="size-4 shrink-0 text-[var(--c-ink-2)]"
                    />
                  ) : (
                    <span className="flex size-4 shrink-0 items-center justify-center rounded text-[9px] font-bold uppercase text-[var(--c-ink-3)]">
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
        <div className="border-t border-[var(--c-line)] px-3 py-2 text-[10px] text-[var(--c-ink-3)]">
          ↑↓ navigate · Enter open · Esc close · ⌘K toggle
        </div>
      </div>
    </div>
  );
}
