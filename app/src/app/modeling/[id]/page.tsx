import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";

import { can, requireUser, type CrmUser } from "@/lib/rbac";
import { getModelDetail } from "@/features/modeling/queries";
import { db } from "@/db";
import { appUser, deal, dealParty, financialModel, party } from "@/db/schema";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  CheckCircle,
  Clock,
  Hash,
  Link as LinkIcon,
  SealCheck,
  Sparkle,
  User,
} from "@/components/brand/icons";
import { Button } from "@/components/brand/button";
import { Badge } from "@/components/brand/badge";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/brand/card";
import { Eyebrow } from "@/components/brand/text";
import { Reveal } from "@/components/brand/reveal";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand/table";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  bond_pricing: "Bond pricing",
  project_finance: "Project finance",
  securitization: "Securitization",
  dcf: "DCF / valuation",
  m_and_a: "M&A",
  lbo: "LBO",
  valuation: "Valuation",
  portfolio_construction: "Portfolio construction",
  scenario_stress: "Scenario / stress",
};

function fmtNum(x: unknown, digits = 4): string {
  if (typeof x !== "number" || !Number.isFinite(x)) return "-";
  return String(x.toFixed(digits));
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function modelFamilyVisibilityScope(user: CrmUser): SQL {
  if (
    can(user, "read_all", "financial_model") ||
    can(user, "read_all", "model") ||
    can(user, "manage", "user")
  ) {
    return sql`TRUE`;
  }

  const userId = user.appUserId;
  if (!userId) return sql`FALSE`;

  return sql`(
    ${financialModel.computedByUserId} = ${userId}
    OR ${financialModel.approvedByUserId} = ${userId}
    OR EXISTS (
      SELECT 1
      FROM ${party} p_scope
      WHERE p_scope.party_id = ${financialModel.partyId}
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${userId}
          OR p_scope.data_owner_user_id = ${userId}
          OR p_scope.created_by_user_id = ${userId}
        )
    )
    OR EXISTS (
      SELECT 1
      FROM ${deal} d_scope
      WHERE d_scope.deal_id = ${financialModel.dealId}
        AND d_scope.deleted_at IS NULL
        AND (
          d_scope.lead_user_id = ${userId}
          OR d_scope.credit_analyst_user_id = ${userId}
          OR d_scope.created_by_user_id = ${userId}
          OR EXISTS (
            SELECT 1
            FROM ${dealParty} dp_scope
            JOIN ${party} p2_scope ON p2_scope.party_id = dp_scope.party_id
            WHERE dp_scope.deal_id = d_scope.deal_id
              AND dp_scope.deleted_at IS NULL
              AND p2_scope.deleted_at IS NULL
              AND (
                p2_scope.assigned_user_id = ${userId}
                OR p2_scope.data_owner_user_id = ${userId}
                OR p2_scope.created_by_user_id = ${userId}
              )
          )
        )
    )
  )`;
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getModelDetail(id, user);
  if (!detail) notFound();

  const { model, dealCode, dealName, partyName, parentVersion } = detail;
  const paramsObj = (model.params ?? {}) as Record<string, unknown>;
  const outputsObj = (model.outputs ?? {}) as Record<string, unknown>;

  // ── View-layer enrichment (display-only) ────────────────────────────────
  // The features query returns the bare model row; the provenance + version
  // family are resolved here so the data layer (src/features/modeling) stays
  // untouched. Follows the compliance/queries pattern of resolving appUser.email
  // as the staff identity (app_user has no name column - the email IS the
  // handle in this CRM).
  const actorIds = [model.computedByUserId, model.approvedByUserId].filter(
    (x): x is string => Boolean(x),
  );
  const familyBaseWhere = model.dealId
    ? and(
        isNull(financialModel.deletedAt),
        eq(financialModel.modelType, model.modelType),
        eq(financialModel.dealId, model.dealId),
      )
    : model.partyId
      ? and(
          isNull(financialModel.deletedAt),
          eq(financialModel.modelType, model.modelType),
          eq(financialModel.partyId, model.partyId),
        )
      : and(
          isNull(financialModel.deletedAt),
          eq(financialModel.financialModelId, model.financialModelId),
        );
  const [actors, family] = await Promise.all([
    actorIds.length
      ? db
          .select({ userId: appUser.userId, email: appUser.email })
          .from(appUser)
          .where(inArray(appUser.userId, actorIds))
      : Promise.resolve([]),
    // Version family: same (deal, modelType) - or (party, modelType) for
    // standalone models - excluding soft-deleted, newest version first.
    db
      .select({
        financialModelId: financialModel.financialModelId,
        version: financialModel.version,
        scenarioTag: financialModel.scenarioTag,
        currencyCode: financialModel.currencyCode,
        computedAt: financialModel.computedAt,
        createdAt: financialModel.createdAt,
        computedByEmail: appUser.email,
        approvedByUserId: financialModel.approvedByUserId,
        parentModelId: financialModel.parentModelId,
      })
      .from(financialModel)
      .leftJoin(appUser, eq(appUser.userId, financialModel.computedByUserId))
      .where(and(familyBaseWhere, modelFamilyVisibilityScope(user)))
      .orderBy(desc(financialModel.version)),
  ]);

  const emailByUser = new Map(actors.map((a) => [a.userId, a.email] as const));
  const computedByEmail = model.computedByUserId
    ? (emailByUser.get(model.computedByUserId) ?? null)
    : null;
  const approvedByEmail = model.approvedByUserId
    ? (emailByUser.get(model.approvedByUserId) ?? null)
    : null;
  const isApproved = Boolean(model.approvedByUserId);
  const versionCount = family.length;

  return (
    <PageShell>
      {/* Header renders VISIBLE on mount (no whileInView opacity-0 gate on
          the above-the-fold identity, per the screenshot-visibility rule). */}
      <div className="flex flex-col gap-4">
        <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Link
            href="/modeling"
            className="transition-colors duration-200 ease-soft hover:text-foreground"
          >
            Models
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="nums uppercase tracking-[0.12em] text-foreground/55">
            {model.financialModelId.slice(0, 8)}…
          </span>
        </nav>
        <PageHeader
        title={TYPE_LABEL[model.modelType] ?? model.modelType}
        description={model.assumptionsDoc ??
            "Versioned financial model object - provenance, stored inputs/outputs and the append-only version family for this deal."}
      />
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">v{model.version}</Badge>
          {parentVersion != null ? (
            <Badge variant="neutral">fork of v{parentVersion}</Badge>
          ) : null}
          {model.scenarioTag ? (
            <Badge variant="emerald">{model.scenarioTag}</Badge>
          ) : null}
          <Badge variant="outline">{model.currencyCode ?? "-"}</Badge>
          {isApproved ? (
            <Badge variant="emerald" icon={<CheckCircle weight="light" />} dot>
              approved
            </Badge>
          ) : (
            <Badge variant="gold">awaiting approval</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          {model.dealId ? (
            <Link
              href="/deals"
              className="transition-colors duration-200 ease-soft hover:text-emerald"
            >
              <Badge variant="outline" icon={<LinkIcon weight="light" />}>
                Deal: {dealCode ?? dealName ?? model.dealId.slice(0, 8)}
              </Badge>
            </Link>
          ) : (
            <span className="text-muted-foreground">No linked deal</span>
          )}
          {model.partyId ? (
            <Link
              href={`/parties/${model.partyId}`}
              className="transition-colors duration-200 ease-soft hover:text-emerald"
            >
              <Badge variant="outline" icon={<LinkIcon weight="light" />}>
                Party: {partyName ?? model.partyId.slice(0, 8)}
              </Badge>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Provenance & approval - the four-eyes audit trail (§2.17). */}
      <Reveal y={14} delay={0.04} className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <Eyebrow dot>
                <SealCheck weight="light" className="size-3.5" />
                Provenance &amp; approval
              </Eyebrow>
              <CardTitle className="mt-1">Audit trail</CardTitle>
              <CardDescription>
                Who computed this version, when, on which engine - and the
                four-eyes approval that locks it for downstream use.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ProvenanceTile
                icon={<User weight="light" />}
                label="Computed by"
                value={computedByEmail ?? "-"}
                mono
              />
              <ProvenanceTile
                icon={<Clock weight="light" />}
                label="Computed at"
                value={fmtDateTime(model.computedAt)}
                mono
              />
              <ProvenanceTile
                icon={<Calculator weight="light" />}
                label="Engine"
                value={model.engineVersion ?? "-"}
                mono
              />
              <ProvenanceTile
                icon={isApproved ? <CheckCircle weight="light" /> : <SealCheck weight="light" />}
                label="Approved by"
                value={approvedByEmail ?? "Awaiting sign-off"}
                mono
                tone={isApproved ? "emerald" : "gold"}
              />
            </div>
            <p className="mt-5 flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground">
              <LinkIcon weight="light" className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
              Models are versioned &amp; append-only (§2.17). Approval is a
              separate four-eyes step - the approver cannot be the same user who
              computed the version. Unapproved versions are visible but not
              citable in credit committee.
            </p>
          </CardBody>
        </Card>
      </Reveal>

      {model.modelType === "bond_pricing" ? (
        <BondOutputs outputs={outputsObj} />
      ) : (
        <Reveal y={14} delay={0.05} className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Outputs</CardTitle>
              <CardDescription>
                Stored outputs for this {TYPE_LABEL[model.modelType]} model.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <JsonKvGrid data={outputsObj} emptyHint="No structured outputs stored for this version." />
            </CardBody>
          </Card>
        </Reveal>
      )}

      <Reveal y={14} delay={0.08} className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Inputs / assumptions</CardTitle>
            <CardDescription>
              The exact parameter snapshot this model was computed from - every
              number is reproducible (§0.4).
            </CardDescription>
          </CardHeader>
          <CardBody>
            <JsonKvGrid data={paramsObj} emptyHint="No input parameters stored for this version." />
          </CardBody>
        </Card>
      </Reveal>

      {/* Version history - the append-only version family for this deal/type. */}
      <Reveal y={14} delay={0.1} className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <Eyebrow dot>
                <Hash weight="light" className="size-3.5" />
                Version history
              </Eyebrow>
              <CardTitle className="mt-1">
                {versionCount} version{versionCount === 1 ? "" : "s"}
              </CardTitle>
              <CardDescription>
                The append-only version family for this{" "}
                {TYPE_LABEL[model.modelType]} model - same{" "}
                {model.dealId ? "deal" : "party"}, ordered newest first.
              </CardDescription>
            </div>
          </CardHeader>
          <div className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Scenario</TableHead>
                  {/* Ccy / Computed by / Computed / Approval are secondary on
                      phones - hidden < md so the 7-col version family table
                      collapses to Version + Scenario + Open (identity, context,
                      action). The current version's full provenance is in the
                      header + provenance tiles above. */}
                  <TableHead className="hidden md:table-cell">Ccy</TableHead>
                  <TableHead className="hidden md:table-cell">Computed by</TableHead>
                  <TableHead align="right" className="hidden md:table-cell">Computed</TableHead>
                  <TableHead className="hidden md:table-cell">Approval</TableHead>
                  <TableHead align="right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {family.map((v) => {
                  const isCurrent = v.financialModelId === model.financialModelId;
                  const isParent =
                    model.parentModelId != null &&
                    v.financialModelId === model.parentModelId;
                  return (
                    <TableRow key={v.financialModelId} selected={isCurrent}>
                      <TableCell primary>
                        <span className="inline-flex items-center gap-2">
                          <span className="nums tabular-nums">v{v.version}</span>
                          {isCurrent ? (
                            <Badge variant="emerald" dot>
                              current
                            </Badge>
                          ) : isParent ? (
                            <Badge variant="neutral">parent</Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        {v.scenarioTag ? (
                          <Badge variant="outline">{v.scenarioTag}</Badge>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="nums text-muted-foreground">
                          {v.currencyCode ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {v.computedByEmail ? (
                          <span className="nums text-[12px] text-foreground/80">
                            {v.computedByEmail}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                      <TableCell numeric className="hidden md:table-cell">
                        <span className="nums tabular-nums text-muted-foreground">
                          {fmtDate(v.computedAt ?? v.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {v.approvedByUserId ? (
                          <Badge variant="emerald" icon={<CheckCircle weight="light" />}>
                            approved
                          </Badge>
                        ) : (
                          <Badge variant="outline">pending</Badge>
                        )}
                      </TableCell>
                      <TableCell numeric>
                        {isCurrent ? (
                          <span className="text-muted-foreground/40">-</span>
                        ) : (
                          <Link
                            href={`/modeling/${v.financialModelId}`}
                            className="inline-flex items-center gap-1 text-[12px] text-emerald transition-colors duration-200 ease-soft hover:text-emerald/80"
                          >
                            Open
                            <ArrowRight weight="light" className="size-3" />
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </Reveal>

      <Reveal y={10} delay={0.12} className="mt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            asChild
            variant="secondary-hairline"
            size="sm"
            leadingIcon={<ArrowLeft weight="light" />}
          >
            <Link href="/modeling">Back to library</Link>
          </Button>
          <Button
            asChild
            variant="primary-gold"
            size="sm"
            trailingIcon={<ArrowRight weight="light" />}
          >
            <Link href="/modeling/bond-calculator">Recompute in calculator</Link>
          </Button>
        </div>
      </Reveal>
    </PageShell>
  );
}

/** Machined provenance tile - hairline ring + inset highlight + eyebrow label,
 *  tone-aware value. The same nested-bezel depth as the ratio cells on the
 *  credit workspace, sized to breathe on mobile (single column <640px). */
function ProvenanceTile({
  icon,
  label,
  value,
  mono,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  tone?: "neutral" | "emerald" | "gold";
}) {
  const valueTone =
    tone === "emerald"
      ? "text-emerald"
      : tone === "gold"
        ? "text-gold"
        : "text-foreground";
  return (
    <div className="relative flex flex-col gap-2 rounded-xl bg-surface p-3.5 ring-1 ring-inset ring-foreground/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="[&_svg]:size-4 [&_svg]:text-muted-foreground/70">{icon}</span>
        <span className="text-[10.5px] font-medium uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <span
        className={
          (mono ? "nums " : "") +
          "text-[13px] font-medium tabular-nums break-words " +
          valueTone
        }
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * JsonKvGrid - a clean key/value renderer for stored JSONB payloads.
 *
 * Replaces the raw `JSON.stringify(…, null, 2)` <pre> blocks that used to
 * render literal JSON source in the page (the "code in UI" tell). Walks the
 * top-level object one level deep: scalars → mono/numeric cells, nested
 * objects → an indented sub-grid, arrays of primitives → a comma-joined mono
 * string, arrays of objects → a count + sub-grid. Empty payloads get a quiet
 * muted line instead of "{}". Display-only - never mutates the payload.
 * ------------------------------------------------------------------ */
function prettifyKey(k: string): string {
  return k
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatScalar(v: unknown): { text: string; mono: boolean } {
  if (v === null || v === undefined) return { text: "-", mono: false };
  if (typeof v === "boolean") return { text: v ? "Yes" : "No", mono: false };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { text: "-", mono: false };
    const abs = Math.abs(v);
    // Whole numbers → grouped; fractions → 4dp (matches the bond-output precision).
    const text =
      abs >= 100 || Number.isInteger(v)
        ? v.toLocaleString("en-IN", { maximumFractionDigits: 0 })
        : v.toLocaleString("en-IN", { maximumFractionDigits: 4 });
    return { text, mono: true };
  }
  if (typeof v === "string") {
    // Strings that are themselves JSON get pretty-printed + mono.
    const s = v.trim();
    if ((s.startsWith("{") || s.startsWith("[")) && (s.endsWith("}") || s.endsWith("]"))) {
      try {
        return { text: JSON.stringify(JSON.parse(s), null, 2), mono: true };
      } catch {
        // fall through - render the raw string
      }
    }
    return { text: v, mono: false };
  }
  return { text: String(v), mono: false };
}

function JsonKvGrid({
  data,
  emptyHint,
}: {
  data: Record<string, unknown>;
  emptyHint: string;
}) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) {
    return (
      <p className="text-[13px] italic text-muted-foreground/80">{emptyHint}</p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex flex-col gap-1 rounded-xl bg-surface-2/40 p-3.5 ring-1 ring-hairline shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {prettifyKey(key)}
          </span>
          <JsonKvValue value={value} />
        </div>
      ))}
    </div>
  );
}

function JsonKvValue({ value }: { value: unknown }) {
  // Nested object → indented sub-grid (one level - deep nesting collapses to
  // a mono pretty-printed block so it never renders as raw unstyled JSON).
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const sub = Object.entries(value as Record<string, unknown>);
    if (sub.length === 0) {
      return <span className="text-[13px] text-muted-foreground/60">-</span>;
    }
    return (
      <div className="flex flex-col gap-1 border-l border-hairline/60 pl-3">
        {sub.map(([k, v]) => {
          const f = formatScalar(v);
          return (
            <div key={k} className="flex items-baseline justify-between gap-2">
              <span className="text-[11.5px] text-muted-foreground/80">
                {prettifyKey(k)}
              </span>
              <span
                className={
                  (f.mono ? "nums tabular-nums " : "") +
                  "text-right text-[12.5px] text-foreground/90 break-words"
                }
              >
                {f.text}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  // Array of primitives → comma-joined mono string.
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[13px] text-muted-foreground/60">-</span>;
    }
    const allScalar = value.every(
      (v) => v === null || typeof v !== "object" || Array.isArray(v) === false,
    );
    if (allScalar) {
      const joined = value
        .map((v) => formatScalar(v).text)
        .join(", ");
      return (
        <span className="nums tabular-nums text-[12.5px] text-foreground/90 break-words">
          {joined}
        </span>
      );
    }
    // Array of objects → count + a one-line summary, no raw JSON.
    return (
      <span className="text-[12.5px] text-muted-foreground/90">
        {value.length} item{value.length === 1 ? "" : "s"}
      </span>
    );
  }
  const f = formatScalar(value);
  return (
    <span
      className={
        (f.mono ? "nums tabular-nums " : "") +
        "text-[13px] text-foreground/90 break-words"
      }
    >
      {f.text}
    </span>
  );
}

function BondOutputs({ outputs }: { outputs: Record<string, unknown> }) {
  const m = outputs;
  const cards: { label: string; value: string; tone: "gold" | "default" }[] = [];
  const push = (label: string, v: unknown, digits = 4, asPct = false, tone: "gold" | "default" = "default") => {
    if (typeof v !== "number" || !Number.isFinite(v)) return;
    cards.push({
      label,
      value: asPct ? `${(v * 100).toFixed(digits)}%` : v.toFixed(digits),
      tone,
    });
  };
  push("Clean price", m.cleanPrice, 4, false, "gold");
  push("Dirty price", m.dirtyPrice, 4);
  push("Accrued interest", m.accruedInterest, 4);
  push("YTM", m.ytm, 4, true, "gold");
  push("Current yield", m.currentYield, 4, true);
  push("Macaulay dur.", m.macaulayDuration, 4);
  push("Modified dur.", m.modifiedDuration, 4);
  push("DV01 (₹/bp)", m.dv01, 4);
  push("Convexity", m.convexity, 3);
  if (typeof m.gSpread === "number") {
    push("G-spread (bp)", (m.gSpread as number) * 10_000, 1);
  }
  const cashFlows = Array.isArray(m.cashFlows)
    ? (m.cashFlows as Array<Record<string, unknown>>)
    : null;

  return (
    <>
      <Reveal y={14} delay={0.05} className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-1">
              <Eyebrow dot>
                <Sparkle weight="light" className="size-3.5" />
                Headline outputs
              </Eyebrow>
              <CardTitle>Bond pricing result</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="gold" icon={<Calculator weight="light" />}>
                bondPricing.v1
              </Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {cards.length === 0 ? (
                <span className="col-span-full text-[13px] text-muted-foreground">
                  No structured outputs stored.
                </span>
              ) : (
                cards.map((c) => (
                  <div
                    key={c.label}
                    className="relative flex flex-col gap-1 rounded-[calc(var(--radius-lg)-0.25rem)] bg-surface-2/40 p-3.5 ring-1 ring-hairline shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {c.label}
                    </span>
                    <span
                      className={
                        c.tone === "gold"
                          ? "text-[1.05rem] sm:text-[1.1rem] nums tabular-nums font-medium text-gold"
                          : "text-[1.05rem] sm:text-[1.1rem] nums tabular-nums font-medium text-foreground"
                      }
                    >
                      {c.value}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </Reveal>

      {cashFlows ? (
        <Reveal y={14} delay={0.08} className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Cash-flow schedule</CardTitle>
              <CardDescription>
                As computed at settlement - date, period index, cash flow, PV.
              </CardDescription>
            </CardHeader>
            <div className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {/* Periods k + Years t are technical on phones - hidden < md
                        so the 5-col cash-flow schedule collapses to Date +
                        Cash flow + PV (the waterfall a mobile reader needs). */}
                    <TableHead align="right" className="hidden md:table-cell">Periods k</TableHead>
                    <TableHead align="right" className="hidden md:table-cell">Years t</TableHead>
                    <TableHead align="right">Cash flow</TableHead>
                    <TableHead align="right">PV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlows.map((cf, i) => (
                    <TableRow key={i}>
                      <TableCell className="nums text-xs">
                        {String(cf.date ?? "-")}
                      </TableCell>
                      <TableCell numeric className="hidden md:table-cell">
                        {fmtNum(cf.periodsFromSettlement)}
                      </TableCell>
                      <TableCell numeric className="hidden md:table-cell">
                        {fmtNum(cf.yearsFromSettlement)}
                      </TableCell>
                      <TableCell numeric>{fmtNum(cf.cashFlow, 2)}</TableCell>
                      <TableCell numeric primary>
                        {fmtNum(cf.presentValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </Reveal>
      ) : null}
    </>
  );
}
