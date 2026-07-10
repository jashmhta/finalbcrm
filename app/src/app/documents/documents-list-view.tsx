"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowFatDown,
  Files,
  FileText,
  Sparkle,
  SealWarning,
  LockSimple,
  Eye,
  UploadSimple,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { DocumentListItem } from "@/features/documents/queries";
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
import { ExportCsvButton } from "@/features/reports/export-button";
import { NewDocumentDialog } from "./new-document-dialog";

export interface DocumentsListViewProps {
  rows: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  q?: string;
  typeKey: string;
  mnpiOnly: boolean;
  typeFilters: readonly string[];
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  kyc_pack: <Files weight="light" className="size-4" />,
  financial_statement: <Files weight="light" className="size-4" />,
  credit_memo: <FileText weight="light" className="size-4" />,
  term_sheet: <FileText weight="light" className="size-4" />,
  legal_dd_report: <FileText weight="light" className="size-4" />,
  site_report: <FileText weight="light" className="size-4" />,
};

function formatSize(bytes: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DocumentsListView({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  q,
  typeKey,
  mnpiOnly,
  typeFilters,
}: DocumentsListViewProps) {
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

  function mnpiHref(on: boolean) {
    const params = new URLSearchParams(sp.toString());
    if (on) params.set("mnpi", "1");
    else params.delete("mnpi");
    params.delete("page");
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-5">
      {/* Type filter rail */}
      <Reveal y={8} duration={0.5} noBlur>
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl bg-foreground/[0.02] p-1.5 ring-1 ring-hairline/60">
          {typeFilters.map((f) => {
            const active = f === typeKey;
            return (
              <Link
                key={f}
                href={`/documents?${new URLSearchParams({
                  type: f,
                  ...(mnpiOnly ? { mnpi: "1" } : {}),
                  ...(q ? { q } : {}),
                }).toString()}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-all duration-200 ease-soft",
                  active
                    ? "bg-surface text-foreground shadow-soft ring-1 ring-hairline"
                    : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
                )}
              >
                {f === "all" ? "All" : f.replace(/_/g, " ")}
              </Link>
            );
          })}
        </div>
      </Reveal>

      <CommandBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by file name…"
        density={density}
        onDensityChange={setDensity}
        label={`${total} ${total === 1 ? "document" : "documents"}`}
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
            <ExportCsvButton type="documents" />
            <NewDocumentDialog />
          </>
        }
      />

      <Reveal y={14}>
        <Card className="overflow-hidden">
          <Table density={density}>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                {/* Mobile: key-columns-only - Type / Size / Linked-to are
                    secondary on a phone, dropped below md so the vault reads
                    File · Flags · Uploaded. md+ restores the full 6-col read. */}
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead align="right" className="hidden md:table-cell">
                  Size
                </TableHead>
                <TableHead className="hidden md:table-cell">Linked to</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead align="right">Uploaded</TableHead>
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
                          ? "The vault is empty."
                          : "No documents match this view."
                      }
                      hint={
                        total === 0
                          ? "Register your first document to start the records index."
                          : "Try a different type filter or clear the search."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((d) => (
                  <TableRow key={d.documentId}>
                    <TableCell primary>
                      <Link
                        href={`/documents/${d.documentId}`}
                        className="group/file inline-flex flex-col gap-0.5"
                      >
                        <span className="inline-flex items-center gap-2 transition-colors duration-200 ease-soft group-hover/file:text-gold">
                          <span className="text-muted-foreground/70 [&_svg]:size-4">
                            {TYPE_ICON[d.documentType ?? ""] ?? (
                              <FileText weight="light" className="size-4" />
                            )}
                          </span>
                          {d.fileName ?? "(unnamed)"}
                        </span>
                        {d.mimeType ? (
                          <span className="nums pl-6 text-[11px] text-muted-foreground/70">
                            {d.mimeType}
                          </span>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {d.documentType ? (
                        <Badge variant="neutral">
                          {d.documentType.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                      {d.kycCategory ? (
                        <div className="mt-1">
                          <Badge variant="outline">
                            {d.kycCategory.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell numeric className="hidden md:table-cell">
                      <span className="nums tabular-nums text-foreground/80">
                        {formatSize(d.sizeBytes)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-0.5 text-[12.5px]">
                        {d.partyName ? (
                          <Link
                            href={`/parties/${d.partyId}`}
                            className="transition-colors duration-200 ease-soft hover:text-gold"
                          >
                            {d.partyName}
                          </Link>
                        ) : null}
                        {d.dealCode ? (
                          <Link
                            href="/deals"
                            className="nums text-muted-foreground transition-colors duration-200 ease-soft hover:text-foreground"
                          >
                            {d.dealCode}
                          </Link>
                        ) : null}
                        {d.contactName ? (
                          <span className="text-muted-foreground">
                            {d.contactName}
                          </span>
                        ) : null}
                        {!d.partyName && !d.dealCode && !d.contactName ? (
                          <span className="text-muted-foreground/60">-</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {d.isMnpi ? (
                          <Badge variant="down" icon={<SealWarning weight="light" />}>
                            MNPI
                          </Badge>
                        ) : null}
                        {d.isConfidential ? (
                          <Badge variant="neutral" icon={<LockSimple weight="light" />}>
                            confidential
                          </Badge>
                        ) : null}
                        {d.barrierId ? (
                          <Badge variant="outline" icon={<Eye weight="light" />}>
                            walled
                          </Badge>
                        ) : null}
                        {!d.isMnpi && !d.isConfidential && !d.barrierId ? (
                          <span className="text-muted-foreground/60">-</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell numeric>
                      <div className="inline-flex flex-col items-end gap-0.5">
                        <span className="nums tabular-nums text-foreground/80">
                          {d.createdAt
                            ? d.createdAt.toLocaleDateString("en-IN", {
                                year: "numeric",
                                month: "short",
                                day: "2-digit",
                              })
                            : "-"}
                        </span>
                        {d.uploadedByEmail ? (
                          <span className="text-[10px] text-muted-foreground/70">
                            {d.uploadedByEmail}
                          </span>
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
              documents
            </>
          )}
        </p>
        {totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            typeKey={typeKey}
            mnpiOnly={mnpiOnly}
            q={q}
          />
        ) : null}
      </div>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  typeKey,
  mnpiOnly,
  q,
}: {
  page: number;
  totalPages: number;
  typeKey: string;
  mnpiOnly: boolean;
  q?: string;
}) {
  const pageHref = (p: number) =>
    `/documents?${new URLSearchParams({
      type: typeKey,
      ...(mnpiOnly ? { mnpi: "1" } : {}),
      ...(q ? { q } : {}),
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