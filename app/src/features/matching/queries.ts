// Server-side data access for the Investor Matching Engine.
//
// Builds the IssuerProfile + InvestorProfile shapes the pure engine
// (engine.ts) scores, by deriving investor preferences from the LIVE schema:
//
//   - rating floor  → the worst (max rank) external_rating among issuers the
//                     investor has bought via deal_party(role=investor); falls
//                     back to the kind-based default when there is no history.
//   - tenor range   → min/max deal.target_tenor_years across the investor's
//                     deal history; kind default otherwise.
//   - mandate sect. → the distinct sector_code set of issuers the investor has
//                     bought; empty = open mandate.
//   - typical ticket→ the median deal_party.commitment_amount (role=investor).
//   - demat-ready   → EXISTS an active demat_account (account_status='active').
//   - KYC-current   → latest kyc_record.status='approved' AND not expired
//                     (valid_until IS NULL OR >= today).
//   - relationship  → COUNT(interaction) where party_id = the investor.
//
// The warm-intro path is the coverage banker (app_user) with the most
// interactions on the investor, most recent touch - joined to users.name for
// the display name. All batched (no N+1): a handful of group-by / window
// queries over the investor id set, then aggregated in JS.
//
// Every function is safe to call from Server Components. The pages are
// force-dynamic so no query runs at build time.

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  appUser,
  deal,
  dealParty,
  dematAccount,
  externalRating,
  interaction,
  kycRecord,
  party,
  partyTypeAssignment,
  sectorCode,
  users,
} from "@/db/schema";
import { can, type CrmUser } from "@/lib/rbac";
import type { RatingAgency } from "@/features/credit/ratingMap";
import {
  CRITERIA_ORDER,
  CRITERION_LABEL as CRITERION_LABEL_MAP,
  CRITERION_TAG as CRITERION_TAG_MAP,
  type CriterionResult,
  type IssuerProfile,
  type InvestorKind,
  type InvestorMatch,
  type InvestorProfile,
  type WarmIntroPath,
  classifyWarmIntro,
  defaultMinRatingRank,
  defaultTenorRange,
  inferInvestorKind,
  rankInvestors,
  DEFAULT_TICKET_CRORES,
} from "./engine";

const DAY_MS = 24 * 60 * 60 * 1000;

function canReadAllMatching(user?: Pick<CrmUser, "roles" | "permissions"> | null) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "matching") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function partyVisibilityClause(user?: CrmUser | null) {
  const scopedUserId = user?.appUserId;
  if (canReadAllMatching(user) || !scopedUserId) return undefined;

  return or(
    eq(party.assignedUserId, scopedUserId),
    eq(party.dataOwnerUserId, scopedUserId),
    eq(party.createdByUserId, scopedUserId),
  );
}

// ---------------------------------------------------------------------------
// Public types - the serializable shapes the pages render
// ---------------------------------------------------------------------------

/** A row in the issuer selector (the left pane of the workspace). */
export interface IssuerSummary {
  partyId: string;
  legalName: string;
  displayName: string | null;
  ratingValue: string | null;
  ratingRank: number | null;
  sectorCode: string | null;
  sectorLabel: string | null;
  dealId: string | null;
  dealCode: string | null;
  dealName: string | null;
  dealType: string | null;
  dealStatus: string | null;
  tenorYears: number | null;
  targetSizeCrores: number | null;
}

/** The workspace result: the selected issuer's profile + ranked matches. */
export interface MatchResult {
  issuer: IssuerProfile;
  matches: InvestorMatch[];
  /** Investors scanned (before ranking) - the denominator for the headline. */
  investorPool: number;
}

export type { InvestorMatch, InvestorProfile, IssuerProfile, CriterionResult, WarmIntroPath };

// ---------------------------------------------------------------------------
// getMatchableIssuers - issuers with a rating AND a deal to place
// ---------------------------------------------------------------------------

/**
 * Issuers that are matchable: they carry an external_rating AND are the issuer
 * on at least one deal (so the engine has a tenor + target size to match on).
 * Each row carries the issuer's "primary deal" - the most recent deal where
 * they are the issuer (active pipeline deals preferred over settled/closed).
 */
export async function getMatchableIssuers(
  user?: CrmUser | null,
): Promise<IssuerSummary[]> {
  // Issuer party ids (type assignment, not deleted).
  const issuerTypeRows = await db
    .select({ partyId: partyTypeAssignment.partyId })
    .from(partyTypeAssignment)
    .where(
      and(
        eq(partyTypeAssignment.partyType, "issuer"),
        isNull(partyTypeAssignment.deletedAt),
      ),
    );
  const issuerIds = issuerTypeRows.map((r) => r.partyId);
  if (issuerIds.length === 0) return [];

  // Issuer parties visible to this user.
  const issuerPartyRows = await db
    .select({
      partyId: party.partyId,
      legalName: party.legalName,
      displayName: party.displayName,
      industrySegmentId: party.industrySegmentId,
    })
    .from(party)
    .where(
      and(
        inArray(party.partyId, issuerIds),
        isNull(party.deletedAt),
        partyVisibilityClause(user),
      ),
    );
  const visibleIssuerIds = issuerPartyRows.map((r) => r.partyId);
  if (visibleIssuerIds.length === 0) return [];

  // Latest external_rating per issuer (long_term, with a rank).
  const ratingRows = await db
    .select({
      partyId: externalRating.partyId,
      ratingRank: externalRating.ratingRank,
      ratingValue: externalRating.ratingValue,
      agency: externalRating.agency,
      effectiveDate: externalRating.effectiveDate,
    })
    .from(externalRating)
    .where(
      and(
        inArray(externalRating.partyId, visibleIssuerIds),
        isNull(externalRating.deletedAt),
        eq(externalRating.ratingScale, "long_term"),
        sql`${externalRating.ratingRank} IS NOT NULL`,
      ),
    )
    .orderBy(asc(externalRating.partyId), desc(externalRating.effectiveDate));
  // Keep the latest per issuer (first row per partyId after the orderBy).
  const latestRatingByIssuer = new Map<
    string,
    { rank: number; value: string; agency: RatingAgency }
  >();
  for (const r of ratingRows) {
    if (latestRatingByIssuer.has(r.partyId)) continue;
    latestRatingByIssuer.set(r.partyId, {
      rank: r.ratingRank ?? 0,
      value: r.ratingValue ?? "-",
      agency: r.agency as RatingAgency,
    });
  }

  // Issuer sectors (party.industrySegmentId → sectorCode).
  const segmentIds = Array.from(
    new Set(issuerPartyRows.map((r) => r.industrySegmentId).filter((x): x is string => !!x)),
  );
  const sectorRows = segmentIds.length
    ? await db
        .select({ sectorCodeId: sectorCode.sectorCodeId, code: sectorCode.code, label: sectorCode.label })
        .from(sectorCode)
        .where(and(inArray(sectorCode.sectorCodeId, segmentIds), isNull(sectorCode.deletedAt)))
    : [];
  const sectorById = new Map(sectorRows.map((r) => [r.sectorCodeId, { code: r.code, label: r.label }] as const));

  // Deals where each issuer is the issuer role. Pick the "primary" deal per
  // issuer: prefer active pipeline statuses, then the latest by target close.
  const dealPartyRows = await db
    .select({
      dealId: dealParty.dealId,
      issuerPartyId: dealParty.partyId,
    })
    .from(dealParty)
    .where(
      and(
        eq(dealParty.role, "issuer"),
        isNull(dealParty.deletedAt),
        inArray(dealParty.partyId, visibleIssuerIds),
      ),
    );
  const issuerDealIds = Array.from(new Set(dealPartyRows.map((r) => r.dealId)));
  const dealRows = issuerDealIds.length
    ? await db
        .select({
          dealId: deal.dealId,
          dealCode: deal.dealCode,
          dealName: deal.dealName,
          dealType: deal.dealType,
          status: deal.status,
          targetTenorYears: deal.targetTenorYears,
          targetSize: deal.targetSize,
          targetCloseDate: deal.targetCloseDate,
          createdAt: deal.createdAt,
        })
        .from(deal)
        .where(and(inArray(deal.dealId, issuerDealIds), isNull(deal.deletedAt)))
    : [];

  // Map issuer → its deals.
  const dealsByIssuer = new Map<string, typeof dealRows>();
  for (const dp of dealPartyRows) {
    const arr = dealsByIssuer.get(dp.issuerPartyId) ?? [];
    const d = dealRows.find((x) => x.dealId === dp.dealId);
    if (d) arr.push(d);
    dealsByIssuer.set(dp.issuerPartyId, arr);
  }

  // Active-pipeline status priority (higher = more relevant to place now).
  const STATUS_PRIORITY: Record<string, number> = {
    lead: 9, mandated: 8, in_dd: 7, structuring: 6, rating_marketing: 5,
    pricing: 4, allocation: 3, on_hold: 2, settled: 1, closed: 0, dropped: -1,
  };
  const pickPrimaryDeal = (rows: typeof dealRows): (typeof dealRows)[number] | null => {
    if (rows.length === 0) return null;
    return rows.slice().sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status ?? ""] ?? 0;
      const pb = STATUS_PRIORITY[b.status ?? ""] ?? 0;
      if (pb !== pa) return pb - pa;
      // newer target close first (coerce date strings)
      const ta = a.targetCloseDate ? new Date(a.targetCloseDate).getTime() : 0;
      const tb = b.targetCloseDate ? new Date(b.targetCloseDate).getTime() : 0;
      return tb - ta;
    })[0] ?? null;
  };

  const out: IssuerSummary[] = [];
  for (const p of issuerPartyRows) {
    const rating = latestRatingByIssuer.get(p.partyId);
    if (!rating) continue; // matchable requires a rating
    const deals = dealsByIssuer.get(p.partyId) ?? [];
    const primary = pickPrimaryDeal(deals);
    if (!primary) continue; // matchable requires a deal to place
    const seg = p.industrySegmentId ? sectorById.get(p.industrySegmentId) : null;
    out.push({
      partyId: p.partyId,
      legalName: p.legalName,
      displayName: p.displayName,
      ratingValue: rating.value,
      ratingRank: rating.rank,
      sectorCode: seg?.code ?? null,
      sectorLabel: seg?.label ?? null,
      dealId: primary.dealId,
      dealCode: primary.dealCode,
      dealName: primary.dealName,
      dealType: primary.dealType,
      dealStatus: primary.status,
      tenorYears: primary.targetTenorYears != null ? Number(primary.targetTenorYears) : null,
      targetSizeCrores: primary.targetSize != null ? Number(primary.targetSize) : null,
    });
  }
  // Stable order: by legal name.
  out.sort((a, b) => a.legalName.localeCompare(b.legalName));
  return out;
}

// ---------------------------------------------------------------------------
// getIssuerMatchProfile - the full IssuerProfile for the engine
// ---------------------------------------------------------------------------

export async function getIssuerMatchProfile(
  issuerId: string,
  user?: CrmUser | null,
): Promise<IssuerProfile | null> {
  const summaries = await getMatchableIssuers(user);
  const s = summaries.find((x) => x.partyId === issuerId);
  if (!s) return null;
  return summarizeIssuer(s);
}

/** Convert an IssuerSummary into the IssuerProfile the engine scores. */
function summarizeIssuer(s: IssuerSummary): IssuerProfile {
  const family = s.sectorCode ? s.sectorCode.split(".")[0] ?? null : null;
  return {
    partyId: s.partyId,
    legalName: s.legalName,
    displayName: s.displayName,
    ratingRank: s.ratingRank,
    ratingValue: s.ratingValue,
    ratingAgency: null,
    ratingBand: null,
    sectorCode: s.sectorCode,
    sectorLabel: s.sectorLabel,
    sectorFamily: family,
    tenorYears: s.tenorYears,
    targetSizeCrores: s.targetSizeCrores,
    dealId: s.dealId,
    dealCode: s.dealCode,
    dealName: s.dealName,
    dealType: s.dealType,
    dealStatus: s.dealStatus,
  };
}

// ---------------------------------------------------------------------------
// Investor preference derivation - batched over the investor id set
// ---------------------------------------------------------------------------

/**
 * Build InvestorProfile[] for every investor (party type=investor), deriving
 * each one's preferences from deal history + kind heuristics + live
 * demat/KYC/interaction state. Pure data assembly - the engine does the
 * scoring. Batched: a handful of group-by queries over the investor ids, no
 * N+1.
 */
export async function loadInvestorProfiles(
  user?: CrmUser | null,
): Promise<InvestorProfile[]> {
  // All investor party ids.
  const invTypeRows = await db
    .select({ partyId: partyTypeAssignment.partyId })
    .from(partyTypeAssignment)
    .where(
      and(
        eq(partyTypeAssignment.partyType, "investor"),
        isNull(partyTypeAssignment.deletedAt),
      ),
    );
  const allInvestorIds = invTypeRows.map((r) => r.partyId);
  if (allInvestorIds.length === 0) return [];

  // Investor party rows (name / nature).
  const investorPartyRows = await db
    .select({
      partyId: party.partyId,
      legalName: party.legalName,
      displayName: party.displayName,
      partyNature: party.partyNature,
      isKycComplete: party.isKycComplete,
      isKycStale: party.isKycStale,
    })
    .from(party)
    .where(
      and(
        inArray(party.partyId, allInvestorIds),
        isNull(party.deletedAt),
        partyVisibilityClause(user),
      ),
    );
  const investorIds = investorPartyRows.map((r) => r.partyId);
  if (investorIds.length === 0) return [];

  // ---- Deal-history derivation: for each investor, the issuers they've bought
  // (via deal_party role=investor → deal → deal_party role=issuer), with the
  // issuer's latest rating rank + sector, the deal's tenor, and the investor's
  // commitment. Aggregated in JS.
  const invDealRows = await db
    .select({
      investorId: dealParty.partyId,
      dealId: dealParty.dealId,
      commitmentAmount: dealParty.commitmentAmount,
    })
    .from(dealParty)
    .where(
      and(
        eq(dealParty.role, "investor"),
        isNull(dealParty.deletedAt),
        inArray(dealParty.partyId, investorIds),
      ),
    );

  const invDealIds = Array.from(new Set(invDealRows.map((r) => r.dealId)));
  // deal → issuer + tenor
  const dealIssuerRows = invDealIds.length
    ? await db
        .select({
          dealId: dealParty.dealId,
          issuerPartyId: dealParty.partyId,
        })
        .from(dealParty)
        .where(
          and(
            eq(dealParty.role, "issuer"),
            isNull(dealParty.deletedAt),
            inArray(dealParty.dealId, invDealIds),
          ),
        )
    : [];
  const dealTenorRows = invDealIds.length
    ? await db
        .select({
          dealId: deal.dealId,
          targetTenorYears: deal.targetTenorYears,
        })
        .from(deal)
        .where(and(inArray(deal.dealId, invDealIds), isNull(deal.deletedAt)))
    : [];
  const issuerIdsInHistory = Array.from(
    new Set(dealIssuerRows.map((r) => r.issuerPartyId)),
  );
  // Latest rating per issuer-in-history.
  const histRatingRows = issuerIdsInHistory.length
    ? await db
        .select({
          partyId: externalRating.partyId,
          ratingRank: externalRating.ratingRank,
          effectiveDate: externalRating.effectiveDate,
        })
        .from(externalRating)
        .where(
          and(
            inArray(externalRating.partyId, issuerIdsInHistory),
            isNull(externalRating.deletedAt),
            sql`${externalRating.ratingRank} IS NOT NULL`,
          ),
        )
        .orderBy(asc(externalRating.partyId), desc(externalRating.effectiveDate))
    : [];
  const histRatingByIssuer = new Map<string, number>();
  for (const r of histRatingRows) {
    if (histRatingByIssuer.has(r.partyId)) continue;
    histRatingByIssuer.set(r.partyId, r.ratingRank ?? 0);
  }
  // Sectors of issuers-in-history.
  const histIssuerRows = issuerIdsInHistory.length
    ? await db
        .select({
          partyId: party.partyId,
          industrySegmentId: party.industrySegmentId,
        })
        .from(party)
        .where(and(inArray(party.partyId, issuerIdsInHistory), isNull(party.deletedAt)))
    : [];
  const histSegIds = Array.from(
    new Set(histIssuerRows.map((r) => r.industrySegmentId).filter((x): x is string => !!x)),
  );
  const histSectorRows = histSegIds.length
    ? await db
        .select({ sectorCodeId: sectorCode.sectorCodeId, code: sectorCode.code })
        .from(sectorCode)
        .where(and(inArray(sectorCode.sectorCodeId, histSegIds), isNull(sectorCode.deletedAt)))
    : [];
  const histSectorById = new Map(histSectorRows.map((r) => [r.sectorCodeId, r.code] as const));

  // Index deal → issuer + tenor.
  const issuerByDeal = new Map<string, string>();
  for (const r of dealIssuerRows) issuerByDeal.set(r.dealId, r.issuerPartyId);
  const tenorByDeal = new Map<string, number | null>();
  for (const r of dealTenorRows)
    tenorByDeal.set(r.dealId, r.targetTenorYears != null ? Number(r.targetTenorYears) : null);

  // Per-investor history aggregate.
  interface HistAgg {
    ratingRanks: number[];
    sectors: Set<string>;
    tenors: number[];
    tickets: number[];
  }
  const histByInvestor = new Map<string, HistAgg>();
  for (const r of invDealRows) {
    const agg = histByInvestor.get(r.investorId) ?? {
      ratingRanks: [],
      sectors: new Set<string>(),
      tenors: [],
      tickets: [],
    };
    const issuerId = issuerByDeal.get(r.dealId);
    if (issuerId) {
      const rank = histRatingByIssuer.get(issuerId);
      if (rank != null && rank > 0) agg.ratingRanks.push(rank);
      const issuerRow = histIssuerRows.find((x) => x.partyId === issuerId);
      const segId = issuerRow?.industrySegmentId;
      if (segId) {
        const code = histSectorById.get(segId);
        if (code) agg.sectors.add(code);
      }
    }
    const tenor = tenorByDeal.get(r.dealId);
    if (tenor != null) agg.tenors.push(tenor);
    if (r.commitmentAmount != null) {
      const c = Number(r.commitmentAmount);
      if (Number.isFinite(c)) agg.tickets.push(c);
    }
    histByInvestor.set(r.investorId, agg);
  }

  // ---- Demat-ready: investors with an active demat account.
  const dematRows = await db
    .select({ partyId: dematAccount.partyId })
    .from(dematAccount)
    .where(
      and(
        inArray(dematAccount.partyId, investorIds),
        eq(dematAccount.accountStatus, "active"),
        isNull(dematAccount.deletedAt),
      ),
    );
  const dematReadySet = new Set(dematRows.map((r) => r.partyId));

  // ---- KYC-current: latest kyc_record per investor (approved + not expired).
  const kycRows = await db
    .select({
      partyId: kycRecord.partyId,
      status: kycRecord.status,
      validUntil: kycRecord.validUntil,
      createdAt: kycRecord.createdAt,
    })
    .from(kycRecord)
    .where(and(inArray(kycRecord.partyId, investorIds), isNull(kycRecord.deletedAt)))
    .orderBy(asc(kycRecord.partyId), desc(kycRecord.createdAt));
  const latestKycByInvestor = new Map<
    string,
    { status: string; validUntil: Date | null }
  >();
  for (const r of kycRows) {
    if (latestKycByInvestor.has(r.partyId)) continue;
    const vu = r.validUntil ? new Date(r.validUntil) : null;
    latestKycByInvestor.set(r.partyId, { status: r.status ?? "pending", validUntil: vu });
  }

  // ---- Relationship: interaction count per investor (party_id = investor).
  const relRows = await db
    .select({
      partyId: interaction.partyId,
      n: sql<number>`count(*)::int`,
    })
    .from(interaction)
    .where(
      and(
        inArray(interaction.partyId, investorIds),
        isNull(interaction.deletedAt),
      ),
    )
    .groupBy(interaction.partyId);
  const relCountByInvestor = new Map<string, number>();
  for (const r of relRows) {
    if (r.partyId) relCountByInvestor.set(r.partyId, r.n);
  }

  // Per-investor deal count (distinct deal_id) - precomputed once so the
  // profile assembly stays O(n), not O(n²) over the deal_party rows.
  const dealCountByInvestor = new Map<string, number>();
  for (const r of invDealRows) {
    dealCountByInvestor.set(r.investorId, (dealCountByInvestor.get(r.investorId) ?? 0) + 1);
  }

  // ---- Assemble profiles.
  const today = Date.now();
  return investorPartyRows.map((p) => {
    const kind = inferInvestorKind({
      legalName: p.legalName,
      displayName: p.displayName,
      partyNature: p.partyNature,
    });
    const agg = histByInvestor.get(p.partyId);
    const hasHistory = !!agg && (agg.ratingRanks.length > 0 || agg.tenors.length > 0);

    // Rating floor: worst (max) rank accepted in history, else kind default.
    let minRatingRank: number;
    if (agg && agg.ratingRanks.length > 0) {
      minRatingRank = Math.max(...agg.ratingRanks);
    } else {
      minRatingRank = defaultMinRatingRank(kind);
    }

    // Tenor range: from history, else kind default.
    let tenorMin: number;
    let tenorMax: number;
    if (agg && agg.tenors.length > 0) {
      tenorMin = Math.min(...agg.tenors);
      tenorMax = Math.max(...agg.tenors);
      // Widen by 1y on each side so a single-deal history isn't a point band.
      tenorMin = Math.max(1, tenorMin - 1);
      tenorMax = tenorMax + 1;
    } else {
      [tenorMin, tenorMax] = defaultTenorRange(kind);
    }

    // Mandate sectors: from history (empty = open mandate).
    const mandateSectors = agg ? Array.from(agg.sectors) : [];

    // Typical ticket: median commitment (₹ Cr), else default.
    let typicalTicket: number;
    if (agg && agg.tickets.length > 0) {
      typicalTicket = median(agg.tickets);
    } else {
      typicalTicket = DEFAULT_TICKET_CRORES;
    }

    // KYC current: approved + (validUntil null or future) + not stale.
    const kyc = latestKycByInvestor.get(p.partyId);
    let kycCurrent = false;
    const kycStatus = kyc?.status ?? null;
    let kycValidUntil: string | null = null;
    if (kyc) {
      kycValidUntil = kyc.validUntil ? kyc.validUntil.toISOString() : null;
      const notExpired = !kyc.validUntil || kyc.validUntil.getTime() >= today;
      kycCurrent = kyc.status === "approved" && notExpired && p.isKycStale !== true;
    }

    const interactionCount = relCountByInvestor.get(p.partyId) ?? 0;

    return {
      partyId: p.partyId,
      legalName: p.legalName,
      displayName: p.displayName,
      partyNature: p.partyNature,
      kind,
      minRatingRank,
      minRatingValue: rankSymbolFor(minRatingRank),
      tenorMin,
      tenorMax,
      mandateSectors,
      typicalTicketCrores: typicalTicket,
      dematReady: dematReadySet.has(p.partyId),
      kycCurrent,
      kycStatus,
      kycValidUntil,
      hasRelationship: interactionCount > 0,
      interactionCount,
      dealCount: dealCountByInvestor.get(p.partyId) ?? 0,
      preferenceSource: (hasHistory ? "history" : "kind") as "history" | "kind" | "default",
    } satisfies InvestorProfile;
  });
}

// ---------------------------------------------------------------------------
// Warm intro path - the coverage banker with the strongest relationship
// ---------------------------------------------------------------------------

/**
 * For a single investor: the coverage banker (app_user) with the most
 * interactions on that investor, most recent touch. Joined to users.name for
 * the display name. Returns null when the investor has no interactions.
 */
export async function getWarmIntroPath(
  investorId: string,
): Promise<WarmIntroPath | null> {
  const map = await getWarmIntroByInvestor([investorId]);
  return map.get(investorId) ?? null;
}

/**
 * Batched warm-intro: for each investor id, the banker with the most
 * interactions (tie-break most recent). One windowed query + one
 * app_user/users join. Returns a Map keyed by investor partyId; investors with
 * no interactions map to null.
 */
export async function getWarmIntroByInvestor(
  investorIds: string[],
): Promise<Map<string, WarmIntroPath | null>> {
  const out = new Map<string, WarmIntroPath | null>();
  if (investorIds.length === 0) return out;
  // Seed nulls so investors with no interactions are represented.
  for (const id of investorIds) out.set(id, null);

  // Per (investor, banker) interaction count + last touch, ranked so the top
  // banker per investor is row_number() = 1.
  const rows = await db.execute(sql`
    WITH banker_touches AS (
      SELECT
        i.party_id AS investor_id,
        i.user_id AS banker_id,
        count(*)::int AS touch_count,
        max(i.occurred_at) AS last_touch,
        (array_agg(i.channel ORDER BY i.occurred_at DESC NULLS LAST))[1] AS last_channel,
        (array_agg(i.subject ORDER BY i.occurred_at DESC NULLS LAST))[1] AS last_subject
      FROM ${interaction} i
      WHERE i.party_id = ANY(${sql`ARRAY[${sql.join(
        investorIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}]::uuid[]`})
        AND i.user_id IS NOT NULL
        AND i.deleted_at IS NULL
      GROUP BY i.party_id, i.user_id
    ),
    ranked AS (
      SELECT
        bt.*,
        row_number() OVER (
          PARTITION BY bt.investor_id
          ORDER BY bt.touch_count DESC, bt.last_touch DESC NULLS LAST
        ) AS rn
      FROM banker_touches bt
    )
    SELECT
      r.investor_id,
      r.banker_id,
      r.touch_count,
      r.last_touch,
      r.last_channel,
      r.last_subject,
      au.email AS banker_email,
      au.desk AS banker_desk,
      u.name AS banker_name
    FROM ranked r
    JOIN ${appUser} au ON au.user_id = r.banker_id
    -- Auth.js identity link on the actual Neon schema: users.app_user_id
    -- points to app_user.user_id (the Drizzle schema in src/db/schema/auth.ts
    -- declares users.app_user_id; app_user has NO auth_user_id column despite
    -- earlier comments claiming otherwise). users.name holds the display name.
    LEFT JOIN ${users} u ON u.app_user_id = au.user_id
    WHERE r.rn = 1
  `);

  for (const r of rows as unknown as Array<{
    investor_id: string;
    banker_id: string;
    touch_count: number;
    last_touch: Date | string | null;
    last_channel: string | null;
    last_subject: string | null;
    banker_email: string | null;
    banker_desk: string | null;
    banker_name: string | null;
  }>) {
    const lastDate = toDate(r.last_touch);
    const strength = classifyWarmIntro({
      interactionCount: r.touch_count ?? 0,
      lastTouchAt: lastDate,
    });
    out.set(r.investor_id, {
      bankerUserId: r.banker_id,
      bankerName: r.banker_name ?? r.banker_email ?? "Coverage desk",
      bankerEmail: r.banker_email ?? "",
      bankerDesk: r.banker_desk,
      interactionCount: r.touch_count ?? 0,
      lastTouchAt: lastDate ? lastDate.toISOString() : null,
      lastChannel: r.last_channel,
      lastSubject: r.last_subject,
      strength,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// getInvestorMatches - score + rank all investors against an issuer
// ---------------------------------------------------------------------------

/**
 * Load the issuer profile, load + derive every investor's preferences, resolve
 * each investor's warm-intro path (batched), then rank. Returns the ranked
 * InvestorMatch[] (highest score first). `limit` caps the list (the workspace
 * shows the top slice; the matrix page can request all).
 */
export async function getInvestorMatches(
  issuerId: string,
  limit?: number,
  user?: CrmUser | null,
): Promise<MatchResult | null> {
  const issuer = await getIssuerMatchProfile(issuerId, user);
  if (!issuer) return null;

  const investors = await loadInvestorProfiles(user);
  const warm = await getWarmIntroByInvestor(investors.map((i) => i.partyId));
  const matches = rankInvestors(issuer, investors, warm);
  return {
    issuer,
    investorPool: investors.length,
    matches: typeof limit === "number" ? matches.slice(0, limit) : matches,
  };
}

// ---------------------------------------------------------------------------
// getMatchMatrix - the full issuer × investors grid for the [id] page
// ---------------------------------------------------------------------------

export interface MatchMatrix {
  issuer: IssuerProfile;
  matches: InvestorMatch[];
  investorPool: number;
  /** The criteria in column order (the matrix header). */
  criteria: { key: string; label: string; tag: string }[];
}

export async function getMatchMatrix(
  issuerId: string,
  user?: CrmUser | null,
): Promise<MatchMatrix | null> {
  // Cap the streamed matches at MATRIX_MATCH_CAP. The matrix view renders only
  // the top MAX_ROWS (100) and "Select all" selects the top 100, so shipping
  // the full 4100-investor ranking only bloats the SSR payload (~10 MB) - the
  // extra rows are never rendered. 300 gives the criteria-filter toggles
  // headroom to re-filter/re-sort within a broad top slice while cutting the
  // payload ~15x. investorPool stays the true denominator for the headline.
  const MATRIX_MATCH_CAP = 300;
  const result = await getInvestorMatches(issuerId, MATRIX_MATCH_CAP, user);
  if (!result) return null;
  return {
    issuer: result.issuer,
    matches: result.matches,
    investorPool: result.investorPool,
    criteria: CRITERIA_ORDER.map((k) => ({
      key: k,
      label: CRITERION_LABEL_MAP[k],
      tag: CRITERION_TAG_MAP[k],
    })),
  };
}

// Re-export the criterion labels/tags for the matrix header (imported at the
// top of this module alongside the engine types).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function toDate(d: Date | string | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  const parsed = new Date(d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Display symbol for a rank (CRISIL canonical). Local import-free to avoid a
 *  circular dep with ratingMap at module-eval time. */
function rankSymbolFor(rank: number): string {
  // Mirror engine.rankToSymbol without importing it (engine imports ratingMap;
  // importing engine here is fine, but keep this self-contained for clarity).
  if (rank <= 0) return "NR";
  const band =
    rank <= 2 ? "AAA"
    : rank === 3 ? "AA"
    : rank === 4 ? "AA−"
    : rank === 5 ? "A+"
    : rank === 6 ? "A"
    : rank === 7 ? "A−"
    : rank === 8 ? "BBB+"
    : rank === 9 ? "BBB"
    : rank <= 10 ? "BBB−"
    : "BB";
  return band;
}
