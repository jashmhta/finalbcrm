"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod/v4";

import { requireUser, can } from "@/lib/rbac";
import { withRls } from "@/db/context";
import { runWithUserRls } from "@/lib/rls-user";
import { writeAudit } from "@/lib/audit-write";
import { db } from "@/db";
import {
  creditAnalysis,
  creditAnalysisFsLink,
  creditScore,
  financialStatement,
  party,
  ratioResult,
  scorecard,
  scorecardTemplate,
} from "@/db/schema";
import { computeRatios, ratioSetToResultRows } from "./ratios";
import { computeScorecard, bandFromScore, BAND_PD_1Y } from "./scorecard";
import {
  resolveCommitteeAdvance,
  type InternalRatingAction,
} from "./committee";

// ---------------------------------------------------------------------------
// Enum value lists (kept in sync with enums.ts)
// ---------------------------------------------------------------------------

const OBLIGOR_TYPES = [
  "corporate",
  "spv",
  "project",
  "sovereign",
  "state_psu",
  "nbfc",
  "bank",
] as const;

const ANALYSIS_TYPES = [
  "origination",
  "annual_surveillance",
  "event_driven",
  "watchlist_trigger",
  "rating_presentation_support",
] as const;

const PERIOD_TYPES = ["annual", "half_year", "quarter", "month"] as const;
const STATEMENT_TYPES = [
  "balance_sheet",
  "profit_loss",
  "cash_flow",
  "standalone",
  "consolidated",
] as const;
const UNITS = ["absolute", "lakhs", "crores", "millions"] as const;
const FS_SOURCES = [
  "audited",
  "limited_review",
  "management_provisional",
  "rating_agency_filing",
] as const;
const FS_LINK_ROLES = ["primary_basis", "supporting", "prior_period", "peer"] as const;

const INTERNAL_RATING_ACTIONS = [
  "assign",
  "maintain",
  "upgrade",
  "downgrade",
  "watch_negative",
  "watch_positive",
] as const;

// ---------------------------------------------------------------------------
// createCreditAnalysis
// ---------------------------------------------------------------------------

const createSchema = z.object({
  partyId: z.uuidv4(),
  obligorType: z.enum(OBLIGOR_TYPES),
  analysisType: z.enum(ANALYSIS_TYPES).optional(),
  dealId: z.uuidv4().optional(),
});

export type CreateCreditAnalysisState = { error?: string } | undefined;

export async function createCreditAnalysis(
  _prev: CreateCreditAnalysisState,
  formData: FormData,
): Promise<CreateCreditAnalysisState> {
  const user = await requireUser();
  if (!can(user, "write", "credit")) {
    return { error: "You do not have permission to create a credit analysis." };
  }

  const parsed = createSchema.safeParse({
    partyId: formData.get("partyId"),
    obligorType: formData.get("obligorType"),
    analysisType: formData.get("analysisType") || undefined,
    dealId: formData.get("dealId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  // Confirm the party exists (and is an issuer/spv-ish obligor).
  const [p] = await db
    .select({ partyId: party.partyId })
    .from(party)
    .where(and(eq(party.partyId, input.partyId), isNull(party.deletedAt)));
  if (!p) return { error: "Party not found." };

  const analysisId = await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      const [created] = await tx
        .insert(creditAnalysis)
        .values({
          partyId: input.partyId,
          obligorType: input.obligorType,
          analysisType: input.analysisType ?? null,
          dealId: input.dealId ?? null,
          analystUserId: user.appUserId,
          createdByUserId: user.appUserId,
          updatedByUserId: user.appUserId,
        })
        .returning({ creditAnalysisId: creditAnalysis.creditAnalysisId });
      if (!created) throw new Error("credit_analysis insert returned no row");
      return created.creditAnalysisId;
    },
  );

  revalidatePath("/credit");
  revalidatePath("/console/credit");
  redirect(`/credit/${analysisId}`);
}

// ---------------------------------------------------------------------------
// addFinancialStatement - inserts a financial_statement and links it to the
// analysis via credit_analysis_fs_link.
// ---------------------------------------------------------------------------

const addFsSchema = z.object({
  creditAnalysisId: z.uuidv4(),
  periodEndDate: z.iso.date(),
  periodStartDate: z.iso.date().optional(),
  periodType: z.enum(PERIOD_TYPES),
  statementType: z.enum(STATEMENT_TYPES),
  isConsolidated: z.coerce.boolean().default(false),
  currencyCode: z.string().length(3).default("INR"),
  units: z.enum(UNITS),
  source: z.enum(FS_SOURCES),
  linkRole: z.enum(FS_LINK_ROLES).default("primary_basis"),
  // line items as a JSON object: { code: number | string }
  lineItemsJson: z.string().min(2, "Line items JSON is required"),
});

export type AddFsState = { error?: string } | { ok?: boolean } | undefined;

export async function addFinancialStatement(
  _prev: AddFsState,
  formData: FormData,
): Promise<AddFsState> {
  const user = await requireUser();
  if (!can(user, "write", "credit")) {
    return { error: "You do not have permission to add financial statements." };
  }

  const parsed = addFsSchema.safeParse({
    creditAnalysisId: formData.get("creditAnalysisId"),
    periodEndDate: formData.get("periodEndDate"),
    periodStartDate: formData.get("periodStartDate") || undefined,
    periodType: formData.get("periodType"),
    statementType: formData.get("statementType"),
    isConsolidated: formData.get("isConsolidated") === "on" || formData.get("isConsolidated") === "true",
    currencyCode: formData.get("currencyCode") || "INR",
    units: formData.get("units"),
    source: formData.get("source"),
    linkRole: formData.get("linkRole") || "primary_basis",
    lineItemsJson: formData.get("lineItemsJson") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  // Parse + validate the line-items JSON.
  let lineItems: Record<string, unknown> = {};
  try {
    const obj = JSON.parse(input.lineItemsJson);
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return { error: "Line items JSON must be an object." };
    }
    lineItems = obj as Record<string, unknown>;
  } catch {
    return { error: "Line items JSON is not valid JSON." };
  }

  const analysisId = input.creditAnalysisId;
  await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      // Verify the analysis exists + is not deleted.
      const [a] = await tx
        .select({ partyId: creditAnalysis.partyId })
        .from(creditAnalysis)
        .where(
          and(
            eq(creditAnalysis.creditAnalysisId, analysisId),
            isNull(creditAnalysis.deletedAt),
          ),
        );
      if (!a) throw new Error("Credit analysis not found.");

      const [fs] = await tx
        .insert(financialStatement)
        .values({
          partyId: a.partyId,
          periodType: input.periodType,
          periodEndDate: input.periodEndDate,
          periodStartDate: input.periodStartDate ?? null,
          statementType: input.statementType,
          currencyCode: input.currencyCode,
          units: input.units,
          source: input.source,
          isConsolidated: input.isConsolidated,
          lineItems,
        })
        .returning({
          financialStatementId: financialStatement.financialStatementId,
        });
      if (!fs) throw new Error("financial_statement insert returned no row");

      await tx.insert(creditAnalysisFsLink).values({
        creditAnalysisId: analysisId,
        financialStatementId: fs.financialStatementId,
        linkRole: input.linkRole,
        linkedByUserId: user.appUserId,
      });
    },
  );

  revalidatePath(`/credit/${analysisId}`);
  revalidatePath(`/credit/${analysisId}/workspace`);
  revalidatePath("/console/credit");
  revalidatePath(`/console/credit/${analysisId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// runRatiosAndScore - recompute ratios for every linked financial statement,
// persist ratio_result rows, compute the scorecard from the latest period,
// persist a new scorecard + credit_score rows, and update
// credit_analysis.currentCreditScore / internal rating / PD.
//
// Note: credit_analysis.current_credit_score is trigger-maintained in the
// spec (§2.12) but the trigger does not exist yet in this codebase, so we
// update it directly here as a stopgap (see report).
// ---------------------------------------------------------------------------

export type RunRatiosState = { error?: string } | { ok?: boolean; score?: number; band?: string } | undefined;

export async function runRatiosAndScore(
  analysisId: string,
): Promise<RunRatiosState> {
  const user = await requireUser();
  if (!can(user, "write", "credit")) {
    return { error: "You do not have permission to run the scorecard." };
  }

  const [a] = await db
    .select()
    .from(creditAnalysis)
    .where(
      and(
        eq(creditAnalysis.creditAnalysisId, analysisId),
        isNull(creditAnalysis.deletedAt),
      ),
    );
  if (!a) return { error: "Credit analysis not found." };

  // Load linked statements, oldest → newest.
  const linkRows = await db
    .select({ financialStatementId: creditAnalysisFsLink.financialStatementId })
    .from(creditAnalysisFsLink)
    .where(eq(creditAnalysisFsLink.creditAnalysisId, analysisId));
  const fsIds = linkRows.map((l) => l.financialStatementId);
  if (fsIds.length === 0) {
    return { error: "No financial statements linked. Add one first." };
  }
  const fsRows = await db
    .select()
    .from(financialStatement)
    .where(
      and(
        inArray(financialStatement.financialStatementId, fsIds),
        isNull(financialStatement.deletedAt),
      ),
    )
    .orderBy(asc(financialStatement.periodEndDate));
  if (fsRows.length === 0) return { error: "Linked statements not found." };

  // Compute + persist ratios for every statement.
  const latest = fsRows[fsRows.length - 1];
  const prior = fsRows.length > 1 ? fsRows[fsRows.length - 2] : null;
  const latestRatios = computeRatios(latest, prior);

  // Look up an approved scorecard template for this obligor type.
  const [template] = await db
    .select()
    .from(scorecardTemplate)
    .where(
      and(
        eq(scorecardTemplate.obligorType, a.obligorType),
        eq(scorecardTemplate.status, "approved"),
        isNull(scorecardTemplate.deletedAt),
      ),
    )
    .orderBy(asc(scorecardTemplate.sectorCode)) // sector-specific first if present
    .limit(1);

  const sc = computeScorecard({
    ratios: latestRatios,
    obligorType: a.obligorType,
    templateWeights: (template?.factorWeights as Record<string, number> | null) ?? undefined,
  });

  await withRls(
    user.appUserId ?? crypto.randomUUID(),
    user.wall,
    [],
    async (tx) => {
      // 1. Replace ratio_result rows for the linked statements.
      await tx
        .delete(ratioResult)
        .where(inArray(ratioResult.financialStatementId, fsIds));
      for (const fs of fsRows) {
        const prev = fsRows
          .filter((x) => new Date(x.periodEndDate) < new Date(fs.periodEndDate))
          .sort((x, y) => new Date(y.periodEndDate).getTime() - new Date(x.periodEndDate).getTime())[0];
        const set = computeRatios(fs, prev ?? null);
        const rows = ratioSetToResultRows(set);
        if (rows.length === 0) continue;
        await tx.insert(ratioResult).values(
          rows.map((r) => ({
            financialStatementId: fs.financialStatementId,
            ratioCode: r.ratioCode as never,
            ratioValue: String(r.ratioValue),
            formulaSnapshot: r.formulaSnapshot,
          })),
        );
      }

      // 2. Insert a new scorecard instance (append-only; old ones retained).
      const [newSc] = await tx
        .insert(scorecard)
        .values({
          creditAnalysisId: analysisId,
          templateId: template?.templateId ?? null,
          templateVersion: template?.version ?? null,
          totalScore: String(sc.totalScore),
          band: sc.band,
        })
        .returning({ scorecardId: scorecard.scorecardId });
      if (!newSc) throw new Error("scorecard insert returned no row");

      // 3. Insert one credit_score row per sub-factor.
      for (const sf of sc.subFactors) {
        await tx.insert(creditScore).values({
          creditAnalysisId: analysisId,
          scorecardId: newSc.scorecardId,
          componentCode: sf.componentCode as never,
          componentScore: String(sf.score),
          componentWeight: String(sf.weight),
          overrideFlag: sf.justification.toLowerCase().includes("override"),
          overrideReason: sf.justification || null,
        });
      }

      // 4. Update the analysis: current score, internal rating, PD, action.
      const hadScore = a.currentCreditScore !== null;
      await tx
        .update(creditAnalysis)
        .set({
          currentCreditScore: String(sc.totalScore),
          internalRatingShort: sc.band,
          pd1y: String(BAND_PD_1Y[sc.band]),
          internalRatingAction: hadScore ? "maintain" : "assign",
          updatedByUserId: user.appUserId,
          updatedAt: new Date(),
        })
        .where(eq(creditAnalysis.creditAnalysisId, analysisId));
    },
  );

  revalidatePath(`/credit/${analysisId}`);
  revalidatePath(`/credit/${analysisId}/workspace`);
  revalidatePath("/credit");
  revalidatePath("/console/credit");
  revalidatePath(`/console/credit/${analysisId}`);
  return { ok: true, score: sc.totalScore, band: sc.band };
}

// ---------------------------------------------------------------------------
// advanceCommitteeState - committee-workflow stub (spec §9). The current
// schema has no CommitteeMeeting / CommitteeDecision tables (see report), so
// this captures the workflow as internal_rating_action + recommendation on
// credit_analysis. A future schema addition will persist meetings/decisions.
// ---------------------------------------------------------------------------

const advanceSchema = z.object({
  creditAnalysisId: z.uuidv4(),
  internalRatingAction: z.enum(INTERNAL_RATING_ACTIONS),
  recommendation: z.string().max(4000).optional(),
  watchlistFlag: z.coerce.boolean().optional(),
});

export type AdvanceCommitteeState = { error?: string } | { ok?: boolean } | undefined;

export async function advanceCommitteeState(
  _prev: AdvanceCommitteeState,
  formData: FormData,
): Promise<AdvanceCommitteeState> {
  const user = await requireUser();
  if (!can(user, "override", "credit_score")) {
    return { error: "You do not have permission to advance the committee state." };
  }

  const parsed = advanceSchema.safeParse({
    creditAnalysisId: formData.get("creditAnalysisId"),
    internalRatingAction: formData.get("internalRatingAction"),
    recommendation: formData.get("recommendation") || undefined,
    watchlistFlag:
      formData.get("watchlistFlag") === "on" || formData.get("watchlistFlag") === "true"
        ? true
        : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  if (!user.appUserId) {
    return { error: "Session is missing CRM user profile." };
  }

  // Load current state and validate committee transition.
  const [current] = await db
    .select({
      internalRatingAction: creditAnalysis.internalRatingAction,
      recommendation: creditAnalysis.recommendation,
      watchlistFlag: creditAnalysis.watchlistFlag,
    })
    .from(creditAnalysis)
    .where(
      and(
        eq(creditAnalysis.creditAnalysisId, input.creditAnalysisId),
        isNull(creditAnalysis.deletedAt),
      ),
    );
  if (!current) return { error: "Credit analysis not found." };

  const resolved = resolveCommitteeAdvance({
    currentAction: current.internalRatingAction,
    currentWatchlist: current.watchlistFlag,
    currentRecommendation: current.recommendation,
    nextAction: input.internalRatingAction as InternalRatingAction,
    recommendation: input.recommendation ?? null,
    watchlistFlag: input.watchlistFlag,
  });
  if (!resolved.ok) return { error: resolved.error };

  await runWithUserRls(user, async (tx, { appUserId }) => {
    await tx
      .update(creditAnalysis)
      .set({
        internalRatingAction: resolved.internalRatingAction,
        recommendation: resolved.recommendation,
        watchlistFlag: resolved.watchlistFlag,
        updatedByUserId: appUserId,
        updatedAt: new Date(),
      })
      .where(eq(creditAnalysis.creditAnalysisId, input.creditAnalysisId));
  });

  await writeAudit({
    actor: user,
    entityType: "credit_analysis",
    entityId: input.creditAnalysisId,
    operation: "approve",
    fieldName: "committee",
    oldValue: {
      action: current.internalRatingAction,
      phase: resolved.from,
    },
    newValue: {
      action: resolved.internalRatingAction,
      phase: resolved.to,
      watchlistFlag: resolved.watchlistFlag,
    },
  });

  revalidatePath(`/credit/${input.creditAnalysisId}`);
  revalidatePath("/credit");
  revalidatePath("/console/credit");
  revalidatePath(`/console/credit/${input.creditAnalysisId}`);
  return { ok: true };
}

// Re-export bandFromScore for UI consumers that want to derive a band from a
// stored total_score without re-running the engine.
export { bandFromScore };
