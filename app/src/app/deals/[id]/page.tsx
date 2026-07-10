import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";

import {
  ArrowLeft,
  ArrowUpRight,
  Handshake,
  Buildings,
  User,
  CalendarBlank,
  Clock,
  Target,
  Coins,
  Star,
  CheckCircle,
} from "@/components/brand/icons";
import { can, requireUser, type CrmUser } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { db } from "@/db";
import { appUser, deal, dealParty, party } from "@/db/schema";
import { dealTypeSpec } from "@/features/deals/catalog";
import { stageLadderFor } from "@/features/deals/stages";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Reveal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  Money,
  PreviewPane,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import { DealTypeGlyph, PartyRoleGlyph } from "../deal-type-icon";
import { creditBand } from "../deal-type-credit";

// Deal detail - the destination for every /deals/:id inbound link (the
// dashboard's recent-deals table, the recent-activity rail, the lead-win
// "Open deal" CTA, the lead detail's "Open mandate"). The deals board keeps
// its own inline inspector for quick-look; this page is the canonical,
// shareable, full-depth view of a single mandate.
//
// force-dynamic: the page reads the deal + its roster at request time.
export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; dot?: boolean }> = {
  lead: { variant: "neutral" },
  mandated: { variant: "emerald", dot: true },
  in_dd: { variant: "emerald", dot: true },
  structuring: { variant: "emerald", dot: true },
  rating_marketing: { variant: "info" },
  pricing: { variant: "gold", dot: true },
  allocation: { variant: "gold", dot: true },
  settled: { variant: "emerald", dot: true },
  closed: { variant: "emerald", dot: true },
  on_hold: { variant: "outline" },
  dropped: { variant: "down" },
};

function pretty(s: string | null | undefined): string {
  if (!s) return "-";
  return s.replace(/_/g, " ");
}

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

function fmtDateTime(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dealVisibilityScope(user: CrmUser): SQL {
  if (can(user, "read_all", "deal") || can(user, "manage", "user")) {
    return sql`TRUE`;
  }

  const userId = user.appUserId;
  if (!userId) return sql`FALSE`;

  return sql`(
    ${deal.leadUserId} = ${userId}
    OR ${deal.creditAnalystUserId} = ${userId}
    OR ${deal.createdByUserId} = ${userId}
    OR EXISTS (
      SELECT 1
      FROM ${dealParty} dp
      INNER JOIN ${party} p ON p.party_id = dp.party_id
      WHERE dp.deal_id = ${deal.dealId}
        AND dp.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND (
          p.assigned_user_id = ${userId}
          OR p.data_owner_user_id = ${userId}
          OR p.created_by_user_id = ${userId}
        )
    )
  )`;
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const dealRow = await db
    .select()
    .from(deal)
    .where(and(eq(deal.dealId, id), isNull(deal.deletedAt), dealVisibilityScope(user)))
    .then((rs) => rs[0] ?? null);

  if (!dealRow) notFound();

  // Load linked parties only after the scoped deal query succeeds, so an
  // inaccessible mandate never exposes its roster through this route.
  const partyRows = await db
    .select({
      dealPartyId: dealParty.dealPartyId,
      partyId: dealParty.partyId,
      role: dealParty.role,
      isLead: dealParty.isLead,
      commitmentAmount: dealParty.commitmentAmount,
      legalName: party.legalName,
      partyNature: party.partyNature,
    })
    .from(dealParty)
    .innerJoin(party, eq(party.partyId, dealParty.partyId))
    .where(and(eq(dealParty.dealId, id), isNull(dealParty.deletedAt)))
    .orderBy(asc(dealParty.createdAt));

  const leadRow = dealRow.leadUserId
    ? await db
        .select({ email: appUser.email })
        .from(appUser)
        .where(eq(appUser.userId, dealRow.leadUserId))
        .then((rs) => rs[0] ?? null)
    : null;

  const spec = dealTypeSpec(dealRow.dealType);
  const ladder = stageLadderFor(dealRow.dealType);
  const band = creditBand(dealRow.dealType);
  const statusKey = dealRow.status ?? "unknown";
  const sb = STATUS_BADGE[statusKey] ?? { variant: "neutral" as BadgeProps["variant"] };
  const targetSizeNum = dealRow.targetSize ? Number(dealRow.targetSize) : null;
  const tenorNum = dealRow.targetTenorYears ? Number(dealRow.targetTenorYears) : null;

  // Sort parties: lead first, then by role then name.
  const parties = [...partyRows].sort((a, b) => {
    if (a.isLead && !b.isLead) return -1;
    if (!a.isLead && b.isLead) return 1;
    if (a.role < b.role) return -1;
    if (a.role > b.role) return 1;
    return a.legalName.localeCompare(b.legalName);
  });
  const totalCommitment = partyRows.reduce(
    (acc, p) => acc + (p.commitmentAmount ? Number(p.commitmentAmount) : 0),
    0,
  );

  const titleName =
    dealRow.dealName && dealRow.dealCode && dealRow.dealName !== dealRow.dealCode
      ? dealRow.dealName
      : dealRow.dealName ?? dealRow.dealCode ?? dealRow.dealId;

  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/deals"
        backLabel="Deals"
        crumb={dealRow.dealCode ?? dealRow.dealId.slice(0, 8)}
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/deals">Deal board</Link>
          </Button>
        }
      />
      <PageHeader
        title={titleName}
        description={`${spec.label} · ${dealRow.dealCode ?? dealRow.dealId.slice(0, 8)}`}
      />

      {/* Identity header - PreviewPane frames the deal-type disc + the machined
          deal code + status/credit/brand badges. The mandate NAME lives in the
          editorial opener above; the pane carries the machined identifier + the
          meta readout (target size / close / tenor / lead). */}
      <Reveal y={14} duration={0.6}>
        <PreviewPane
          sticky={false}
          className="mb-8"
          type={`Mandate · ${spec.label}`}
          name={dealRow.dealCode ?? dealRow.dealId.slice(0, 8)}
          mark={<DealTypeGlyph dealType={dealRow.dealType} size={24} />}
          badges={
            <>
              <Badge variant={sb.variant} dot={sb.dot}>
                {pretty(dealRow.status)}
              </Badge>
              {band ? (
                <Badge
                  variant={
                    band.tone === "down"
                      ? "down"
                      : band.tone === "gold"
                        ? "gold"
                        : "emerald"
                  }
                >
                  {band.code}
                </Badge>
              ) : null}
              <Badge variant="outline" icon={<Buildings weight="light" />}>
                {pretty(dealRow.brand)}
              </Badge>
            </>
          }
          footer={
            <div className="flex items-center justify-end gap-1.5 text-[11.5px] text-muted-foreground">
              <CalendarBlank weight="light" className="size-3.5 text-muted-foreground/70" />
              <span className="nums tabular-nums">
                Opened {fmtDate(dealRow.createdAt ?? null)}
              </span>
            </div>
          }
        >
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline/60 sm:grid-cols-4">
            <MetaCell
              label="Target size"
              value={
                targetSizeNum != null && Number.isFinite(targetSizeNum) ? (
                  <Money value={targetSizeNum} currency={dealRow.currencyCode ?? "INR"} compact />
                ) : (
                  "-"
                )
              }
              icon={<Target weight="light" className="size-3.5" />}
            />
            <MetaCell
              label="Target close"
              value={fmtDate(dealRow.targetCloseDate ?? null)}
              icon={<CalendarBlank weight="light" className="size-3.5" />}
            />
            <MetaCell
              label="Tenor"
              value={tenorNum != null && Number.isFinite(tenorNum) ? `${tenorNum.toFixed(1)}y` : "-"}
              icon={<Clock weight="light" className="size-3.5" />}
            />
            <MetaCell
              label="Lead"
              value={leadRow?.email ?? "-"}
              icon={<User weight="light" className="size-3.5" />}
            />
          </div>
        </PreviewPane>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left rail - stage ladder */}
        <Reveal y={16} duration={0.6} className="lg:col-span-1">
          <Card className="h-full overflow-hidden">
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <div className="space-y-1">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                  Stage ladder
                </h2>
                <p className="text-[12.5px] text-muted-foreground">{spec.label}</p>
              </div>
              <StageLadder ladder={ladder} current={statusKey} />
              {dealRow.actualCloseDate ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald/[0.06] px-3.5 py-2.5 text-[12.5px] text-emerald ring-1 ring-emerald/25">
                  <CheckCircle weight="light" className="size-4" />
                  <span>
                    Closed{" "}
                    <span className="nums tabular-nums">
                      {fmtDate(dealRow.actualCloseDate)}
                    </span>
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        </Reveal>

        {/* Right - linked parties + readout */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Reveal y={16} duration={0.6}>
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-4 p-5 md:p-6">
                <div className="space-y-1">
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    Terms
                  </h2>
                  <p className="text-[12.5px] text-muted-foreground">
                    Target size, close, tenor and credit character for this deal type.
                  </p>
                </div>
                <DL>
                  <DT>Deal type</DT>
                  <DD>{spec.label}</DD>
                  <DT>Brand</DT>
                  <DD>{pretty(dealRow.brand)}</DD>
                  <DT>Currency</DT>
                  <DD mono>{dealRow.currencyCode ?? "-"}</DD>
                  <DT>Target size</DT>
                  <DD mono>
                    {targetSizeNum != null && Number.isFinite(targetSizeNum) ? (
                      <Money value={targetSizeNum} currency={dealRow.currencyCode ?? "INR"} compact />
                    ) : (
                      "-"
                    )}
                  </DD>
                  <DT>Target close</DT>
                  <DD mono>{fmtDate(dealRow.targetCloseDate ?? null)}</DD>
                  <DT>Tenor</DT>
                  <DD mono>
                    {tenorNum != null && Number.isFinite(tenorNum)
                      ? `${tenorNum.toFixed(1)} years`
                      : "-"}
                  </DD>
                  <DT>Actual close</DT>
                  <DD mono>{fmtDate(dealRow.actualCloseDate ?? null)}</DD>
                  <DT>Lead user</DT>
                  <DD>{leadRow?.email ?? "-"}</DD>
                  <DT>Opened</DT>
                  <DD mono>{fmtDateTime(dealRow.createdAt ?? null)}</DD>
                </DL>
              </div>
            </Card>
          </Reveal>

          <Reveal y={16} duration={0.6}>
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
                <div className="space-y-1">
                  <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    Linked parties
                  </h2>
                  <p className="text-[12.5px] text-muted-foreground">
                    Issuers, investors, arrangers, trustees and counsel on the mandate.
                  </p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow className="[&>th]:px-5">
                    <TableHead>Party</TableHead>
                    <TableHead className="hidden md:table-cell">Nature</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">
                      Commitment
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parties.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={4} className="p-0">
                        <TableEmpty
                          icon={<Handshake weight="light" />}
                          title="No parties linked yet."
                          hint="Issuers, investors and arrangers are attached via the matching engine, the lead-win flow, or directly on the deal board."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    parties.map((p) => (
                      <TableRow
                        key={p.dealPartyId}
                        className="[&>td]:px-5 [&>td]:py-4"
                      >
                        <TableCell primary>
                          <Link
                            href={`/parties/${p.partyId}`}
                            className="inline-flex items-center gap-2 transition-colors duration-200 ease-soft hover:text-emerald"
                          >
                            {p.isLead ? (
                              <Star
                                weight="fill"
                                aria-label="Lead"
                                className="size-3.5 shrink-0 text-gold"
                              />
                            ) : null}
                            <span title={p.legalName} className="line-clamp-2 break-words">
                              {p.legalName}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <span className="text-foreground/70">
                            {pretty(p.partyNature)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <PartyRoleGlyph role={p.role} size={16} lead={false} />
                            <Badge variant="neutral">{pretty(p.role)}</Badge>
                          </span>
                        </TableCell>
                        <TableCell numeric className="hidden md:table-cell">
                          {p.commitmentAmount ? (
                            <Money
                              value={Number(p.commitmentAmount)}
                              currency={dealRow.currencyCode ?? "INR"}
                              compact
                            />
                          ) : (
                            <span className="text-muted-foreground/60">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              {parties.length > 0 && totalCommitment > 0 ? (
                <div className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-3.5 text-[12.5px] md:px-6">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Coins weight="light" className="size-3.5" />
                    Indicated total
                  </span>
                  <span className="nums tabular-nums font-medium text-foreground">
                    <Money
                      value={totalCommitment}
                      currency={dealRow.currencyCode ?? "INR"}
                      compact
                    />
                  </span>
                </div>
              ) : null}
            </Card>
          </Reveal>
        </div>
      </div>
    </PageShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Stage ladder - the per-type pipeline with the current notch highlighted.
   Server-safe; mirrors the deals-board-view treatment.
   ────────────────────────────────────────────────────────────────────── */

function StageLadder({
  ladder,
  current,
}: {
  ladder: readonly string[];
  current: string;
}) {
  const currentIdx = ladder.indexOf(current);
  return (
    <ol role="list" className="flex flex-col gap-1.5">
      {ladder.map((stage, i) => {
        const isCurrent = stage === current;
        const isDone = currentIdx > -1 && i < currentIdx;
        const isPast = currentIdx > -1 && i > currentIdx;
        const tone = isCurrent
          ? "bg-emerald/12 ring-emerald/40 text-foreground"
          : isDone
            ? "bg-emerald/[0.04] ring-emerald/20 text-foreground/80"
            : isPast
              ? "bg-foreground/[0.02] ring-hairline/50 text-muted-foreground/60"
              : "bg-foreground/[0.02] ring-hairline/50 text-muted-foreground";
        return (
          <li key={stage} className="flex items-center gap-2.5">
            <span
              className={cn(
                "inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-1 transition-colors duration-200 ease-soft",
                isCurrent
                  ? "bg-emerald text-on-emerald ring-emerald/50"
                  : isDone
                    ? "bg-emerald/15 text-emerald ring-emerald/30"
                    : "bg-foreground/[0.04] text-muted-foreground/60 ring-hairline/60",
              )}
            >
              {isCurrent ? (
                <span className="nums text-[10px] font-bold tabular-nums text-on-emerald">
                  {i + 1}
                </span>
              ) : isDone ? (
                <CheckCircle weight="light" className="size-3.5" />
              ) : (
                <span className="nums text-[10px] tabular-nums">{i + 1}</span>
              )}
            </span>
            <span
              className={cn(
                "flex-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium ring-1",
                tone,
              )}
            >
              {pretty(stage)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Local presentational helpers - mirror the KYC detail page's DL/DT/DD +
   MetaCell so the readout reads as one machined instrument.
   ────────────────────────────────────────────────────────────────────── */

function MetaCell({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-surface px-4 py-3.5">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span className="text-muted-foreground/70 [&_svg]:size-3.5">{icon}</span>
        {label}
      </span>
      <span className="nums tabular-nums text-[13.5px] font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}

function DL({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {children}
    </dl>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:pt-0.5">
      {children}
    </dt>
  );
}

function DD({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <dd
      className={cn(
        "text-[13.5px] text-foreground/85",
        mono && "nums tabular-nums",
      )}
    >
      {children}
    </dd>
  );
}
