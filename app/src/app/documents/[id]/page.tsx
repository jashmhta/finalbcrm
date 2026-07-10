import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  SealWarning,
  LockSimple,
  Eye,
  Hash,
  CalendarBlank,
  Buildings,
  ArrowsLeftRight,
  User,
  Clock,
} from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import { getDocumentDetail } from "@/features/documents/queries";
import {
  Card,
  Badge,
  Button,
  Reveal,
} from "@/components/brand";
import { Eyebrow, SectionHeading } from "@/components/brand/text";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

function formatSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const row = await getDocumentDetail(id, user);
  if (!row) notFound();

  const d = row.document;

  return (
    <PageShell>
      {/* Breadcrumb */}
      <Reveal y={8} duration={0.5} noBlur>
        <div className="mb-6 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Link
              href="/documents"
              className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-soft hover:text-foreground"
            >
              <ArrowLeft weight="light" className="size-3.5" />
              Documents
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="nums text-foreground/60">
              {d.documentId.slice(0, 8)}
            </span>
          </nav>
          <Button
            asChild
            variant="secondary-hairline"
            size="sm"
            trailingIcon={<ArrowUpRight weight="light" className="size-4" />}
          >
            <Link href="/documents">All documents</Link>
          </Button>
        </div>
      </Reveal>

      {/* Header band */}
      <Reveal y={14} duration={0.6}>
        <Card className="mb-8 overflow-hidden">
          <div className="flex flex-col gap-6 p-6 md:p-8">
            <div className="flex flex-col gap-3">
              <SectionHeading
                display
                eyebrow={d.documentType ? d.documentType.replace(/_/g, " ") : "Document"}
                title={d.fileName ?? "(unnamed)"}
                description={d.kycCategory ? d.kycCategory.replace(/_/g, " ") : undefined}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-5">
              {d.isMnpi ? (
                <Badge variant="down" icon={<SealWarning weight="light" />}>
                  MNPI
                </Badge>
              ) : null}
              {d.isConfidential ? (
                <Badge variant="neutral" icon={<LockSimple weight="light" />}>
                  Confidential
                </Badge>
              ) : null}
              {d.barrierId ? (
                <Badge variant="outline" icon={<Eye weight="light" />}>
                  Walled · {d.barrierId.slice(0, 8)}
                </Badge>
              ) : null}
              {!d.isMnpi && !d.isConfidential && !d.barrierId ? (
                <Badge variant="emerald" dot>
                  No restrictions
                </Badge>
              ) : null}
            </div>
          </div>
        </Card>
      </Reveal>

      {/* File facts */}
      <Reveal y={14} duration={0.6} delay={0.05} className="mb-6">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-foreground/[0.04] text-muted-foreground ring-1 ring-hairline/60 [&_svg]:size-4">
                <FileText weight="light" />
              </span>
              <Eyebrow>File</Eyebrow>
            </div>
            <div className="flex flex-col gap-3.5 text-[13.5px]">
              <FactRow label="MIME type">{d.mimeType ?? "-"}</FactRow>
              <FactRow label="Size">
                <span className="nums tabular-nums text-foreground/85">
                  {formatSize(d.sizeBytes ?? null)}
                </span>
              </FactRow>
              <FactRow label="Object-store key">
                {d.fileStoreRef ? (
                  <code className="nums break-all rounded-lg bg-foreground/[0.04] px-2 py-1 text-[12px] text-foreground/80 ring-1 ring-hairline/50">
                    {d.fileStoreRef}
                  </code>
                ) : (
                  "-"
                )}
              </FactRow>
              {d.sha256 ? (
                <FactRow label="SHA-256" icon={<Hash weight="light" />}>
                  <code className="nums break-all rounded-lg bg-foreground/[0.04] px-2 py-1 text-[11.5px] text-foreground/80 ring-1 ring-hairline/50">
                    {d.sha256}
                  </code>
                </FactRow>
              ) : null}
              <FactRow label="Retention until" icon={<CalendarBlank weight="light" />}>
                <span className="nums tabular-nums text-foreground/85">
                  {d.retentionUntil ?? "-"}
                </span>
              </FactRow>
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Linked to */}
        <Reveal y={14} duration={0.6} delay={0.05}>
          <Card className="h-full">
            <div className="flex flex-col gap-4 p-6">
              <Eyebrow>Linked to</Eyebrow>
              <div className="flex flex-col gap-3.5 text-[13.5px]">
                <LinkRow icon={<Buildings weight="light" />} label="Party">
                  {row.partyName && d.partyId ? (
                    <Link
                      href={`/parties/${d.partyId}`}
                      className="transition-colors duration-200 ease-soft hover:text-gold"
                    >
                      {row.partyName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </LinkRow>
                <LinkRow
                  icon={<ArrowsLeftRight weight="light" />}
                  label="Deal"
                >
                  {row.dealCode ? (
                    <Link
                      href="/deals"
                      className="nums transition-colors duration-200 ease-soft hover:text-gold"
                    >
                      {row.dealCode}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                  {row.dealName ? (
                    <span className="ml-2 text-muted-foreground">
                      {row.dealName}
                    </span>
                  ) : null}
                </LinkRow>
                <LinkRow icon={<User weight="light" />} label="Contact">
                  {row.contactName ?? (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </LinkRow>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Access control */}
        <Reveal y={14} duration={0.6} delay={0.1}>
          <Card className="h-full">
            <div className="flex flex-col gap-4 p-6">
              <Eyebrow>Access control</Eyebrow>
              <div className="flex flex-col gap-3.5 text-[13.5px]">
                <LinkRow icon={<User weight="light" />} label="Uploaded by">
                  {row.uploadedByEmail ?? (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </LinkRow>
                <LinkRow icon={<Clock weight="light" />} label="Uploaded at">
                  <span className="nums tabular-nums text-foreground/85">
                    {d.createdAt
                      ? d.createdAt.toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "-"}
                  </span>
                </LinkRow>
                <LinkRow icon={<Eye weight="light" />} label="Barrier">
                  {d.barrierId ? (
                    <span className="nums text-foreground/80">
                      {d.barrierId.slice(0, 8)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">none</span>
                  )}
                </LinkRow>
              </div>
              {d.isMnpi ? (
                <p className="rounded-xl bg-down/10 px-3.5 py-3 text-[12px] leading-[1.55] text-down/90 ring-1 ring-down/25">
                  MNPI: download, copy, and email-forward are disabled; a
                  watermark is forced on any render.
                </p>
              ) : null}
            </div>
          </Card>
        </Reveal>
      </div>
    </PageShell>
  );
}

function FactRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-hairline/50 pb-3.5 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="text-left text-foreground/85 sm:text-right">
        {children}
      </span>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline/50 pb-3.5 last:border-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </span>
      <span className="text-right text-foreground/85">{children}</span>
    </div>
  );
}
