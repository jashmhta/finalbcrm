// Server-side financial-model data access (FINANCIAL_MODELING_SPEC §6, §7.1).
// Reads the `financial_model` table (§2.17) and joins deal/party for the
// library list and detail views. RLS-aware once policies are migrated; until
// then these are plain queries (withRls GUCs are no-ops on tables without RLS).

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { deal, dealParty, financialModel, party } from "@/db/schema";
import { can, type CrmUser } from "@/lib/rbac";

export interface ModelListItem {
  financialModelId: string;
  modelType: string;
  version: number;
  scenarioTag: string | null;
  currencyCode: string | null;
  dealId: string | null;
  dealCode: string | null;
  dealName: string | null;
  partyId: string | null;
  partyName: string | null;
  computedAt: Date | null;
  createdAt: Date | null;
  /** Best-effort headline output extracted from the JSONB outputs column. */
  headline: string;
}

export interface ModelListResult {
  rows: ModelListItem[];
  total: number;
}

function canReadAllModels(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "financial_model") ||
    can(user, "read_all", "model") ||
    can(user, "manage", "user")
  );
}

function modelVisibilityClause(user?: CrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllModels(user) || !userId) return undefined;
  return or(
    eq(financialModel.computedByUserId, userId),
    eq(financialModel.approvedByUserId, userId),
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
    eq(deal.leadUserId, userId),
    eq(deal.creditAnalystUserId, userId),
    eq(deal.createdByUserId, userId),
    sql`EXISTS (
      SELECT 1
      FROM deal_party dp_scope
      JOIN party p_scope ON p_scope.party_id = dp_scope.party_id
      WHERE dp_scope.deal_id = ${financialModel.dealId}
        AND dp_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${userId}
          OR p_scope.data_owner_user_id = ${userId}
          OR p_scope.created_by_user_id = ${userId}
        )
    )`,
  );
}

/**
 * Headline output per model type (§8.1 - "key headline output" column). Pulls
 * a single representative number from the JSONB outputs so the library list
 * can show "YTM 8.42%" / "Min DSCR 1.18x" / "EV ₹420 Cr" without a full parse.
 */
function headlineOutput(
  modelType: string,
  outputs: unknown,
): string {
  if (!outputs || typeof outputs !== "object") return "-";
  const o = outputs as Record<string, unknown>;
  const fmt2 = (x: unknown) =>
    typeof x === "number" && Number.isFinite(x) ? x.toFixed(2) : null;
  switch (modelType) {
    case "bond_pricing": {
      const ytm = o.ytm;
      if (typeof ytm === "number") return `YTM ${(ytm * 100).toFixed(3)}%`;
      const cp = o.cleanPrice;
      if (typeof cp === "number") return `Clean ₹${cp.toFixed(3)}`;
      return "-";
    }
    case "project_finance": {
      const min = fmt2(o.minDscr);
      return min ? `Min DSCR ${min}×` : "-";
    }
    case "dcf":
    case "valuation": {
      const ev = o.enterpriseValue ?? o.equityValue;
      if (typeof ev === "number") {
        return `EV ₹${(ev / 10_000_000).toFixed(2)} Cr`;
      }
      return "-";
    }
    case "securitization": {
      const senior = Array.isArray(o.tranches) ? o.tranches[0] : null;
      const lcm =
        senior && typeof senior === "object"
          ? (senior as Record<string, unknown>).lossCoverageMultiple
          : null;
      return typeof lcm === "number"
        ? `Senior coverage ${lcm.toFixed(2)}×`
        : "-";
    }
    case "lbo": {
      const irr = o.irr;
      return typeof irr === "number" ? `IRR ${(irr * 100).toFixed(1)}%` : "-";
    }
    default:
      return "-";
  }
}

/**
 * Paginated model library list, optionally filtered by model_type. Joins deal
 * + party for chips. Newest first.
 */
export async function listModels({
  modelType,
  limit = 50,
  user,
}: {
  modelType?: string;
  limit?: number;
  user?: CrmUser | null;
} = {}): Promise<ModelListResult> {
  const where = and(
    isNull(financialModel.deletedAt),
    modelType ? eq(financialModel.modelType, modelType as never) : undefined,
    modelVisibilityClause(user),
  );

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        financialModelId: financialModel.financialModelId,
        modelType: financialModel.modelType,
        version: financialModel.version,
        scenarioTag: financialModel.scenarioTag,
        currencyCode: financialModel.currencyCode,
        dealId: financialModel.dealId,
        dealCode: deal.dealCode,
        dealName: deal.dealName,
        partyId: financialModel.partyId,
        partyName: party.legalName,
        computedAt: financialModel.computedAt,
        createdAt: financialModel.createdAt,
        outputs: financialModel.outputs,
      })
      .from(financialModel)
      .leftJoin(deal, eq(deal.dealId, financialModel.dealId))
      .leftJoin(party, eq(party.partyId, financialModel.partyId))
      .where(where)
      .orderBy(desc(financialModel.createdAt))
      .limit(limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(financialModel)
      .where(where),
  ]);

  return {
    total: n ?? 0,
    rows: rows.map((r) => ({
      financialModelId: r.financialModelId,
      modelType: r.modelType,
      version: r.version,
      scenarioTag: r.scenarioTag,
      currencyCode: r.currencyCode,
      dealId: r.dealId,
      dealCode: r.dealCode,
      dealName: r.dealName,
      partyId: r.partyId,
      partyName: r.partyName,
      computedAt: r.computedAt,
      createdAt: r.createdAt,
      headline: headlineOutput(r.modelType, r.outputs),
    })),
  };
}

export interface ModelDetail {
  model: typeof financialModel.$inferSelect;
  dealCode: string | null;
  dealName: string | null;
  partyName: string | null;
  parentVersion: number | null;
}

export async function getModelDetail(
  modelId: string,
  user?: CrmUser | null,
): Promise<ModelDetail | null> {
  const [row] = await db
    .select({
      model: financialModel,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
      partyName: party.legalName,
      parentVersion: financialModel.version, // placeholder; resolved below if parent exists
    })
    .from(financialModel)
    .leftJoin(deal, eq(deal.dealId, financialModel.dealId))
    .leftJoin(party, eq(party.partyId, financialModel.partyId))
    .where(
      and(
        eq(financialModel.financialModelId, modelId),
        isNull(financialModel.deletedAt),
        modelVisibilityClause(user),
      ),
    );
  if (!row) return null;

  let parentVersion: number | null = null;
  if (row.model.parentModelId) {
    const [parent] = await db
      .select({ version: financialModel.version })
      .from(financialModel)
      .where(eq(financialModel.financialModelId, row.model.parentModelId));
    parentVersion = parent?.version ?? null;
  }

  return {
    model: row.model,
    dealCode: row.dealCode,
    dealName: row.dealName,
    partyName: row.partyName,
    parentVersion,
  };
}
