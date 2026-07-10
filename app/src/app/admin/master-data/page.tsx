// Admin → Master data - read-only display of the firm's reference data:
//   • sector_code - the hierarchical sector taxonomy (NIC / RBI sectoral
//     deployment codes, segment class, level, active flag).
//   • rating_ladder - the cross-agency rating rank reference (CRISIL long
//     term scale in the seed; extensible to ICRA / CARE / etc.).
//   • deal_type / instrument_type / rating_agency - the Postgres enum value
//     lists that drive the deal/instrument/rating dropdowns across the CRM.
//
// Read-only for now (display the master data in tables). Edits will land in a
// future pass - the schema already supports soft-delete + updated_at on the
// reference tables. Gated to user:manage (admin role) since this is the
// admin's reference surface.

import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/rbac";
import {
  listSectorCodes,
  listRatingLadder,
  countDealsByType,
  DEAL_TYPES,
  INSTRUMENT_TYPES,
  RATING_AGENCIES,
  RATING_SCALES,
  type SectorCodeRow,
  type RatingLadderRow,
} from "@/features/admin/queries";
import {
  Reveal,
  Card,
  CardBody,
  Eyebrow,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
  RatingLadderMark,
} from "@/components/brand";
// CRITICAL (Next 16 / AGENTS.md): phosphor icons are imported through the
// `@/components/brand/icons` "use client" boundary, NEVER directly from
// `@phosphor-icons/react` in a server component. Phosphor calls createContext
// at module top-level, which crashes the RSC (server) environment.
import { Buildings, Handshake, Coins, SealCheck } from "@/components/brand/icons";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Master data · Admin · Binary Capital CRM",
};

export default async function AdminMasterDataPage() {
  const user = await requireUser();
  if (!can(user, "manage", "user")) redirect("/parties");

  const [sectors, ladder, dealTypeCounts] = await Promise.all([
    listSectorCodes(),
    listRatingLadder(),
    countDealsByType(),
  ]);

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
        title="Master data"
        description="The firm's reference catalogues - the sector taxonomy (NIC / RBI sectoral deployment), the cross-agency rating ladder, and the deal / instrument / rating-agency enum value lists that drive the dropdowns across the CRM. Read-only for now; edits land in a future pass."
      />
      </Reveal>

      <div className="flex flex-col gap-8">
        {/* ── Sector codes ─────────────────────────────────────────────── */}
        <MasterSection
          icon={<Buildings weight="light" />}
          eyebrow="Credit spec §13 · DATA_MODEL §2.23.11"
          title="Sector codes"
          description="Hierarchical sector taxonomy - dotted code paths (infra.roads, nbfc.gold_loan), NIC code, RBI sectoral deployment code, segment class, level. Drives credit-scorecard template routing + sectoral exposure."
          count={sectors.length}
        >
          <Card>
            <CardBody className="p-0">
              <Table density="compact">
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="hidden md:table-cell">NIC</TableHead>
                    <TableHead className="hidden lg:table-cell">RBI</TableHead>
                    <TableHead className="hidden md:table-cell">Class</TableHead>
                    <TableHead className="text-right">Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sectors.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={6} className="p-0">
                        <EmptyState
                          icon={<Buildings weight="light" />}
                          title="No sector codes."
                          hint="Run the seed script to provision the sector taxonomy."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    sectors.map((s) => (
                      <TableRow key={s.sectorCodeId}>
                        <TableCell>
                          <span className="nums font-medium tabular-nums text-foreground">
                            {s.code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-foreground">{s.label}</span>
                          {!s.isActive ? (
                            <Badge variant="neutral" className="ml-2">
                              inactive
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell nums tabular-nums text-muted-foreground">
                          {s.nicCode ?? "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell nums tabular-nums text-muted-foreground">
                          {s.rbiSectoralDeploymentCode ?? "-"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {s.segmentClass ? prettify(s.segmentClass) : "-"}
                        </TableCell>
                        <TableCell className="text-right nums tabular-nums text-muted-foreground">
                          {s.level}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </MasterSection>

        {/* ── Rating ladder ────────────────────────────────────────────── */}
        <MasterSection
          icon={<RatingLadderMark className="size-4" />}
          eyebrow="DATA_MODEL §2.23.7 · cross-agency rank"
          title="Rating ladder"
          description="Cross-agency rating rank reference - the canonical scale mapping that makes CRISIL / ICRA / CARE ratings comparable. external_rating.rating_rank is snapshotted at rating time so historical ratings stay comparable as agencies refine their scales."
          count={ladder.length}
        >
          <Card>
            <CardBody className="p-0">
              <Table density="compact">
                <TableHeader>
                  <TableRow>
                    <TableHead>Agency</TableHead>
                    <TableHead>Scale</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Rank</TableHead>
                    <TableHead className="hidden md:table-cell">Definition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ladder.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={5} className="p-0">
                        <EmptyState
                          icon={<RatingLadderMark className="size-4" />}
                          title="No rating ladder rows."
                          hint="Run the seed script to provision the CRISIL long-term scale."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    ladder.map((r) => (
                      <TableRow key={r.ladderId}>
                        <TableCell>
                          <span className="font-medium text-foreground">{r.agency}</span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {prettify(r.scale)}
                        </TableCell>
                        <TableCell>
                          <span className="nums font-medium tabular-nums text-foreground">
                            {r.symbol}
                          </span>
                        </TableCell>
                        <TableCell className="text-right nums tabular-nums text-muted-foreground">
                          {r.rank}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[12px] text-muted-foreground">
                          {r.definition ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </MasterSection>

        {/* ── Enum catalogues ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <EnumSection
            icon={<Handshake weight="light" />}
            eyebrow="deal_type enum · 18 values"
            title="Deal types"
            description="The mandate-type catalogue - bond underwriting, G-Sec auction, M&A, ECM, structured finance, etc. Drives the deal-creation + lead-deal-type dropdowns."
            codes={DEAL_TYPES.map((c) => ({
              code: c,
              hint: dealTypeCounts.get(c) != null ? `${dealTypeCounts.get(c)} deals` : null,
            }))}
          />
          <EnumSection
            icon={<Coins weight="light" />}
            eyebrow="instrument_type enum · 14 values"
            title="Instrument types"
            description="Tradable/issuable security types - corp bond, NCD, CP, G-Sec, SDL, T-bill, SGB, equity, convertible, etc. Drives the instrument-creation dropdown."
            codes={INSTRUMENT_TYPES.map((c) => ({ code: c, hint: null }))}
          />
          <EnumSection
            icon={<RatingLadderMark className="size-4" />}
            eyebrow="rating_agency enum · 7 values"
            title="Rating agencies"
            description="SEBI-accredited credit rating agencies operating in India - CRISIL, ICRA, CARE, India Ratings, Acuite, Infomerics, Brickwork. Drives the external-rating agency dropdown."
            codes={RATING_AGENCIES.map((c) => ({ code: c, hint: null }))}
          />
          <EnumSection
            icon={<SealCheck weight="light" />}
            eyebrow="rating_scale enum · 5 values"
            title="Rating scales"
            description="The rating-scale taxonomy - long term, short term, structured, sovereign, state guaranteed. external_rating.rating_scale picks from this list."
            codes={RATING_SCALES.map((c) => ({ code: c, hint: null }))}
          />
        </div>
      </div>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Section wrappers
// ---------------------------------------------------------------------------

function MasterSection({
  icon,
  eyebrow,
  title,
  description,
  count,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <SectionIcon tone="gold">{icon}</SectionIcon>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-3">
            <Eyebrow dot>{eyebrow}</Eyebrow>
            <span className="nums text-[11px] tabular-nums text-muted-foreground">
              {count} rows
            </span>
          </div>
          <h3 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h3>
          <p className="max-w-3xl text-[12.5px] leading-[1.55] text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function EnumSection({
  icon,
  eyebrow,
  title,
  description,
  codes,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  codes: { code: string; hint: string | null }[];
}) {
  return (
    <Card>
      <CardBody className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <SectionIcon>{icon}</SectionIcon>
          <div className="flex flex-1 flex-col gap-1">
            <Eyebrow dot>{eyebrow}</Eyebrow>
            <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
              {title}
            </h3>
            <p className="text-[12px] leading-[1.5] text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {codes.map((c) => (
            <li
              key={c.code}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.03] px-2.5 py-1 text-[11.5px] ring-1 ring-hairline/70"
              title={c.hint ?? undefined}
            >
              <span className="nums font-medium tabular-nums text-foreground">
                {c.code}
              </span>
              {c.hint ? (
                <span className="text-[10px] text-muted-foreground">· {c.hint}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function prettify(s: string): string {
  return s.replace(/_/g, " ");
}

/**
 * SectionIcon - a hairline disc well that frames any ReactNode (a phosphor
 * glyph OR a custom brand mark like RatingLadderMark). IconTile only accepts
 * a PhosphorIcon component, so this local wrapper accepts a rendered node and
 * mirrors the IconTile disc treatment (hairline ring + faint tint + gold tone
 * for the section opener).
 */
function SectionIcon({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold";
}) {
  return (
    <span
      aria-hidden
      className={
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full ring-1 " +
        (tone === "gold"
          ? "bg-gold/[0.06] text-gold ring-gold/22"
          : "bg-foreground/[0.04] text-muted-foreground ring-hairline")
      }
    >
      {children}
    </span>
  );
}
