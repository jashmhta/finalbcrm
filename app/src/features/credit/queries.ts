// Server-side credit-analysis data access. RLS-aware via withRls on writes
// (see actions.ts); reads are plain queries (the GUCs set by withRls are
// no-ops on tables without RLS enabled). All functions are safe to call from
// Server Components.

import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { can } from "@/lib/rbac-core";
import {
  creditAnalysis,
  creditAnalysisFsLink,
  creditLimit,
  creditScore,
  exposure,
  externalRating,
  financialStatement,
  party,
  ratioResult,
  scorecard,
  scorecardTemplate,
  sectorCode,
} from "@/db/schema";
import { computeRatios, ratioSetToResultRows, type RatioSet } from "./ratios";
import { resolveBand, type RatingAgency } from "./ratingMap";

interface ScopedCrmUser {
  appUserId: string | null;
  roles: string[];
  permissions: Set<string>;
}

function canReadAllCredit(
  user?: Pick<ScopedCrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "credit") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function creditVisibilityClause(user?: ScopedCrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllCredit(user) || !scopedUserId) return undefined;
  return or(
    eq(creditAnalysis.createdByUserId, scopedUserId),
    eq(creditAnalysis.updatedByUserId, scopedUserId),
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Derived point-in-time lifecycle status. The `credit_analysis` table has NO
 * `status` column - lifecycle is encoded by the version chain: `valid_to`
 * (NULL = the current/live version) + `superseded_by` (the analysis that
 * replaced this one). We derive a stable status string here so the view layer
 * never has to know the column model:
 *   - "current"    → valid_to IS NULL (the live analysis for this obligor)
 *   - "superseded" → valid_to IS NOT NULL (a prior version, replaced)
 */
export type CreditLifecycleStatus = "current" | "superseded";

export function deriveLifecycleStatus(validTo: Date | null): CreditLifecycleStatus {
  return validTo == null ? "current" : "superseded";
}

export interface CreditAnalysisListItem {
  creditAnalysisId: string;
  partyId: string;
  legalName: string;
  analysisType: string | null;
  obligorType: string;
  internalRatingShort: string | null;
  currentCreditScore: string | null;
  band: string | null;
  watchlistFlag: boolean | null;
  internalRatingAction: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  /** Derived PIT lifecycle - "current" (valid_to IS NULL) | "superseded". */
  lifecycleStatus: CreditLifecycleStatus;
  createdAt: Date | null;
}

export interface CreditAnalysisListResult {
  rows: CreditAnalysisListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listCreditAnalyses({
  q,
  user,
  page = 1,
  pageSize = 25,
}: {
  q?: string;
  user?: ScopedCrmUser | null;
  page?: number;
  pageSize?: number;
}): Promise<CreditAnalysisListResult> {
  const where = and(
    isNull(creditAnalysis.deletedAt),
    isNull(party.deletedAt),
    creditVisibilityClause(user),
    q ? or(ilike(party.legalName, `%${q}%`)) : undefined,
  );

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        creditAnalysisId: creditAnalysis.creditAnalysisId,
        partyId: creditAnalysis.partyId,
        legalName: party.legalName,
        analysisType: creditAnalysis.analysisType,
        obligorType: creditAnalysis.obligorType,
        internalRatingShort: creditAnalysis.internalRatingShort,
        currentCreditScore: creditAnalysis.currentCreditScore,
        watchlistFlag: creditAnalysis.watchlistFlag,
        internalRatingAction: creditAnalysis.internalRatingAction,
        validFrom: creditAnalysis.validFrom,
        validTo: creditAnalysis.validTo,
        createdAt: creditAnalysis.createdAt,
      })
      .from(creditAnalysis)
      .innerJoin(party, eq(party.partyId, creditAnalysis.partyId))
      .where(where)
      .orderBy(desc(creditAnalysis.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(creditAnalysis)
      .innerJoin(party, eq(party.partyId, creditAnalysis.partyId))
      .where(where),
  ]);

  // Latest scorecard band per analysis (one extra query, no N+1).
  const ids = rows.map((r) => r.creditAnalysisId);
  const bandRows = ids.length
    ? await db
        .select({
          creditAnalysisId: scorecard.creditAnalysisId,
          band: scorecard.band,
          computedAt: scorecard.computedAt,
        })
        .from(scorecard)
        .where(
          and(
            inArray(scorecard.creditAnalysisId, ids),
            isNull(scorecard.deletedAt),
          ),
        )
        .orderBy(desc(scorecard.computedAt))
    : [];
  const bandByAnalysis = new Map<string, string>();
  for (const b of bandRows) {
    if (!bandByAnalysis.has(b.creditAnalysisId)) {
      bandByAnalysis.set(b.creditAnalysisId, b.band ?? "");
    }
  }

  return {
    total: n ?? 0,
    page,
    pageSize,
    rows: rows.map((r) => ({
      ...r,
      band: bandByAnalysis.get(r.creditAnalysisId) || null,
      lifecycleStatus: deriveLifecycleStatus(r.validTo),
    })),
  };
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface CreditAnalysisDetail {
  analysis: typeof creditAnalysis.$inferSelect;
  party: typeof party.$inferSelect;
  /** Derived PIT lifecycle - "current" (valid_to IS NULL) | "superseded". */
  lifecycleStatus: CreditLifecycleStatus;
  sector: { code: string; label: string } | null;
  financialStatements: (typeof financialStatement.$inferSelect & {
    linkRole: string | null;
  })[];
  /** ratio_result rows keyed by financialStatementId. */
  ratiosByStatement: Record<string, { ratioCode: string; ratioValue: string }[]>;
  /** Engine-recomputed ratio set for the latest period (for the scorecard panel). */
  latestRatioSet: RatioSet | null;
  latestStatementId: string | null;
  scorecard: typeof scorecard.$inferSelect | null;
  scores: (typeof creditScore.$inferSelect)[];
  template: typeof scorecardTemplate.$inferSelect | null;
  externalRatings: (typeof externalRating.$inferSelect)[];
  /** External ratings enriched with resolved internal band. */
  externalRatingsEnriched: {
    row: typeof externalRating.$inferSelect;
    band: string | null;
  }[];
  exposures: (typeof exposure.$inferSelect)[];
  limits: (typeof creditLimit.$inferSelect)[];
}

export async function getCreditAnalysisDetail(
  analysisId: string,
  user?: ScopedCrmUser | null,
): Promise<CreditAnalysisDetail | null> {
  const [a] = await db
    .select({ analysis: creditAnalysis })
    .from(creditAnalysis)
    .innerJoin(party, eq(party.partyId, creditAnalysis.partyId))
    .where(
      and(
        eq(creditAnalysis.creditAnalysisId, analysisId),
        isNull(creditAnalysis.deletedAt),
        isNull(party.deletedAt),
        creditVisibilityClause(user),
      ),
    );
  if (!a) return null;
  const analysis = a.analysis;

  const [p, linkRows, scorecardRows, scoreRows, ratingRows, exposureRows, limitRows] =
    await Promise.all([
      db
        .select()
        .from(party)
        .where(eq(party.partyId, analysis.partyId))
        .then((rs) => rs[0] ?? null),
      db
        .select({
          financialStatementId: creditAnalysisFsLink.financialStatementId,
          linkRole: creditAnalysisFsLink.linkRole,
        })
        .from(creditAnalysisFsLink)
        .where(eq(creditAnalysisFsLink.creditAnalysisId, analysisId)),
      db
        .select()
        .from(scorecard)
        .where(
          and(
            eq(scorecard.creditAnalysisId, analysisId),
            isNull(scorecard.deletedAt),
          ),
        )
        .orderBy(desc(scorecard.computedAt))
        .limit(1),
      db
        .select()
        .from(creditScore)
        .where(
          and(
            eq(creditScore.creditAnalysisId, analysisId),
            isNull(creditScore.deletedAt),
          ),
        )
        .orderBy(asc(creditScore.componentCode)),
      db
        .select()
        .from(externalRating)
        .where(
          and(eq(externalRating.partyId, analysis.partyId), isNull(externalRating.deletedAt)),
        )
        .orderBy(desc(externalRating.effectiveDate)),
      db
        .select()
        .from(exposure)
        .where(and(eq(exposure.partyId, analysis.partyId), isNull(exposure.deletedAt)))
        .orderBy(desc(exposure.asOfDate)),
      db
        .select()
        .from(creditLimit)
        .where(and(eq(creditLimit.partyId, analysis.partyId), isNull(creditLimit.deletedAt)))
        .orderBy(asc(creditLimit.limitType)),
    ]);

  // Resolve the issuer's sector via party.industrySegmentId → sectorCode.
  let sector: { code: string; label: string } | null = null;
  if (p?.industrySegmentId) {
    const [s] = await db
      .select({ code: sectorCode.code, label: sectorCode.label })
      .from(sectorCode)
      .where(eq(sectorCode.sectorCodeId, p.industrySegmentId));
    sector = s ?? null;
  }

  // Load the linked financial statements (ordered oldest → newest).
  const fsIds = linkRows.map((l) => l.financialStatementId);
  const fsRows = fsIds.length
    ? await db
        .select()
        .from(financialStatement)
        .where(
          and(
            inArray(financialStatement.financialStatementId, fsIds),
            isNull(financialStatement.deletedAt),
          ),
        )
        .orderBy(asc(financialStatement.periodEndDate))
    : [];
  const linkRoleByFs = new Map(linkRows.map((l) => [l.financialStatementId, l.linkRole] as const));
  const statements = fsRows.map((fs) => ({
    ...fs,
    linkRole: linkRoleByFs.get(fs.financialStatementId) ?? null,
  }));

  // Persisted ratio_result rows per statement.
  const ratioRows = fsIds.length
    ? await db
        .select({
          financialStatementId: ratioResult.financialStatementId,
          ratioCode: ratioResult.ratioCode,
          ratioValue: ratioResult.ratioValue,
        })
        .from(ratioResult)
        .where(inArray(ratioResult.financialStatementId, fsIds))
    : [];
  const ratiosByStatement: Record<string, { ratioCode: string; ratioValue: string }[]> = {};
  for (const r of ratioRows) {
    (ratiosByStatement[r.financialStatementId] ??= []).push({
      ratioCode: r.ratioCode,
      ratioValue: r.ratioValue ?? "",
    });
  }

  // Engine-recompute the latest period's ratios for the scorecard panel +
  // workspace. Uses the prior statement for averaging when available.
  let latestRatioSet: RatioSet | null = null;
  let latestStatementId: string | null = null;
  if (statements.length > 0) {
    const latest = statements[statements.length - 1];
    const prior = statements.length > 1 ? statements[statements.length - 2] : null;
    latestRatioSet = computeRatios(latest, prior);
    latestStatementId = latest.financialStatementId;
  }

  // Resolve template for the latest scorecard.
  let template: typeof scorecardTemplate.$inferSelect | null = null;
  if (scorecardRows[0]?.templateId) {
    const [t] = await db
      .select()
      .from(scorecardTemplate)
      .where(eq(scorecardTemplate.templateId, scorecardRows[0].templateId));
    template = t ?? null;
  }

  // Enrich external ratings with their resolved internal band.
  const externalRatingsEnriched = await Promise.all(
    ratingRows.map(async (row) => ({
      row,
      band: await resolveBand(row.agency as RatingAgency, row.ratingValue),
    })),
  );

  return {
    analysis,
    party: p,
    lifecycleStatus: deriveLifecycleStatus(analysis.validTo),
    sector,
    financialStatements: statements,
    ratiosByStatement,
    latestRatioSet,
    latestStatementId,
    scorecard: scorecardRows[0] ?? null,
    scores: scoreRows,
    template,
    externalRatings: ratingRows,
    externalRatingsEnriched,
    exposures: exposureRows,
    limits: limitRows,
  };
}
