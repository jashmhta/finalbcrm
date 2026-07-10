import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  At,
  Briefcase,
  Buildings,
  CalendarBlank,
  Clock,
  Fingerprint,
  Graph,
  Hash,
  Link as LinkIcon,
  Phone,
  SealWarning,
  ShieldCheck,
  ShieldWarning,
  Sparkle,
  Star,
  Users,
} from "@/components/brand/icons";

import { requireUser, canReadAllInScope } from "@/lib/rbac";
import {
  getPartyDetail,
  listAssignableStaff,
} from "@/features/parties/queries";
import { cn } from "@/lib/utils";
import { AssignPartyForm } from "../assign-party-form";
import {
  Card,
  Badge,
  Button,
  ExposureGaugeMark,
  KycShieldMark,
  MandateMark,
  Reveal,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
} from "@/components/brand";
import { Eyebrow } from "@/components/brand/text";
import {
  PageShell,
  PageHeader,
  DetailTopBar,
} from "@/components/brand/page-shell";
import { Money, Num, compactINR } from "@/components/brand/money";
import { PartyAvatar } from "../party-icon";
import { RelationshipGraph } from "../relationship-graph";
import {
  BAND_LABEL,
  StrengthBar,
  deriveStrength,
  formatRelative,
} from "../party-signals";

export const dynamic = "force-dynamic";

/* ── helpers ────────────────────────────────────────────────────────────── */

const NATURE_LABEL: Record<string, string> = {
  organization: "Organization",
  natural_person: "Natural person",
  spv: "Special Purpose Vehicle",
  trust: "Trust",
  government: "Government",
  regulator: "Regulator",
};

const RISK_TONE: Record<string, "up" | "gold" | "down"> = {
  low: "up",
  medium: "gold",
  high: "down",
};

const BRAND_LABEL: Record<string, string> = {
  binarycapital: "Binary Capital",
  binarybonds: "Binary Bonds",
  shared: "Shared ledger",
};

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual entry",
  capital_markets_import: "Capital markets import",
  bond_desk_import: "Bond desk import",
  website_lead: "Website lead",
  broker_feed: "Broker feed",
};

function formatDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export default async function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getPartyDetail(id, user);
  if (!detail) notFound();

  const staff = canReadAllInScope(user)
    ? await listAssignableStaff(user)
    : [];

  const { party: p, types, contacts, relationships, deals } = detail;

  const activeContacts = contacts.length;
  const activeRelationships = relationships.length;
  const activeDeals = deals.length;
  const leadDeals = deals.filter((d) => d.isLead).length;
  const parentRels = relationships.filter((r) => r.direction === "parent").length;
  const childRels = relationships.filter((r) => r.direction === "child").length;

  const groupExposure = p.groupExposureInr ? Number(p.groupExposureInr) : null;
  const hasCreditData =
    groupExposure !== null ||
    p.isListed ||
    Boolean(p.listingExchange) ||
    Boolean(p.ticker) ||
    Boolean(p.crisilSectorCode);

  const kycRisk = p.kycRiskRating ?? null;
  const kycComplete = p.isKycComplete === true;
  const kycStale = p.isKycStale === true;

  // Relationship-strength + last-touch - the same display-only derivations the
  // explorer uses, so the detail header reads identically to the list row.
  const strength = deriveStrength({
    relationshipCount: activeRelationships,
    dealCount: activeDeals,
    contactCount: activeContacts,
    isKycComplete: kycComplete,
  });
  const lastTouch = formatRelative(p.updatedAt ?? p.createdAt);
  const primaryType = types[0]?.partyType ?? null;

  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/parties"
        backLabel="Parties"
        crumb={shortId(p.partyId)}
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/parties">All parties</Link>
          </Button>
        }
      />

      <PageHeader
        title={p.legalName}
        description={
          p.displayName
            ? `${p.displayName} · ${NATURE_LABEL[p.partyNature] ?? p.partyNature.replace(/_/g, " ")}`
            : NATURE_LABEL[p.partyNature] ?? p.partyNature.replace(/_/g, " ")
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {types.map((t) => (
              <Badge key={t.partyType} variant="neutral">
                {t.partyType.replace(/_/g, " ")}
              </Badge>
            ))}
            <Badge
              variant={p.status.toLowerCase() === "active" ? "emerald" : "neutral"}
              dot={p.status.toLowerCase() === "active"}
            >
              {p.status}
            </Badge>
            {kycComplete ? (
              <Badge variant="emerald" icon={<ShieldCheck weight="light" />}>
                KYC complete
              </Badge>
            ) : kycStale ? (
              <Badge variant="gold" icon={<ShieldWarning weight="light" />}>
                KYC stale
              </Badge>
            ) : (
              <Badge variant="outline" icon={<ShieldWarning weight="light" />}>
                KYC pending
              </Badge>
            )}
          </div>
        }
      />

      {staff.length > 0 ? (
        <Card className="mb-6">
          <div className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between md:p-5">
            <div>
              <p className="text-[12px] font-semibold tracking-wide text-muted-foreground">
                Ownership
              </p>
              <p className="mt-0.5 text-[13.5px] text-muted-foreground">
                Assign this party to a staff member. Creates a review task for
                them.
              </p>
            </div>
            <div className="w-full max-w-sm">
              <AssignPartyForm
                partyId={p.partyId}
                currentAssigneeId={p.assignedUserId}
                staff={staff}
              />
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 text-[12.5px] md:px-5">
          <MetaItem icon={<Fingerprint weight="light" />} label="Party ID">
            <span className="nums text-foreground/85">{shortId(p.partyId)}</span>
          </MetaItem>
          <MetaItem icon={<Buildings weight="light" />} label="Country">
            <span className="nums text-foreground/85">{p.countryOfIncorporation}</span>
          </MetaItem>
          {p.domicileState ? (
            <MetaItem icon={<Hash weight="light" />} label="Domicile">
              <span className="text-foreground/85">{p.domicileState}</span>
            </MetaItem>
          ) : null}
          <MetaItem icon={<CalendarBlank weight="light" />} label="Onboarded">
            <span className="text-foreground/85">{formatDate(p.createdAt)}</span>
          </MetaItem>
          <MetaItem icon={<Clock weight="light" />} label="Last touch">
            <span className="text-foreground/85">{lastTouch}</span>
          </MetaItem>
          {p.isListed ? (
            <MetaItem icon={<Buildings weight="light" />} label="Listing">
              <span className="text-foreground/85">
                {p.listingExchange ?? "Listed"}
              </span>
            </MetaItem>
          ) : null}
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Contacts" value={activeContacts} preset="int" icon={<Users weight="light" />} />
            <StatCard
              label="Relationships"
              value={activeRelationships}
              preset="int"
              icon={<Graph weight="light" />}
            />
            <StatCard label="Mandates" value={activeDeals} preset="int" icon={<Briefcase weight="light" />} />
            <StatCard
              label="Lead mandates"
              value={leadDeals}
              preset="int"
              tone="gold"
              icon={<Star weight="light" />}
            />
            <StatCard
              label="Group exposure"
              value={groupExposure ?? 0}
              preset="currency"
              icon={<Sparkle weight="light" />}
              display={groupExposure === null ? "-" : undefined}
            />
            <StatCard
              label="KYC risk"
              value={0}
              display={kycRisk ? kycRisk : kycComplete ? "clear" : "pending"}
              tone="default"
              icon={<ShieldCheck weight="light" />}
            >
              {kycRisk ? (
                <Badge variant={RISK_TONE[kycRisk] ?? "neutral"} dot>
                  {kycRisk} risk
                </Badge>
              ) : null}
            </StatCard>
      </div>

      <SectionBlock
        eyebrow="Ownership"
        icon={<Graph weight="light" />}
        title="Relationship graph"
        description="Parents, beneficial owners, and subsidiaries."
      >
        <RelationshipGraph
          partyId={p.partyId}
          legalName={p.legalName}
          centerSub={
            primaryType
              ? primaryType.replace(/_/g, " ")
              : (NATURE_LABEL[p.partyNature] ?? p.partyNature.replace(/_/g, " "))
          }
          centerMark={<PartyAvatar primaryType={primaryType} size={24} />}
          relationships={relationships}
          variant="full"
        />
      </SectionBlock>

      {/* ── Core identifiers ────────────────────────────────────────── */}
      <SectionReveal index={1}>
        <SectionBlock
          eyebrow="Identifiers"
          icon={<Fingerprint weight="light" />}
          title="Core identifiers"
          description="System keys, jurisdiction and listing attributes - the dedup backbone for this counterparty."
        >
          <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 ring-hairline sm:grid-cols-2 lg:grid-cols-3">
            <DefRow label="Party ID" value={<span className="nums uppercase tracking-[0.04em]">{p.partyId}</span>} />
            <DefRow label="Sequence" value={<span className="nums">{p.partySeq ?? "-"}</span>} />
            <DefRow label="Nature" value={NATURE_LABEL[p.partyNature] ?? p.partyNature.replace(/_/g, " ")} />
            <DefRow label="Status" value={<span className="capitalize">{p.status}</span>} />
            <DefRow label="Country" value={<span className="nums">{p.countryOfIncorporation}</span>} />
            {p.domicileState ? <DefRow label="Domicile state" value={p.domicileState} /> : null}
            <DefRow
              label="Listed"
              value={p.isListed ? `Yes · ${p.listingExchange ?? "-"}` : "Unlisted"}
            />
            {p.ticker ? <DefRow label="Ticker" value={<span className="nums uppercase">{p.ticker}</span>} /> : null}
            {p.crisilSectorCode ? (
              <DefRow label="CRISIL sector" value={<span className="nums">{p.crisilSectorCode}</span>} />
            ) : null}
            <DefRow
              label="Brand origin"
              value={BRAND_LABEL[p.brandOrigin] ?? p.brandOrigin.replace(/_/g, " ")}
            />
            <DefRow
              label="Source"
              value={p.source ? SOURCE_LABEL[p.source] ?? p.source.replace(/_/g, " ") : "-"}
            />
            <DefRow label="Onboarded" value={formatDate(p.createdAt)} />
          </dl>
        </SectionBlock>
      </SectionReveal>

      {/* ── Contacts + relationships - z-axis split ─────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionReveal index={2}>
          <SectionCard
            eyebrow="People"
            icon={<Users weight="light" />}
            title="Contacts"
            description="People linked to this party via the party_contact junction."
            count={activeContacts}
          >
            <Table density="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {/* Role + Primary are secondary on phones - hidden < md so the
                      4-col contacts table collapses to Name + Email (the two a
                      mobile reader needs) without horizontal squish. */}
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead align="right" className="hidden md:table-cell">Primary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={4} className="p-0">
                      <TableEmpty
                        icon={<Users weight="light" />}
                        title="No contacts linked yet."
                        hint="Attach people to start building this party's relationship graph."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((c) => (
                    <TableRow key={c.partyContactId}>
                      <TableCell primary>
                        <div className="flex flex-col gap-0.5">
                          <span>{c.fullName}</span>
                          {c.designation ? (
                            <span className="text-[11px] font-normal text-muted-foreground">
                              {c.designation}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="neutral">{c.role.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell>
                        {c.primaryEmail ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground/75">
                            <At weight="light" className="size-3.5 text-muted-foreground/70" />
                            <span className="nums">{c.primaryEmail}</span>
                          </span>
                        ) : c.primaryPhone ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground/75">
                            <Phone weight="light" className="size-3.5 text-muted-foreground/70" />
                            <span className="nums">{c.primaryPhone}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell align="right" className="hidden md:table-cell">
                        {c.isPrimary ? (
                          <Star weight="fill" className="ml-auto size-4 text-gold" />
                        ) : (
                          <span className="text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>
        </SectionReveal>

        <SectionReveal index={3}>
          <SectionCard
            eyebrow="Hierarchy"
            icon={<Graph weight="light" />}
            title="Relationships"
            description="Parent / subsidiary edges and beneficial-ownership links."
            count={activeRelationships}
            footer={
              activeRelationships > 0 ? (
                <div className="flex items-center gap-4 text-[11.5px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-info/70" />
                    <Num value={parentRels} /> parent of
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                    <Num value={childRels} /> child of
                  </span>
                </div>
              ) : null
            }
          >
            <Table density="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead>Party</TableHead>
                  {/* Type is secondary on phones - hidden < md so the table
                      collapses to Direction + Party + Ownership. */}
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead align="right">Ownership</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationships.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={4} className="p-0">
                      <TableEmpty
                        icon={<Graph weight="light" />}
                        title="No relationships recorded."
                        hint="Link parent or subsidiary parties to map the ownership graph."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  relationships.map((r) => (
                    <TableRow key={r.relationshipId}>
                      <TableCell>
                        <Badge variant={r.direction === "parent" ? "info" : "neutral"}>
                          {r.direction === "parent" ? "parent of" : "child of"}
                        </Badge>
                      </TableCell>
                      <TableCell primary>
                        <Link
                          href={`/parties/${r.otherPartyId}`}
                          className="group/rel inline-flex items-center gap-1 transition-colors duration-200 ease-soft"
                        >
                          <span className="group-hover/rel:text-foreground">
                            {r.otherPartyName}
                          </span>
                          <ArrowUpRight
                            weight="light"
                            className="size-3.5 text-muted-foreground/60 transition-all duration-200 ease-soft group-hover/rel:translate-x-0.5 group-hover/rel:-translate-y-0.5 group-hover/rel:text-foreground"
                          />
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="neutral">{r.relationshipType.replace(/_/g, " ")}</Badge>
                      </TableCell>
                      <TableCell numeric>
                        {r.ownershipPct ? (
                          <span>
                            <Num value={Number(r.ownershipPct)} format={(n) => `${n.toFixed(1)}%`} />
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </SectionCard>
        </SectionReveal>
      </div>

      {/* ── Deals - full width ──────────────────────────────────────── */}
      <SectionReveal index={4} className="mt-6">
        <SectionCard
          eyebrow="Mandates"
          icon={<MandateMark size={16} tone="gold" />}
          title="Deals"
          description="Mandates this party appears in, via the deal_party junction."
          count={activeDeals}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deal</TableHead>
                {/* Type + Role are secondary on phones - hidden < md so the
                    5-col deals table collapses to Deal + Status + Lead. */}
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right">Lead</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={5} className="p-0">
                    <TableEmpty
                      icon={<Briefcase weight="light" />}
                      title="Not on any deals."
                      hint="This party has not yet been named on a mandate."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                deals.map((d) => (
                  <TableRow key={d.dealPartyId}>
                    <TableCell primary>
                      <Link
                        href="/deals"
                        className="group/deal inline-flex items-center gap-1.5 transition-colors duration-200 ease-soft"
                      >
                        <span className="group-hover/deal:text-foreground">
                          {d.dealCode ?? d.dealName ?? d.dealId}
                        </span>
                        {d.dealCode ? (
                          <span className="nums text-[11px] text-muted-foreground/60">
                            · {d.dealId.slice(0, 6)}
                          </span>
                        ) : null}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="neutral">{d.dealType.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">{d.role.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      {d.status ? (
                        <Badge
                          variant={d.status.toLowerCase() === "active" ? "emerald" : "neutral"}
                          dot={d.status.toLowerCase() === "active"}
                        >
                          {d.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {d.isLead ? (
                        <Badge variant="gold" icon={<Star weight="fill" />}>
                          Lead
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground/40">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionCard>
      </SectionReveal>

      {/* ── Credit + KYC - z-axis split ──────────────────────────────── */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionReveal index={5}>
          <SectionCard
            eyebrow="Credit"
            icon={<ExposureGaugeMark size={16} tone="emerald" />}
            title="Credit & exposure"
            description="Group-level exposure cache and listing attributes used by the credit workspace."
          >
            {hasCreditData ? (
              <div className="flex flex-col gap-5 p-5 md:p-6">
                <div className="flex flex-col gap-1.5">
                  <Eyebrow>Group exposure (INR)</Eyebrow>
                  <div className="flex items-baseline gap-2">
                    <Money
                      value={groupExposure}
                      compact
                      className="text-[clamp(1.8rem,1.3rem+1.4vw,2.4rem)] font-light leading-none tracking-[-0.02em] text-foreground"
                    />
                    {groupExposure !== null && groupExposure > 0 ? (
                      <span className="text-[12px] text-muted-foreground">
                        snapshot · recomputed by exposure job
                      </span>
                    ) : null}
                  </div>
                </div>
                <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 ring-hairline sm:grid-cols-2">
                  <DefRow label="Listed" value={p.isListed ? "Yes" : "Unlisted"} />
                  <DefRow label="Exchange" value={<span className="nums uppercase">{p.listingExchange ?? "-"}</span>} />
                  <DefRow label="Ticker" value={<span className="nums uppercase">{p.ticker ?? "-"}</span>} />
                  <DefRow label="CRISIL sector" value={<span className="nums">{p.crisilSectorCode ?? "-"}</span>} />
                </dl>
              </div>
            ) : (
              <TableEmpty
                icon={<Sparkle weight="light" />}
                title="No credit exposure recorded."
                hint="Group exposure, limits and external ratings will appear here once the credit workspace publishes them."
              />
            )}
          </SectionCard>
        </SectionReveal>

        <SectionReveal index={6}>
          <SectionCard
            eyebrow="Compliance"
            icon={<KycShieldMark size={16} tone="emerald" />}
            title="KYC"
            description="Trigger-maintained KYC state - completion, staleness and risk rating."
          >
            <div className="flex flex-col gap-5 p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                {kycComplete ? (
                  <Badge variant="emerald" icon={<ShieldCheck weight="light" />} dot>
                    KYC complete
                  </Badge>
                ) : (
                  <Badge variant="outline" icon={<ShieldWarning weight="light" />}>
                    KYC pending
                  </Badge>
                )}
                {kycStale ? (
                  <Badge variant="gold" icon={<SealWarning weight="light" />}>
                    Re-KYC due
                  </Badge>
                ) : null}
                {kycRisk ? (
                  <Badge variant={RISK_TONE[kycRisk] ?? "neutral"} dot>
                    {kycRisk} risk
                  </Badge>
                ) : null}
              </div>

              <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl ring-1 ring-hairline sm:grid-cols-2">
                <DefRow
                  label="Completion"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      {kycComplete ? (
                        <ShieldCheck weight="light" className="size-4 text-emerald" />
                      ) : (
                        <ShieldWarning weight="light" className="size-4 text-muted-foreground" />
                      )}
                      {kycComplete ? "Complete" : "Pending"}
                    </span>
                  }
                />
                <DefRow
                  label="Staleness"
                  value={kycStale ? "Stale - re-KYC due" : "Current"}
                />
                <DefRow
                  label="Risk rating"
                  value={
                    kycRisk ? (
                      <span className="capitalize">{kycRisk}</span>
                    ) : (
                      "Not assessed"
                    )
                  }
                />
                <DefRow
                  label="Onboarded"
                  value={<span className="nums">{formatDate(p.createdAt)}</span>}
                />
              </dl>

              <p className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
                <LinkIcon weight="light" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
                KYC state is trigger-maintained from <span className="nums">kyc_record</span> and
                beneficial-ownership edges; the highest BO ownership and re-KYC due date roll up
                here automatically.
              </p>
            </div>
          </SectionCard>
        </SectionReveal>
      </div>
    </PageShell>
  );
}

/* ── Section primitives ─────────────────────────────────────────────────── */

/**
 * SectionReveal - wraps each stacked section in a slightly staggered entry
 * tween. The incremental delay + small translate give the stacked double-bezel
 * sections their z-axis cadence: each plate settles a hair after the one above
 * it rather than the whole page firing at once.
 */
function SectionReveal({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  const delay = 0.04 * index;
  const y = 14 + Math.min(index, 3) * 2;
  return (
    <Reveal y={y} duration={0.6} delay={delay} noBlur className={className}>
      {children}
    </Reveal>
  );
}

function SectionCard({
  eyebrow,
  icon,
  title,
  description,
  count,
  footer,
  children,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  count?: number;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="h-full overflow-hidden">
      <div className="flex flex-col gap-1.5 px-5 pt-5 md:px-6 md:pt-6">
        <Eyebrow>
          <span className="[&_svg]:size-3.5 [&_svg]:text-muted-foreground/70">{icon}</span>
          {eyebrow}
        </Eyebrow>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.25rem] font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          {count !== undefined ? (
            <span className="nums tabular-nums text-[12.5px] text-muted-foreground">
              {count}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="text-[12.5px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
      {footer ? (
        <div className="border-t border-hairline px-5 py-3.5 md:px-6">{footer}</div>
      ) : null}
    </Card>
  );
}

function SectionBlock({
  eyebrow,
  icon,
  title,
  description,
  className,
  children,
}: {
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("mb-6 overflow-hidden", className)}>
      <div className="flex flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-0.5">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
            <span className="[&_svg]:size-3.5">{icon}</span>
            {eyebrow}
          </p>
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
          {description ? (
            <p className="text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </Card>
  );
}

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 bg-surface/40 px-4 py-3.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[13.5px] text-foreground/90">{value}</span>
    </div>
  );
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground/70 [&_svg]:size-4">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/85">{children}</span>
    </div>
  );
}
