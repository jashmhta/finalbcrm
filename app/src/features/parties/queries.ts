// Server-side party data access. RLS-aware once policies are migrated; until
// then these are plain queries (the GUCs set by withRls are no-ops on tables
// without RLS enabled). All functions are safe to call from Server Components.

import { unstable_cache } from "next/cache";

import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  canReadAllInScope,
  type CrmUser,
} from "@/lib/rbac";
import {
  brandFromDesk,
  isFirmWide,
  partyBrandSqlValues,
} from "@/lib/org";
import {
  address,
  appUser,
  contact,
  deal,
  dealParty,
  party,
  partyContact,
  partyTypeAssignment,
  relationship,
} from "@/db/schema";

export interface PartyListItem {
  partyId: string;
  legalName: string;
  displayName: string | null;
  partyNature: string;
  status: string;
  isKycComplete: boolean | null;
  /** KYC risk rating (low/medium/high) - drives the risk filter on the explorer. */
  kycRiskRating: string | null;
  city: string | null;
  types: string[];
  createdAt: Date | null;
  /** Active (non-deleted) relationship edges where this party is parent OR child.
   *  Powers the relationship-strength derivation in the view layer. */
  relationshipCount: number;
  /** Active deal_party rows for this party - mandate footprint. */
  dealCount: number;
  /** Active party_contact rows - people linked. */
  contactCount: number;
  /** Most recent "touch" across the party's own updatedAt + the createdAt of its
   *  deal_party / party_contact / relationship edges. Display-only relative time. */
  lastTouchAt: Date | null;
  assignedUserId: string | null;
  annualTurnoverCr: string | null;
  turnoverBand: string | null;
  industrySector: string | null;
  industrySubsector: string | null;
  latestRating: string | null;
  latestRatingAgency: string | null;
  latestRatingYear: number | null;
  investorType: string | null;
  portfolioSizeBand: string | null;
  riskAppetite: string | null;
  highYieldAppetite: boolean | null;
}

export interface PartyListSummary {
  total: number;
  active: number;
  kycComplete: number;
  onboarding: number;
}

/**
 * Unfiltered ledger summary (total / active / kycComplete / onboarding) for the
 * parties explorer KPI strip. This is a slow-changing GLOBAL aggregate (does
 * not depend on the current search `q`), so it is wrapped in unstable_cache
 * with a 60s revalidate - a cache hit skips the aggregate scan on every page
 * load of /parties. The party LIST rows + the filtered `total` stay dynamic on
 * the force-dynamic page. Payload is all numbers → JSON-serializable.
 */
async function fetchPartyListSummary(): Promise<PartyListSummary> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${party.status} = 'active')::int`,
      kycComplete:
        sql<number>`count(*) filter (where ${party.isKycComplete} = true)::int`,
      onboarding:
        sql<number>`count(*) filter (where ${party.status} = 'onboarding')::int`,
    })
    .from(party)
    .where(isNull(party.deletedAt));
  return row ?? { total: 0, active: 0, kycComplete: 0, onboarding: 0 };
}

export const getPartyListSummary = unstable_cache(
  fetchPartyListSummary,
  ["party-list-summary-v1"],
  { revalidate: 60, tags: ["party-list-summary"] },
);

export interface PartyListResult {
  rows: PartyListItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Unfiltered ledger totals (independent of `q`) - the summary strip above
   *  the explorer, mirroring the deals KPI strip. */
  summary: PartyListSummary;
}

export interface PartyListFilters {
  type?: string;
  risk?: string;
  turnover?: string;
  sector?: string;
  rating?: string;
  agency?: string;
  ratingYear?: number;
  investorType?: string;
  portfolioSize?: string;
  riskAppetite?: string;
  highYield?: boolean;
  assignedUserId?: string;
}

function canReadAllParties(user?: CrmUser | null) {
  if (!user) return true; // unscoped system callers
  return canReadAllInScope(user);
}

/**
 * Visibility:
 * - Employee: only assigned / owned / created parties
 * - Brand super (Capital or Bonds): all parties in brand + shared
 * - Firm-wide super (shared brand): everything
 */
function partyVisibilityClause(user?: CrmUser | null) {
  if (!user?.appUserId) return undefined;
  if (!canReadAllParties(user)) {
    return or(
      eq(party.assignedUserId, user.appUserId),
      eq(party.dataOwnerUserId, user.appUserId),
      eq(party.createdByUserId, user.appUserId),
    );
  }
  // Super / admin: brand-scope filter unless firm-wide
  if (isFirmWide(user.brandScope)) return undefined;
  const brands = partyBrandSqlValues(user.brandScope);
  return inArray(party.brandOrigin, brands as ("binarycapital" | "binarybonds" | "shared")[]);
}

/** Active staff list for assign-to dropdown (super/admin). */
export async function listAssignableStaff(user: CrmUser) {
  if (!canReadAllInScope(user)) return [];
  const rows = await db
    .select({
      userId: appUser.userId,
      email: appUser.email,
      desk: appUser.desk,
    })
    .from(appUser)
    .where(and(eq(appUser.isActive, true), isNull(appUser.deletedAt)))
    .orderBy(asc(appUser.email))
    .limit(200);

  // Brand-scoped supers only assign within their brand employees
  return rows
    .filter((r) => {
      if (isFirmWide(user.brandScope)) return true;
      const b = brandFromDesk(r.desk as string | null);
      return b === user.brandScope || b === "shared";
    })
    .map((r) => ({
      userId: r.userId,
      email: r.email,
      desk: r.desk as string | null,
      brand: brandFromDesk(r.desk as string | null),
      label: r.email,
    }));
}

async function fetchScopedPartyListSummary(
  user?: CrmUser | null,
): Promise<PartyListSummary> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) filter (where ${party.status} = 'active')::int`,
      kycComplete:
        sql<number>`count(*) filter (where ${party.isKycComplete} = true)::int`,
      onboarding:
        sql<number>`count(*) filter (where ${party.status} = 'onboarding')::int`,
    })
    .from(party)
    .where(and(isNull(party.deletedAt), partyVisibilityClause(user)));
  return row ?? { total: 0, active: 0, kycComplete: 0, onboarding: 0 };
}

/**
 * Paginated party list with fuzzy name search. Three queries (page rows,
 * types, current-city) - no N+1. Keyset pagination is the §5.4 target; for
 * this foundation OFFSET is fine at the expected row count.
 */
export async function listParties({
  q,
  page = 1,
  pageSize = 25,
  filters = {},
  user,
}: {
  q?: string;
  page?: number;
  pageSize?: number;
  filters?: PartyListFilters;
  user?: CrmUser | null;
}): Promise<PartyListResult> {
  const clauses = [isNull(party.deletedAt)];
  const visibility = partyVisibilityClause(user);
  if (visibility) clauses.push(visibility);
  if (q) {
    clauses.push(
      or(
        ilike(party.legalName, `%${q}%`),
        ilike(party.displayName, `%${q}%`),
      )!,
    );
  }
  if (filters.risk) clauses.push(eq(party.kycRiskRating, filters.risk as "low" | "medium" | "high"));
  if (filters.type) {
    clauses.push(sql`exists (
      select 1 from party_type_assignment pta
      where pta.party_id = ${party.partyId}
        and pta.party_type = ${filters.type}
        and pta.deleted_at is null
    )`);
  }
  if (filters.turnover) clauses.push(eq(party.turnoverBand, filters.turnover));
  if (filters.sector) clauses.push(eq(party.industrySector, filters.sector));
  if (filters.rating) clauses.push(eq(party.latestRating, filters.rating));
  if (filters.agency) clauses.push(eq(party.latestRatingAgency, filters.agency));
  if (filters.ratingYear) clauses.push(eq(party.latestRatingYear, filters.ratingYear));
  if (filters.investorType) clauses.push(eq(party.investorType, filters.investorType));
  if (filters.portfolioSize) clauses.push(eq(party.portfolioSizeBand, filters.portfolioSize));
  if (filters.riskAppetite) clauses.push(eq(party.riskAppetite, filters.riskAppetite));
  if (filters.highYield !== undefined) clauses.push(eq(party.highYieldAppetite, filters.highYield));
  if (filters.assignedUserId) clauses.push(eq(party.assignedUserId, filters.assignedUserId));

  const where = and(...clauses);

  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        partyId: party.partyId,
        legalName: party.legalName,
        displayName: party.displayName,
        partyNature: party.partyNature,
        status: party.status,
        isKycComplete: party.isKycComplete,
        kycRiskRating: party.kycRiskRating,
        createdAt: party.createdAt,
        updatedAt: party.updatedAt,
        assignedUserId: party.assignedUserId,
        annualTurnoverCr: party.annualTurnoverCr,
        turnoverBand: party.turnoverBand,
        industrySector: party.industrySector,
        industrySubsector: party.industrySubsector,
        latestRating: party.latestRating,
        latestRatingAgency: party.latestRatingAgency,
        latestRatingYear: party.latestRatingYear,
        investorType: party.investorType,
        portfolioSizeBand: party.portfolioSizeBand,
        riskAppetite: party.riskAppetite,
        highYieldAppetite: party.highYieldAppetite,
      })
      .from(party)
      .where(where)
      .orderBy(asc(party.legalName))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(party)
      .where(where),
  ]);

  const ids = rows.map((r) => r.partyId);

  // Unfiltered ledger summary - global aggregate, cached 60s via
  // getPartyListSummary (independent of `q` so the KPI strip reflects the whole
  // master ledger, not just the current search). Fetched in parallel with the
  // per-page enrichment below.
  // Always scope summary to visibility (brand + ownership). Never use the
  // unscoped global aggregate for authenticated console users — that leaked
  // other-brand counts into KPI strips.
  const [summary, typeRows, cityRows, signals] = await Promise.all([
    user ? fetchScopedPartyListSummary(user) : getPartyListSummary(),
    ids.length
      ? db
          .select({ partyId: partyTypeAssignment.partyId, type: partyTypeAssignment.partyType })
          .from(partyTypeAssignment)
          .where(inArray(partyTypeAssignment.partyId, ids))
      : ([] as { partyId: string; type: string }[]),
    ids.length
      ? db
          .select({ partyId: address.partyId, city: address.city })
          .from(address)
          .where(
            and(
              inArray(address.partyId, ids),
              eq(address.isCurrent, true),
              isNull(address.deletedAt),
            ),
          )
      : ([] as { partyId: string; city: string }[]),
    fetchPartySignals(ids),
  ]);

  const typesByParty = new Map<string, string[]>();
  for (const t of typeRows as Array<{ partyId: string; type: string }>) {
    const arr = typesByParty.get(t.partyId) ?? [];
    arr.push(t.type);
    typesByParty.set(t.partyId, arr);
  }
  const cityByParty = new Map<string, string>();
  for (const c of cityRows as Array<{ partyId: string; city: string }>) {
    // Keep the first current city per party (deterministic enough for a list).
    if (!cityByParty.has(c.partyId)) cityByParty.set(c.partyId, c.city);
  }

  const sum = summary;

  return {
    total: n ?? 0,
    page,
    pageSize,
    summary: sum,
    rows: rows.map((r) => {
      const sg = signals.get(r.partyId);
      const lastTouchAt = maxDate(
        r.updatedAt ?? r.createdAt ?? null,
        sg?.lastDealAt ?? null,
        sg?.lastContactAt ?? null,
        sg?.lastRelAt ?? null,
      );
      return {
        partyId: r.partyId,
        legalName: r.legalName,
        displayName: r.displayName,
        partyNature: r.partyNature,
        status: r.status,
        isKycComplete: r.isKycComplete,
        kycRiskRating: r.kycRiskRating ?? null,
        createdAt: r.createdAt,
        city: cityByParty.get(r.partyId) ?? null,
        types: typesByParty.get(r.partyId) ?? [],
        relationshipCount: sg?.relationshipCount ?? 0,
        dealCount: sg?.dealCount ?? 0,
        contactCount: sg?.contactCount ?? 0,
        lastTouchAt,
        assignedUserId: r.assignedUserId,
        annualTurnoverCr: r.annualTurnoverCr,
        turnoverBand: r.turnoverBand,
        industrySector: r.industrySector,
        industrySubsector: r.industrySubsector,
        latestRating: r.latestRating,
        latestRatingAgency: r.latestRatingAgency,
        latestRatingYear: r.latestRatingYear,
        investorType: r.investorType,
        portfolioSizeBand: r.portfolioSizeBand,
        riskAppetite: r.riskAppetite,
        highYieldAppetite: r.highYieldAppetite,
      };
    }),
  };
}

/**
 * Per-party "signals" - relationship / deal / contact counts + the most recent
 * touch timestamp across each junction. Batched over the page's party ids (three
 * indexed group-by queries, no N+1). The view layer derives the
 * relationship-strength band + relative last-touch from these; they are
 * display-only and never written back.
 */
interface PartySignals {
  relationshipCount: number;
  dealCount: number;
  contactCount: number;
  lastDealAt: Date | null;
  lastContactAt: Date | null;
  lastRelAt: Date | null;
}

async function fetchPartySignals(
  ids: string[],
): Promise<Map<string, PartySignals>> {
  if (ids.length === 0) return new Map();
  const [dealRows, contactRows, relParentRows, relChildRows] = await Promise.all([
    db
      .select({
        partyId: dealParty.partyId,
        n: sql<number>`count(*)::int`,
        last: sql<Date | null>`max(${dealParty.createdAt})`,
      })
      .from(dealParty)
      .where(and(inArray(dealParty.partyId, ids), isNull(dealParty.deletedAt)))
      .groupBy(dealParty.partyId),
    db
      .select({
        partyId: partyContact.partyId,
        n: sql<number>`count(*)::int`,
        last: sql<Date | null>`max(${partyContact.createdAt})`,
      })
      .from(partyContact)
      .where(and(inArray(partyContact.partyId, ids), isNull(partyContact.deletedAt)))
      .groupBy(partyContact.partyId),
    // Relationships where this party is the PARENT (parent-of / controls).
    db
      .select({
        partyId: relationship.parentPartyId,
        n: sql<number>`count(*)::int`,
        last: sql<Date | null>`max(${relationship.createdAt})`,
      })
      .from(relationship)
      .where(and(inArray(relationship.parentPartyId, ids), isNull(relationship.deletedAt)))
      .groupBy(relationship.parentPartyId),
    // Relationships where this party is the CHILD (child-of / controlled by).
    db
      .select({
        partyId: relationship.childPartyId,
        n: sql<number>`count(*)::int`,
        last: sql<Date | null>`max(${relationship.createdAt})`,
      })
      .from(relationship)
      .where(and(inArray(relationship.childPartyId, ids), isNull(relationship.deletedAt)))
      .groupBy(relationship.childPartyId),
  ]);

  const map = new Map<string, PartySignals>();
  const ensure = (id: string): PartySignals => {
    let s = map.get(id);
    if (!s) {
      s = {
        relationshipCount: 0,
        dealCount: 0,
        contactCount: 0,
        lastDealAt: null,
        lastContactAt: null,
        lastRelAt: null,
      };
      map.set(id, s);
    }
    return s;
  };

  for (const r of dealRows as Array<{ partyId: string; n: number; last: Date | null }>) {
    const s = ensure(r.partyId);
    s.dealCount = r.n;
    s.lastDealAt = r.last;
  }
  for (const r of contactRows as Array<{ partyId: string; n: number; last: Date | null }>) {
    const s = ensure(r.partyId);
    s.contactCount = r.n;
    s.lastContactAt = r.last;
  }
  for (const r of relParentRows as Array<{ partyId: string; n: number; last: Date | null }>) {
    const s = ensure(r.partyId);
    s.relationshipCount += r.n;
    s.lastRelAt = maxDate(s.lastRelAt, r.last);
  }
  for (const r of relChildRows as Array<{ partyId: string; n: number; last: Date | null }>) {
    const s = ensure(r.partyId);
    s.relationshipCount += r.n;
    s.lastRelAt = maxDate(s.lastRelAt, r.last);
  }
  return map;
}

/** Coerce a Date | string | number to a Date, or null if empty/invalid.
 *  postgres-js returns real `Date` objects for mapped `timestamp` columns
 *  (mode: "date"), but raw `sql<Date | null>max(${col})` aggregates come back
 *  as ISO strings at runtime - the TS cast is cosmetic. Without coercion,
 *  `d.getTime()` below throws `TypeError: …getTime is not a function`. */
function toDate(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  const parsed = new Date(d as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Latest of a list of dates, ignoring nulls. */
function maxDate(...dates: (Date | string | null)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) {
    const dt = toDate(d);
    if (!dt) continue;
    if (!best || dt.getTime() > best.getTime()) best = dt;
  }
  return best;
}

export interface PartyDetail {
  party: typeof party.$inferSelect;
  types: { partyType: string; assignedAt: Date | null }[];
  contacts: {
    partyContactId: string;
    role: string;
    isPrimary: boolean | null;
    validFrom: Date;
    validTo: Date | null;
    fullName: string;
    primaryEmail: string | null;
    primaryPhone: string | null;
    designation: string | null;
  }[];
  relationships: {
    relationshipId: string;
    direction: "parent" | "child";
    otherPartyId: string;
    otherPartyName: string;
    relationshipType: string;
    ownershipPct: string | null;
  }[];
  deals: {
    dealPartyId: string;
    dealId: string;
    dealCode: string | null;
    dealName: string | null;
    dealType: string;
    status: string | null;
    role: string;
    isLead: boolean | null;
  }[];
}

export async function getPartyDetail(
  partyId: string,
  user?: CrmUser | null,
): Promise<PartyDetail | null> {
  const [p] = await db
    .select()
    .from(party)
    .where(
      and(
        eq(party.partyId, partyId),
        isNull(party.deletedAt),
        partyVisibilityClause(user),
      ),
    );
  if (!p) return null;

  const [types, contacts, relsAsParent, relsAsChild, dealRows] = await Promise.all([
    db
      .select({ partyType: partyTypeAssignment.partyType, assignedAt: partyTypeAssignment.assignedAt })
      .from(partyTypeAssignment)
      .where(eq(partyTypeAssignment.partyId, partyId)),
    db
      .select({
        partyContactId: partyContact.partyContactId,
        role: partyContact.role,
        isPrimary: partyContact.isPrimary,
        validFrom: partyContact.validFrom,
        validTo: partyContact.validTo,
        fullName: contact.fullName,
        primaryEmail: contact.primaryEmail,
        primaryPhone: contact.primaryPhone,
        designation: contact.designation,
      })
      .from(partyContact)
      .innerJoin(contact, eq(contact.contactId, partyContact.contactId))
      .where(and(eq(partyContact.partyId, partyId), isNull(partyContact.deletedAt))),
    db
      .select({
        relationshipId: relationship.relationshipId,
        otherPartyId: relationship.childPartyId,
        relationshipType: relationship.relationshipType,
        ownershipPct: relationship.ownershipPct,
      })
      .from(relationship)
      .where(and(eq(relationship.parentPartyId, partyId), isNull(relationship.deletedAt))),
    db
      .select({
        relationshipId: relationship.relationshipId,
        otherPartyId: relationship.parentPartyId,
        relationshipType: relationship.relationshipType,
        ownershipPct: relationship.ownershipPct,
      })
      .from(relationship)
      .where(and(eq(relationship.childPartyId, partyId), isNull(relationship.deletedAt))),
    db
      .select({
        dealPartyId: dealParty.dealPartyId,
        dealId: dealParty.dealId,
        dealCode: deal.dealCode,
        dealName: deal.dealName,
        dealType: deal.dealType,
        status: deal.status,
        role: dealParty.role,
        isLead: dealParty.isLead,
      })
      .from(dealParty)
      .innerJoin(deal, eq(deal.dealId, dealParty.dealId))
      .where(and(eq(dealParty.partyId, partyId), isNull(dealParty.deletedAt))),
  ]);

  // Resolve the "other party" names for relationships.
  const otherIds = Array.from(
    new Set([
      ...relsAsParent.map((r) => r.otherPartyId),
      ...relsAsChild.map((r) => r.otherPartyId),
    ]),
  );
  const nameRows = otherIds.length
    ? await db
        .select({ partyId: party.partyId, legalName: party.legalName })
        .from(party)
        .where(inArray(party.partyId, otherIds))
    : [];
  const names = new Map(nameRows.map((r) => [r.partyId, r.legalName] as const));

  return {
    party: p,
    types,
    contacts,
    relationships: [
      ...relsAsParent.map((r) => ({
        relationshipId: r.relationshipId,
        direction: "parent" as const,
        otherPartyId: r.otherPartyId,
        otherPartyName: names.get(r.otherPartyId) ?? "-",
        relationshipType: r.relationshipType,
        ownershipPct: r.ownershipPct,
      })),
      ...relsAsChild.map((r) => ({
        relationshipId: r.relationshipId,
        direction: "child" as const,
        otherPartyId: r.otherPartyId,
        otherPartyName: names.get(r.otherPartyId) ?? "-",
        relationshipType: r.relationshipType,
        ownershipPct: r.ownershipPct,
      })),
    ],
    deals: dealRows,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Party preview - the serializable shape the Relationship Explorer's
   PreviewPane renders for the currently-selected party. Built from
   `getPartyDetail` + `fetchPartySignals` so the pane's mini relationship
   graph / recent deals / exposure / KYC snapshot + the strength + last-touch
   derivations match the list rows exactly. Display-only.
   ────────────────────────────────────────────────────────────────────────── */

export interface PartyPreviewRelationship {
  relationshipId: string;
  /** "child" = the selected party is a child of `otherPartyId` (otherParty is
   *  the parent / owner / beneficial owner). "parent" = the selected party is
   *  the parent of `otherPartyId` (otherParty is a subsidiary). */
  direction: "parent" | "child";
  otherPartyId: string;
  otherPartyName: string;
  relationshipType: string;
  ownershipPct: string | null;
}

export interface PartyPreviewDeal {
  dealId: string;
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  status: string | null;
  role: string;
  isLead: boolean | null;
}

export interface PartyPreview {
  partyId: string;
  legalName: string;
  displayName: string | null;
  partyNature: string;
  status: string;
  isKycComplete: boolean | null;
  isKycStale: boolean | null;
  kycRiskRating: string | null;
  countryOfIncorporation: string;
  domicileState: string | null;
  isListed: boolean | null;
  listingExchange: string | null;
  ticker: string | null;
  crisilSectorCode: string | null;
  groupExposureInr: string | null;
  brandOrigin: string;
  source: string | null;
  createdAt: Date | null;
  types: string[];
  relationships: PartyPreviewRelationship[];
  deals: PartyPreviewDeal[];
  counts: { relationships: number; deals: number; contacts: number };
  lastTouchAt: Date | null;
}

export async function getPartyPreview(
  partyId: string,
  user?: CrmUser | null,
): Promise<PartyPreview | null> {
  const detail = await getPartyDetail(partyId, user);
  if (!detail) return null;
  const { party: p, types, contacts, relationships, deals } = detail;

  const signals = await fetchPartySignals([p.partyId]);
  const sg = signals.get(p.partyId);
  const lastTouchAt = maxDate(
    p.updatedAt ?? p.createdAt ?? null,
    sg?.lastDealAt ?? null,
    sg?.lastContactAt ?? null,
    sg?.lastRelAt ?? null,
  );

  return {
    partyId: p.partyId,
    legalName: p.legalName,
    displayName: p.displayName,
    partyNature: p.partyNature,
    status: p.status,
    isKycComplete: p.isKycComplete,
    isKycStale: p.isKycStale,
    kycRiskRating: p.kycRiskRating,
    countryOfIncorporation: p.countryOfIncorporation,
    domicileState: p.domicileState,
    isListed: p.isListed,
    listingExchange: p.listingExchange,
    ticker: p.ticker,
    crisilSectorCode: p.crisilSectorCode,
    groupExposureInr: p.groupExposureInr,
    brandOrigin: p.brandOrigin,
    source: p.source,
    createdAt: p.createdAt,
    types: types.map((t) => t.partyType),
    relationships: relationships.map((r) => ({
      relationshipId: r.relationshipId,
      direction: r.direction,
      otherPartyId: r.otherPartyId,
      otherPartyName: r.otherPartyName,
      relationshipType: r.relationshipType,
      ownershipPct: r.ownershipPct,
    })),
    deals: deals.map((d) => ({
      dealId: d.dealId,
      dealCode: d.dealCode,
      dealName: d.dealName,
      dealType: d.dealType,
      status: d.status,
      role: d.role,
      isLead: d.isLead,
    })),
    counts: {
      relationships: relationships.length,
      deals: deals.length,
      contacts: contacts.length,
    },
    lastTouchAt,
  };
}
