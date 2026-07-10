import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Buildings,
  ChartLineUp,
  Coins,
  CoinVertical,
  Eye,
  Hash,
  IdentificationCard,
  ShieldCheck,
  TrendUp,
} from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import {
  getInvestorDetail,
  PORTAL_ENUM_LABELS,
} from "@/features/portal";
import type {
  InvestorAllocationHistoryRow,
  InvestorDematAccount,
  InvestorHolding,
  InvestorKyc,
} from "@/features/portal";
import { InvestorComposition, InvestorTopIssuers } from "./investor-charts";
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

function kycVariant(status: string | null): BadgeProps["variant"] {
  if (!status) return "outline";
  if (status === "approved") return "emerald";
  if (status === "rejected" || status === "expired") return "down";
  return "info";
}

function dealTypeLabel(t: string): string {
  return titleizeEnum(t);
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  indication: "Indication",
  order: "Order",
  revised_order: "Revised order",
  allocated: "Allocated",
  withdrawn: "Withdrawn",
  oversubscribed_adjusted: "Oversubscr. adj.",
  settled: "Settled",
};

function eventTypeBadge(t: string): { variant: BadgeProps["variant"]; label: string } {
  const label = EVENT_TYPE_LABEL[t] ?? titleizeEnum(t);
  if (t === "allocated" || t === "settled")
    return { variant: "emerald", label };
  if (t === "withdrawn") return { variant: "down", label };
  if (t === "oversubscribed_adjusted") return { variant: "gold", label };
  return { variant: "info", label };
}

const NATURE_LABEL: Record<string, string> = {
  organization: "Organization",
  natural_person: "Natural person",
  spv: "Special Purpose Vehicle",
  trust: "Trust",
  government: "Government",
  regulator: "Regulator",
};

export default async function InvestorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getInvestorDetail(id, user);
  if (!detail) notFound();

  const {
    party,
    holdings,
    allocationHistory,
    dematAccounts,
    kyc,
    bySector,
    byRating,
    byTenor,
    byIssuer,
    summary,
  } = detail;

  const pan = party.identifiers.find((i) => i.type === "PAN");
  const lei = party.identifiers.find((i) => i.type === "LEI");
  const hasBook = holdings.length > 0;

  return (
    <PageShell>
      {/* Breadcrumb + back to the directory. */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Link
            href="/portal/investor"
            className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-soft hover:text-foreground"
          >
            <ArrowLeft weight="light" className="size-3.5" />
            Investor portal
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="nums text-foreground/60">{party.partyId.slice(0, 8)}</span>
        </nav>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground ring-1 ring-hairline">
          <Eye weight="light" className="size-3.5" />
          Read-only
        </span>
      </div>

      {/* Header - the investor identity. Renders VISIBLE on mount. */}
      <PreviewPane
        sticky={false}
        className="mb-8"
        type={`Investor · ${NATURE_LABEL[party.partyNature] ?? party.partyNature}`}
        name={party.legalName}
        mark={
          <span className="inline-flex size-11 items-center justify-center rounded-full ring-1 ring-gold/22 bg-gold/[0.06] text-gold/85 [&_svg]:size-6">
            <Coins weight="light" />
          </span>
        }
        badges={
          <>
            <Badge variant={party.status === "active" ? "emerald" : "outline"}>
              {titleizeEnum(party.status)}
            </Badge>
            {kyc ? (
              <Badge variant={kycVariant(kyc.status)}>
                KYC · {titleizeEnum(kyc.status)}
              </Badge>
            ) : (
              <Badge variant="outline">No KYC</Badge>
            )}
            {party.isListed ? (
              <Badge variant="info">
                Listed{party.listingExchange ? ` · ${party.listingExchange}` : ""}
              </Badge>
            ) : null}
            <Badge variant="gold">
              Portfolio · {compactINR(summary.totalValueCr * 1e7)}
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
              {summary.holdingCount.toLocaleString("en-IN")}{" "}
              {summary.holdingCount === 1 ? "holding" : "holdings"} ·{" "}
              {summary.issuerCount.toLocaleString("en-IN")}{" "}
              {summary.issuerCount === 1 ? "issuer" : "issuers"}
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
            label="LEI"
            value={lei?.value ?? "-"}
            mono
            icon={<Hash weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="KYC risk"
            value={titleizeEnum(party.kycRiskRating)}
            icon={<ShieldCheck weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="Brand"
            value={titleizeEnum(party.brandOrigin)}
            icon={<Buildings weight="light" className="size-3.5" />}
          />
        </div>
      </PreviewPane>

      {/* KPI row - the portfolio at a glance. */}
      <Reveal y={10} duration={0.55} noBlur>
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Portfolio value"
            value={summary.totalValueCr * 1e7}
            preset="currency"
            icon={<Coins weight="light" />}
            tone="gold"
          />
          <StatCard
            label="Weighted-avg yield"
            value={summary.weightedAvgYieldPct ?? 0}
            display={
              summary.weightedAvgYieldPct == null
                ? "-"
                : `${summary.weightedAvgYieldPct.toFixed(2)}%`
            }
            icon={<TrendUp weight="light" />}
          />
          <StatCard
            label="Holdings"
            value={summary.holdingCount}
            preset="int"
            icon={<ChartLineUp weight="light" />}
          />
          <StatCard
            label="Demat accounts"
            value={summary.dematCount}
            preset="int"
            icon={<CoinVertical weight="light" />}
          />
        </div>
      </Reveal>

      {hasBook ? (
        <>
          {/* Portfolio composition - donut by sector + bars by rating / tenor.
              Rendered via a client component because the recharts wrappers take
              a `compactValue` formatter function (functions cannot cross the
              RSC boundary). */}
          <Reveal y={12} duration={0.55} noBlur>
            <div className="mb-8">
              <InvestorComposition
                bySector={bySector}
                byRating={byRating}
                byTenor={byTenor}
              />
            </div>
          </Reveal>

          {/* Top issuers (concentration) + demat accounts side by side. The top-
              issuers chart is a client component (compactValue formatter); the
              demat table is server-rendered. */}
          <Reveal y={12} duration={0.55} noBlur>
            <div className="mb-8 grid grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <InvestorTopIssuers byIssuer={byIssuer} />
              </div>
              <div className="lg:col-span-5">
                <ChartCard
                  title="Demat accounts"
                  description="Depository accounts the investor settles into."
                >
                  <DematTable accounts={dematAccounts} />
                </ChartCard>
              </div>
            </div>
          </Reveal>

          {/* Holdings - the bond book. */}
          <Reveal y={12} duration={0.55} noBlur>
            <div className="mb-8">
              <SectionHeading
                eyebrow="Bond holdings"
                title="The book"
                description="Allocated and settled positions, with the issuer, instrument, rating, coupon, maturity and the demat account each holding settles into."
                className="mb-4 !flex-row"
                display
              />
              <HoldingsTable holdings={holdings} />
            </div>
          </Reveal>
        </>
      ) : (
        <Reveal y={12} duration={0.55} noBlur>
          <div className="mb-8">
            <EmptyState
              icon={<Coins weight="light" />}
              title="No holdings on the book yet."
              hint="This investor has no allocated or settled positions. Allocation events will appear here once Binary places paper for them."
              tone="gold"
            />
          </div>
        </Reveal>
      )}

      {/* Allocation history - the full placement trail. */}
      <Reveal y={12} duration={0.55} noBlur>
        <div className="mb-8">
          <SectionHeading
            eyebrow="Placement trail"
            title="Allocation history"
            description="Every allocation event - indications, orders, revisions, allocations and settlements - newest first."
            className="mb-4 !flex-row"
            display
          />
          <AllocationHistoryTable rows={allocationHistory} />
        </div>
      </Reveal>

      {/* KYC snapshot. */}
      <Reveal y={12} duration={0.55} noBlur>
        <KycSnapshot kyc={kyc} />
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

function HoldingsTable({ holdings }: { holdings: InvestorHolding[] }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Issuer / Instrument</TableHead>
              <TableHead className="hidden md:table-cell">Deal</TableHead>
              <TableHead className="hidden lg:table-cell">Rating</TableHead>
              <TableHead className="hidden xl:table-cell" align="right">
                Coupon
              </TableHead>
              <TableHead className="hidden lg:table-cell">Maturity</TableHead>
              <TableHead align="right">Allocated</TableHead>
              <TableHead className="hidden md:table-cell" align="right">
                Yield
              </TableHead>
              <TableHead className="hidden xl:table-cell">Demat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.length === 0 ? (
              <TableEmpty
                icon={<Coins weight="light" />}
                title="No holdings."
                hint="Allocated and settled positions will appear here."
              />
            ) : (
              holdings.map((h) => (
                <TableRow key={h.allocationEventId}>
                  <TableCell primary>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground font-medium">
                        {h.issuerName ?? "-"}
                      </span>
                      <span className="nums text-[11.5px] tabular-nums text-muted-foreground">
                        {h.isin ?? "No ISIN"}
                        {h.instrumentType
                          ? ` · ${titleizeEnum(h.instrumentType)}`
                          : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-foreground/80">
                        {h.dealName ?? h.dealCode ?? "-"}
                      </span>
                      <span className="nums text-[11.5px] tabular-nums text-muted-foreground">
                        {h.dealCode ?? "-"} · {dealTypeLabel(h.dealType)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {h.ratingValue ? (
                      <Badge variant="outline">{h.ratingValue}</Badge>
                    ) : (
                      <CellEmpty label="Unrated" />
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell" numeric>
                    {h.couponPct == null ? (
                      <CellEmpty label="No coupon" />
                    ) : (
                      <Num value={h.couponPct} format={(n) => `${n.toFixed(2)}%`} />
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell nums text-muted-foreground">
                    {fmtDate(h.maturityDate)}
                  </TableCell>
                  <TableCell numeric>
                    <Money value={h.amount} compact />
                  </TableCell>
                  <TableCell className="hidden md:table-cell" numeric>
                    {h.yieldPct == null ? (
                      <CellEmpty label="No yield" />
                    ) : (
                      <Num value={h.yieldPct} format={(n) => `${n.toFixed(2)}%`} />
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    {h.dpId && h.clientId ? (
                      <span className="nums tabular-nums text-[12px] text-muted-foreground">
                        {h.dpId}-{h.clientId}
                        {h.depository ? ` · ${h.depository}` : ""}
                      </span>
                    ) : (
                      <CellEmpty label="No demat" />
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

function AllocationHistoryTable({
  rows,
}: {
  rows: InvestorAllocationHistoryRow[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell">
      <div className="overflow-hidden rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <Table density="comfortable">
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead className="hidden md:table-cell">Issuer</TableHead>
              <TableHead>Event</TableHead>
              <TableHead align="right">Amount</TableHead>
              <TableHead className="hidden sm:table-cell" align="right">
                Yield
              </TableHead>
              <TableHead className="hidden lg:table-cell" align="right">
                Price
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty
                icon={<ChartLineUp weight="light" />}
                title="No allocation events."
                hint="The placement trail will appear here once allocations are recorded."
              />
            ) : (
              rows.map((r) => {
                const eb = eventTypeBadge(r.eventType);
                return (
                  <TableRow key={r.allocationEventId}>
                    <TableCell className="nums text-muted-foreground">
                      {fmtDate(r.eventAt)}
                    </TableCell>
                    <TableCell primary>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-foreground font-medium">
                          {r.dealName ?? r.dealCode ?? "-"}
                        </span>
                        <span className="nums text-[11.5px] tabular-nums text-muted-foreground">
                          {r.dealCode ?? "-"} · {dealTypeLabel(r.dealType)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {r.issuerName ?? "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={eb.variant}>{eb.label}</Badge>
                    </TableCell>
                    <TableCell numeric>
                      <Money value={r.amount} compact />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell" numeric>
                      {r.yieldPct == null ? (
                        <CellEmpty label="No yield" />
                      ) : (
                        <Num value={r.yieldPct} format={(n) => `${n.toFixed(2)}%`} />
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell" numeric>
                      {r.price == null ? (
                        <CellEmpty label="No price" />
                      ) : (
                        <Num value={r.price} format={(n) => n.toFixed(3)} />
                      )}
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

function DematTable({
  accounts,
}: {
  accounts: InvestorDematAccount[];
}) {
  return (
    <div className="px-1 pb-2 pt-1">
      {accounts.length === 0 ? (
        <EmptyState
          icon={<CoinVertical weight="light" />}
          title="No demat accounts."
          hint="Depository accounts will appear here once linked."
        />
      ) : (
        <Table density="compact">
          <TableHeader>
            <TableRow>
              <TableHead>DP ID</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead className="hidden sm:table-cell">Depository</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.dematAccountId}>
                <TableCell numeric>
                  <span className="nums tabular-nums text-[12.5px] text-foreground/90">
                    {a.dpId}
                  </span>
                </TableCell>
                <TableCell numeric>
                  <span className="nums tabular-nums text-[12.5px] text-foreground/90">
                    {a.clientId}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground">
                  {a.depository}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      a.accountStatus === "active"
                        ? "emerald"
                        : a.accountStatus === "frozen" || a.accountStatus === "suspended"
                          ? "down"
                          : "outline"
                    }
                  >
                    {titleizeEnum(a.accountStatus)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function KycSnapshot({ kyc }: { kyc: InvestorKyc | null }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-foreground/[0.055] p-1.5 ring-1 ring-hairline shadow-shell">
      <div className="rounded-[calc(var(--radius-2xl)-0.375rem)] bg-surface ring-1 ring-inset ring-foreground/[0.08]">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-full ring-1 ring-hairline bg-foreground/[0.03] text-muted-foreground [&_svg]:size-5">
              <ShieldCheck weight="light" />
            </span>
            <div className="flex flex-col gap-0.5">
              <Eyebrow>Know-your-customer</Eyebrow>
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                {kyc ? titleizeEnum(kyc.status) : "No KYC on file"}
              </span>
            </div>
          </div>
          {kyc ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              <KycField label="Type" value={titleizeEnum(kyc.kycType)} />
              <KycField label="Risk" value={titleizeEnum(kyc.riskRating)} />
              <KycField label="Valid until" value={fmtDate(kyc.validUntil)} />
              <KycField label="Approved" value={fmtDate(kyc.approvedAt)} />
              <KycField
                label="Highest BO"
                value={
                  kyc.highestBoOwnershipPct == null
                    ? "-"
                    : `${kyc.highestBoOwnershipPct.toFixed(2)}%`
                }
              />
              <KycField
                label="Funds verified"
                value={kyc.sourceOfFundsVerified ? "Yes" : "No"}
              />
              <KycField
                label="Wealth verified"
                value={kyc.sourceOfWealthVerified ? "Yes" : "No"}
              />
              <KycField label="Initiated" value={fmtDate(kyc.createdAt)} />
            </div>
          ) : (
            <span className="text-[13px] text-muted-foreground">
              No KYC record has been created for this investor.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KycField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="nums text-[13px] tabular-nums text-foreground/85">{value}</span>
    </div>
  );
}
