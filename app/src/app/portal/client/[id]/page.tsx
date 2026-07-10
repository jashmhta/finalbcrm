import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Buildings,
  Eye,
  FileText,
  Handshake,
  IdentificationCard,
  Hash,
  LockSimple,
  ShieldCheck,
  TrendUp,
  Users,
} from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import {
  getClientDetail,
  PORTAL_ENUM_LABELS,
} from "@/features/portal";
import type {
  ClientContactRow,
  ClientDealRow,
  ClientDocumentRow,
  ClientKycRow,
} from "@/features/portal";
import {
  Badge,
  CellEmpty,
  EmptyState,
  Money,
  Num,
  PreviewPane,
  Reveal,
  StatCard,
  compactINR,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import { Eyebrow, SectionHeading } from "@/components/brand/text";
import { ChartCard } from "@/components/brand/chart-theme";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// DB-backed detail - never prerender.
export const dynamic = "force-dynamic";

const { titleizeEnum } = PORTAL_ENUM_LABELS;

function fmtDate(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtDateTime(v: Date | null): string {
  if (!v) return "-";
  if (!Number.isFinite(v.getTime())) return "-";
  return v.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtBytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function kycVariant(status: string | null): BadgeProps["variant"] {
  if (!status) return "outline";
  if (status === "approved") return "emerald";
  if (status === "rejected" || status === "expired") return "down";
  return "info";
}

function dealStatusVariant(status: string | null): BadgeProps["variant"] {
  if (!status) return "outline";
  if (status === "settled" || status === "closed") return "emerald";
  if (status === "dropped" || status === "on_hold") return "down";
  if (
    status === "mandated" ||
    status === "in_dd" ||
    status === "structuring" ||
    status === "rating_marketing" ||
    status === "pricing" ||
    status === "allocation"
  )
    return "info";
  return "outline";
}

function dealTypeLabel(t: string): string {
  return titleizeEnum(t);
}

const NATURE_LABEL: Record<string, string> = {
  organization: "Organization",
  natural_person: "Natural person",
  spv: "Special Purpose Vehicle",
  trust: "Trust",
  government: "Government",
  regulator: "Regulator",
};

const ONBOARDING_STAGE_LABEL: Record<string, string> = {
  prospect: "Prospect",
  kyc_initiated: "KYC initiated",
  kyc_verified: "KYC verified",
  docs_collected: "Docs collected",
  compliance_review: "Compliance review",
  activated: "Activated",
  onboarded: "Onboarded",
};

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  engagement_letter: "Engagement letter",
  mandate_letter: "Mandate letter",
  rating_rationale: "Rating rationale",
  offering_circular: "Offering circular",
  drhp: "DRHP",
  information_memorandum: "Information memorandum",
  term_sheet: "Term sheet",
  security_document: "Security document",
  trustee_deed: "Trustee deed",
  kyc_pack: "KYC pack",
  pan_card: "PAN card",
  aadhaar: "Aadhaar",
  board_resolution: "Board resolution",
  form60: "Form 60",
  form61: "Form 61",
  financial_statement: "Financial statement",
  financial_model_file: "Financial model",
  credit_memo: "Credit memo",
  valuation_report: "Valuation report",
  legal_dd_report: "Legal DD report",
  site_report: "Site report",
  consent_form: "Consent form",
  other: "Other",
};

const KYC_CATEGORY_LABEL: Record<string, string> = {
  id_proof: "ID proof",
  address_proof: "Address proof",
  pan: "PAN",
  bo_declaration: "BO declaration",
  pep_declaration: "PEP declaration",
  source_of_funds: "Source of funds",
  authority_letter: "Authority letter",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getClientDetail(id, user);
  if (!detail) notFound();

  const {
    party,
    deals,
    documents,
    kycHistory,
    kycCurrent,
    onboardingStage,
    contacts,
    summary,
  } = detail;

  const pan = party.identifiers.find((i) => i.type === "PAN");
  const cin = party.identifiers.find((i) => i.type === "CIN");
  const gstin = party.identifiers.find((i) => i.type === "GSTIN");

  return (
    <PageShell>
      {/* Breadcrumb + back to the directory. */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Link
            href="/portal/client"
            className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-soft hover:text-foreground"
          >
            <ArrowLeft weight="light" className="size-3.5" />
            Client portal
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="nums text-foreground/60">{party.partyId.slice(0, 8)}</span>
        </nav>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground ring-1 ring-hairline">
          <Eye weight="light" className="size-3.5" />
          Read-only
        </span>
      </div>

      {/* Header - the client identity. */}
      <PreviewPane
        sticky={false}
        className="mb-8"
        type={`Client · ${NATURE_LABEL[party.partyNature] ?? party.partyNature}`}
        name={party.legalName}
        mark={
          <span className="inline-flex size-11 items-center justify-center rounded-full ring-1 ring-gold/22 bg-gold/[0.06] text-gold/85 [&_svg]:size-6">
            <Briefcase weight="light" />
          </span>
        }
        badges={
          <>
            <Badge variant={party.status === "active" ? "emerald" : "outline"}>
              {titleizeEnum(party.status)}
            </Badge>
            {kycCurrent ? (
              <Badge variant={kycVariant(kycCurrent.status)}>
                KYC · {titleizeEnum(kycCurrent.status)}
              </Badge>
            ) : (
              <Badge variant="outline">No KYC</Badge>
            )}
            {onboardingStage ? (
              <Badge variant="info">
                Onboarding · {ONBOARDING_STAGE_LABEL[onboardingStage] ?? onboardingStage}
              </Badge>
            ) : null}
            {party.isListed ? (
              <Badge variant="info">
                Listed{party.listingExchange ? ` · ${party.listingExchange}` : ""}
              </Badge>
            ) : null}
            <Badge variant="gold">
              Raised · {compactINR(summary.totalRaisedCr * 1e7)}
            </Badge>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <span className="nums uppercase tracking-[0.1em] text-muted-foreground/70">
              {party.countryOfIncorporation}
              {party.domicileState ? ` · ${party.domicileState}` : ""}
              {party.city ? ` · ${party.city}` : ""}
            </span>
            <span className="nums tabular-nums">
              {summary.dealCount.toLocaleString("en-IN")}{" "}
              {summary.dealCount === 1 ? "deal" : "deals"} ·{" "}
              {summary.documentCount.toLocaleString("en-IN")} docs
            </span>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline/60 sm:grid-cols-4">
          <MetaCell
            label="PAN"
            value={pan?.value ?? "-"}
            mono
            icon={<IdentificationCard weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="CIN / LLPIN"
            value={cin?.value ?? "-"}
            mono
            icon={<Hash weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="GSTIN"
            value={gstin?.value ?? "-"}
            mono
            icon={<Buildings weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="KYC risk"
            value={titleizeEnum(party.kycRiskRating)}
            icon={<ShieldCheck weight="light" className="size-3.5" />}
          />
        </div>
      </PreviewPane>

      {/* KPI row - the engagement at a glance. */}
      <Reveal y={10} duration={0.55} noBlur>
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Deals"
            value={summary.dealCount}
            preset="int"
            icon={<Briefcase weight="light" />}
          />
          <StatCard
            label="Active deals"
            value={summary.activeDealCount}
            preset="int"
            icon={<Handshake weight="light" />}
            tone={summary.activeDealCount > 0 ? "gold" : "default"}
          />
          <StatCard
            label="Total raised"
            value={summary.totalRaisedCr * 1e7}
            preset="currency"
            icon={<TrendUp weight="light" />}
            tone="gold"
          />
          <StatCard
            label="Documents"
            value={summary.documentCount}
            preset="int"
            icon={<FileText weight="light" />}
          />
        </div>
      </Reveal>

      {/* Deals - the engagement mandates where the client is the issuer. */}
      <Reveal y={12} duration={0.55} noBlur>
        <div className="mb-8">
          <SectionHeading
            eyebrow="Mandates"
            title="Deals"
            description="Every deal where this client is the issuer - target size, placed amount, investor count and status. The placement progress (placed vs target) reads at a glance."
            className="mb-4 !flex-row"
            display
          />
          <DealsTable deals={deals} />
        </div>
      </Reveal>

      {/* Documents + contacts side by side. */}
      <Reveal y={12} duration={0.55} noBlur>
        <div className="mb-8 grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SectionHeading
              eyebrow="Records"
              title="Documents"
              description="KYC packs, financials, mandate letters and engagement records held against this client. MNPI and confidential flags are surfaced; this is a read-only view - no download."
              className="mb-4 !flex-row"
              display
            />
            <DocumentsTable documents={documents} />
          </div>
          <div className="lg:col-span-4">
            <ChartCard title="Key contacts" description="The client's primary people on record.">
              <ContactsList contacts={contacts} />
            </ChartCard>
          </div>
        </div>
      </Reveal>

      {/* KYC status + history. */}
      <Reveal y={12} duration={0.55} noBlur>
        <div className="mb-8">
          <SectionHeading
            eyebrow="Compliance"
            title="KYC history"
            description="Every KYC record on file for this client, newest first - status, type, risk rating, validity and approval trail."
            className="mb-4 !flex-row"
            display
          />
          <KycHistoryTable rows={kycHistory} />
        </div>
      </Reveal>
    </PageShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Local presentational helpers.
   ────────────────────────────────────────────────────────────────────── */

function MetaCell({
  label,
  value,
  mono = false,
  icon,
}: {
  label: string;
  value: string;
  mono?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-surface px-4 py-3.5">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        {label}
      </span>
      <span
        className={
          mono
            ? "nums tabular-nums text-[13.5px] font-medium text-foreground truncate"
            : "text-[13.5px] font-medium text-foreground truncate"
        }
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function DealsTable({ deals }: { deals: ClientDealRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Deal</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead align="right">Target</TableHead>
              <TableHead align="right">Placed</TableHead>
              <TableHead className="hidden lg:table-cell" align="right">
                Investors
              </TableHead>
              <TableHead className="hidden xl:table-cell">Closed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deals.length === 0 ? (
              <TableEmpty
                icon={<Briefcase weight="light" />}
                title="No deals on record."
                hint="Mandates where this client is the issuer will appear here."
              />
            ) : (
              deals.map((d) => {
                const placedPct =
                  d.targetSize > 0
                    ? Math.min(100, (d.allocatedCr / d.targetSizeCr) * 100)
                    : d.allocatedCr > 0
                      ? 100
                      : 0;
                return (
                  <TableRow key={d.dealId}>
                    <TableCell primary>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground font-medium">
                          {d.dealName ?? d.dealCode ?? "-"}
                        </span>
                        <span className="nums text-[11.5px] tabular-nums text-muted-foreground">
                          {d.dealCode ?? "-"} · {d.brand}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {dealTypeLabel(d.dealType)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={dealStatusVariant(d.status)}>
                        {titleizeEnum(d.status)}
                      </Badge>
                    </TableCell>
                    <TableCell numeric>
                      <Money value={d.targetSize} compact />
                    </TableCell>
                    <TableCell numeric>
                      <div className="flex flex-col items-end gap-1">
                        <Money value={d.allocatedCr * 1e7} compact />
                        {d.targetSize > 0 ? (
                          <span className="text-[10.5px] tabular-nums text-muted-foreground">
                            {placedPct.toFixed(0)}% placed
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell" numeric>
                      {d.investorCount.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell nums text-muted-foreground">
                      {fmtDate(d.actualCloseDate ?? d.targetCloseDate)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DocumentsTable({ documents }: { documents: ClientDocumentRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden lg:table-cell">Category</TableHead>
              <TableHead className="hidden sm:table-cell" align="right">
                Size
              </TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="hidden xl:table-cell">Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length === 0 ? (
              <TableEmpty
                icon={<FileText weight="light" />}
                title="No documents on file."
                hint="KYC packs, financials and engagement records will appear here."
              />
            ) : (
              documents.map((d) => (
                <TableRow key={d.documentId}>
                  <TableCell primary>
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText weight="light" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-foreground font-medium">
                        {d.fileName ?? "Untitled"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {d.documentType
                      ? (DOCUMENT_TYPE_LABEL[d.documentType] ?? titleizeEnum(d.documentType))
                      : "-"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {d.kycCategory ? (
                      <Badge variant="outline">
                        {KYC_CATEGORY_LABEL[d.kycCategory] ?? titleizeEnum(d.kycCategory)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell nums text-muted-foreground" numeric>
                    {fmtBytes(d.sizeBytes)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {d.isMnpi ? (
                        <Badge variant="down" icon={<LockSimple weight="light" />}>
                          MNPI
                        </Badge>
                      ) : null}
                      {d.isConfidential ? (
                        <Badge variant="gold">Confidential</Badge>
                      ) : null}
                      {!d.isMnpi && !d.isConfidential ? (
                        <span className="text-muted-foreground/50">-</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell nums text-muted-foreground">
                    {fmtDate(d.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ContactsList({ contacts }: { contacts: ClientContactRow[] }) {
  return (
    <div className="px-1 pb-2 pt-1">
      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users weight="light" />}
          title="No contacts on file."
          hint="The client's primary people will appear here."
        />
      ) : (
        <ul className="divide-y divide-hairline">
          {contacts.map((c) => (
            <li key={c.contactId} className="flex items-start gap-3 px-4 py-3.5">
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-hairline bg-foreground/[0.03] text-muted-foreground [&_svg]:size-4">
                <Users weight="light" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13.5px] font-medium text-foreground">
                    {c.fullName}
                  </span>
                  {c.isPrimary ? (
                    <Badge variant="emerald" dot>
                      Primary
                    </Badge>
                  ) : null}
                </div>
                <span className="text-[11.5px] text-muted-foreground">
                  {c.role ? titleizeEnum(c.role) : ""}
                  {c.designation ? ` · ${c.designation}` : ""}
                </span>
                <div className="mt-0.5 flex flex-col gap-0.5 text-[11.5px] text-muted-foreground">
                  {c.primaryEmail ? (
                    <span className="nums truncate">{c.primaryEmail}</span>
                  ) : null}
                  {c.primaryPhone ? (
                    <span className="nums tabular-nums">{c.primaryPhone}</span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KycHistoryTable({ rows }: { rows: ClientKycRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Initiated</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden lg:table-cell">Risk</TableHead>
              <TableHead className="hidden md:table-cell">Valid until</TableHead>
              <TableHead className="hidden lg:table-cell">Approved</TableHead>
              <TableHead className="hidden xl:table-cell" align="right">
                Highest BO
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty
                icon={<ShieldCheck weight="light" />}
                title="No KYC records."
                hint="KYC history will appear here once records are created."
              />
            ) : (
              rows.map((r, idx) => (
                <TableRow key={r.kycRecordId}>
                  <TableCell className="nums text-muted-foreground">
                    {fmtDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={kycVariant(r.status)}>
                        {titleizeEnum(r.status)}
                      </Badge>
                      {idx === 0 ? (
                        <Badge variant="outline">Latest</Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {titleizeEnum(r.kycType)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {r.riskRating ? (
                      <Badge
                        variant={
                          r.riskRating === "high"
                            ? "down"
                            : r.riskRating === "medium"
                              ? "gold"
                              : "emerald"
                        }
                      >
                        {titleizeEnum(r.riskRating)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell nums text-muted-foreground">
                    {fmtDate(r.validUntil)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell nums text-muted-foreground">
                    {fmtDate(r.approvedAt)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell" numeric>
                    {r.highestBoOwnershipPct == null ? (
                      <CellEmpty label="No BO" />
                    ) : (
                      <Num
                        value={r.highestBoOwnershipPct}
                        format={(n) => `${n.toFixed(2)}%`}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
