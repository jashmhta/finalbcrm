"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ChatCircle,
  Phone,
  EnvelopeSimple,
  WhatsappLogo,
  ArrowsLeftRight,
  PresentationChart,
  Handshake,
  Chats,
  Sparkle,
  SealWarning,
  Clock,
  Users,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { InteractionListItem } from "@/features/interactions/queries";
import {
  Card,
  Badge,
  Button,
  CommandBar,
  Reveal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  type Density,
} from "@/components/brand";
import { Num } from "@/components/brand/money";
import { ExportCsvButton } from "@/features/reports/export-button";
import { NewInteractionDialog } from "./new-interaction-dialog";

/**
 * Client view layer for the interactions timeline. The server page runs
 * `listInteractions` and hands rows + pagination in; this component owns the
 * command bar (search + MNPI toggle + density), the double-bezel table, and
 * the pagination pills. Search + MNPI stay URL-driven (shareable); density is
 * pure client state.
 */
export interface InteractionsListViewProps {
  rows: InteractionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  mnpiOnly: boolean;
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  meeting: <ChatCircle weight="light" className="size-3.5" />,
  call: <Phone weight="light" className="size-3.5" />,
  email: <EnvelopeSimple weight="light" className="size-3.5" />,
  whatsapp: <WhatsappLogo weight="light" className="size-3.5" />,
  rfq: <ArrowsLeftRight weight="light" className="size-3.5" />,
  ndsom_chat: <Chats weight="light" className="size-3.5" />,
  site_visit: <Handshake weight="light" className="size-3.5" />,
  management_presentation: (
    <PresentationChart weight="light" className="size-3.5" />
  ),
};

function formatOccurredAt(value: Date | null): string {
  if (!value) return "-";
  return value.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InteractionsListView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
  mnpiOnly,
}: InteractionsListViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [density, setDensity] = React.useState<Density>("comfortable");
  const [search, setSearch] = React.useState(q ?? "");

  React.useEffect(() => {
    setSearch(q ?? "");
  }, [q]);

  const pushSearch = React.useCallback(
    (value: string) => {
      const params = new URLSearchParams(sp.toString());
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, sp],
  );

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchChange = React.useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => pushSearch(value), 280);
    },
    [pushSearch],
  );
  React.useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);

  function mnpiHref(on: boolean) {
    const params = new URLSearchParams(sp.toString());
    if (on) params.set("mnpi", "1");
    else params.delete("mnpi");
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex flex-col gap-5">
      <CommandBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search interactions…"
        density={density}
        onDensityChange={setDensity}
        label={`${total} ${total === 1 ? "interaction" : "interactions"}`}
        filters={
          <Button
            asChild
            variant={mnpiOnly ? "primary-gold" : "secondary-hairline"}
            size="sm"
            leadingIcon={<SealWarning weight="light" className="size-4" />}
          >
            <Link href={mnpiHref(!mnpiOnly)}>
              {mnpiOnly ? "MNPI only · on" : "MNPI only"}
            </Link>
          </Button>
        }
        actions={
          <>
            <ExportCsvButton type="interactions" />
            <NewInteractionDialog />
          </>
        }
      />

      <Reveal y={14}>
        <Card className="overflow-hidden">
          <Table density={density}>
            <TableHeader>
              <TableRow>
                <TableHead>Occurred</TableHead>
                <TableHead>Subject</TableHead>
                {/* Mobile: key-columns-only - Channel / Anchor / Attendees are
                    secondary on a phone, dropped below md so the table reads
                    Occurred · Subject · Flags instead of a 6-col horizontal
                    scroll. md+ restores the full ledger. */}
                <TableHead className="hidden md:table-cell">Channel</TableHead>
                <TableHead className="hidden md:table-cell">Anchor</TableHead>
                <TableHead align="right" className="hidden md:table-cell">
                  Attendees
                </TableHead>
                <TableHead align="right">Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={6} className="p-0">
                    <TableEmpty
                      icon={<Sparkle weight="light" />}
                      title={
                        total === 0
                          ? "The log is quiet - for now."
                          : "No interactions match this view."
                      }
                      hint={
                        total === 0
                          ? "Log your first meeting or call to start the engagement timeline."
                          : "Try clearing the MNPI filter or refining the search."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.interactionId}>
                    <TableCell className="text-muted-foreground">
                      <span className="nums tabular-nums">
                        {formatOccurredAt(r.occurredAt)}
                      </span>
                    </TableCell>
                    <TableCell primary>
                      <Link
                        href={`/interactions/${r.interactionId}`}
                        className="group/subject inline-flex flex-col gap-0.5"
                      >
                        <span className="transition-colors duration-200 ease-soft group-hover/subject:text-gold">
                          {r.subject || "(no subject)"}
                        </span>
                        {r.nextAction ? (
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Next: {r.nextAction}
                          </span>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.channel ? (
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/80">
                          <span className="text-muted-foreground/70">
                            {CHANNEL_ICON[r.channel] ?? (
                              <Chats weight="light" className="size-3.5" />
                            )}
                          </span>
                          {r.channel.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                      {r.direction ? (
                        <span className="ml-2 text-[11px] uppercase tracking-[0.08em] text-muted-foreground/70">
                          {r.direction}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-0.5 text-[12.5px]">
                        {r.partyName ? (
                          <Link
                            href={`/parties/${r.partyId}`}
                            className="transition-colors duration-200 ease-soft hover:text-gold"
                          >
                            {r.partyName}
                          </Link>
                        ) : null}
                        {r.dealCode ? (
                          <Link
                            href="/deals"
                            className="nums text-muted-foreground transition-colors duration-200 ease-soft hover:text-foreground"
                          >
                            {r.dealCode}
                          </Link>
                        ) : null}
                        {r.contactName ? (
                          <span className="text-muted-foreground">
                            {r.contactName}
                          </span>
                        ) : null}
                        {!r.partyName && !r.dealCode && !r.contactName ? (
                          <span className="text-muted-foreground/60">-</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell numeric className="hidden md:table-cell">
                      {r.attendeeCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-foreground/80">
                          <Users
                            weight="light"
                            className="size-3.5 text-muted-foreground/70"
                          />
                          <Num value={r.attendeeCount} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                    <TableCell numeric>
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {r.containsMnpi ? (
                          <Badge variant="down" icon={<SealWarning weight="light" />}>
                            MNPI
                          </Badge>
                        ) : null}
                        {r.durationMin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock weight="light" className="size-3" />
                            <Num value={r.durationMin} />m
                          </span>
                        ) : null}
                        {!r.containsMnpi && !r.durationMin ? (
                          <span className="text-muted-foreground/60">-</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Reveal>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-muted-foreground">
          {total === 0 ? (
            "Nothing to show."
          ) : (
            <>
              <span className="nums tabular-nums text-foreground/80">
                {rangeFrom.toLocaleString("en-IN")}–
                {rangeTo.toLocaleString("en-IN")}
              </span>{" "}
              of{" "}
              <span className="nums tabular-nums text-foreground/80">
                {total.toLocaleString("en-IN")}
              </span>{" "}
              interactions
            </>
          )}
        </p>
        {totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            q={q}
            mnpiOnly={mnpiOnly}
          />
        ) : null}
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  q,
  mnpiOnly,
}: {
  page: number;
  totalPages: number;
  q?: string;
  mnpiOnly: boolean;
}) {
  const pageHref = (p: number) =>
    `/interactions?${new URLSearchParams({
      ...(q ? { q } : {}),
      ...(mnpiOnly ? { mnpi: "1" } : {}),
      page: String(p),
    }).toString()}`;

  const pages: number[] = [];
  const win = 1;
  const start = Math.max(1, page - win);
  const end = Math.min(totalPages, page + win);
  for (let i = start; i <= end; i++) pages.push(i);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={prevDisabled}
        className={cn(prevDisabled && "pointer-events-none opacity-40")}
      >
        <Link href={pageHref(Math.max(1, page - 1))} aria-label="Previous page">
          <ArrowLeft weight="light" className="size-4" />
        </Link>
      </Button>

      {start > 1 ? (
        <>
          <PagePill href={pageHref(1)} active={page === 1}>
            1
          </PagePill>
          {start > 2 ? (
            <span className="px-1 text-muted-foreground/60">…</span>
          ) : null}
        </>
      ) : null}

      {pages.map((p) => (
        <PagePill key={p} href={pageHref(p)} active={p === page}>
          {p}
        </PagePill>
      ))}

      {end < totalPages ? (
        <>
          {end < totalPages - 1 ? (
            <span className="px-1 text-muted-foreground/60">…</span>
          ) : null}
          <PagePill href={pageHref(totalPages)} active={page === totalPages}>
            {totalPages}
          </PagePill>
        </>
      ) : null}

      <Button
        asChild
        variant="secondary-hairline"
        size="icon-sm"
        aria-disabled={nextDisabled}
        className={cn(nextDisabled && "pointer-events-none opacity-40")}
      >
        <Link
          href={pageHref(Math.min(totalPages, page + 1))}
          aria-label="Next page"
        >
          <ArrowRight weight="light" className="size-4" />
        </Link>
      </Button>
    </div>
  );
}

function PagePill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-[12.5px] transition-all duration-200 ease-soft",
        active
          ? "bg-gold/15 text-gold-deep ring-1 ring-gold/30"
          : "text-muted-foreground ring-1 ring-hairline hover:bg-foreground/[0.04] hover:text-foreground",
      )}
    >
      <span className="nums tabular-nums">{children}</span>
    </Link>
  );
}