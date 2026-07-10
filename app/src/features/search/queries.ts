import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { CrmUser } from "@/lib/rbac";
import { can } from "@/lib/rbac";
import { isFirmWide, isSuperAdmin, partyBrandSqlValues } from "@/lib/org";

export type SearchHitKind =
  | "party"
  | "lead"
  | "deal"
  | "task"
  | "interaction"
  | "page";

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Higher = better match (search-engine ranking). */
  score: number;
  badges?: string[];
}

export interface SearchResult {
  q: string;
  hits: SearchHit[];
  tookMs: number;
  counts: Record<string, number>;
}

function tokenize(q: string): string[] {
  return q
    .trim()
    .toLowerCase()
    .split(/[\s,;/|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 1)
    .slice(0, 8);
}

function brandClauseSql(user: CrmUser | null | undefined) {
  if (!user) return sql`true`;
  if (isFirmWide(user.brandScope) || isSuperAdmin(user.roles)) {
    return sql`true`;
  }
  const brands = partyBrandSqlValues(user.brandScope);
  return sql`p.brand_origin = ANY(ARRAY[${sql.join(
    brands.map((b) => sql`${b}`),
    sql`, `,
  )}]::text[])`;
}

function ownershipClauseSql(user: CrmUser | null | undefined) {
  if (!user?.appUserId) return sql`true`;
  if (
    isSuperAdmin(user.roles) ||
    user.roles.includes("admin") ||
    can(user, "read_all", "party")
  ) {
    return sql`true`;
  }
  const uid = user.appUserId;
  return sql`(
    p.assigned_user_id = ${uid}
    OR p.data_owner_user_id = ${uid}
    OR p.created_by_user_id = ${uid}
  )`;
}

/**
 * Search-engine style multi-entity search.
 * - Tokenizes query
 * - Ranks exact prefix > starts-with > contains > fuzzy-ish token hits
 * - Scopes by brand + ownership for employees
 */
export async function globalSearch(
  qRaw: string,
  user: CrmUser,
  opts?: { limit?: number },
): Promise<SearchResult> {
  const started = Date.now();
  const q = qRaw.trim();
  const limit = Math.min(opts?.limit ?? 40, 80);
  if (q.length < 1) {
    return { q, hits: [], tookMs: 0, counts: {} };
  }

  const tokens = tokenize(q);
  const primary = tokens[0] ?? q.toLowerCase();
  const like = `%${primary}%`;
  const prefix = `${primary}%`;

  const brand = brandClauseSql(user);
  const ownership = ownershipClauseSql(user);

  const hits: SearchHit[] = [];

  // --- Parties ---
  if (can(user, "read", "party")) {
    const partyRows = await db.execute<{
      party_id: string;
      legal_name: string;
      display_name: string | null;
      status: string | null;
      brand_origin: string | null;
      latest_rating: string | null;
      industry_sector: string | null;
      score: number;
    }>(sql`
      SELECT
        p.party_id,
        p.legal_name,
        p.display_name,
        p.status,
        p.brand_origin,
        p.latest_rating,
        p.industry_sector,
        (
          CASE
            WHEN lower(p.legal_name) = ${primary} THEN 100
            WHEN lower(p.legal_name) LIKE ${prefix} THEN 80
            WHEN lower(coalesce(p.display_name, '')) = ${primary} THEN 75
            WHEN lower(p.legal_name) LIKE ${like} THEN 55
            WHEN lower(coalesce(p.display_name, '')) LIKE ${like} THEN 50
            WHEN lower(coalesce(p.industry_sector, '')) LIKE ${like} THEN 35
            WHEN lower(coalesce(p.latest_rating, '')) LIKE ${like} THEN 30
            ELSE 20
          END
        )::int AS score
      FROM party p
      WHERE p.deleted_at IS NULL
        AND ${brand}
        AND ${ownership}
        AND (
          p.legal_name ILIKE ${like}
          OR p.display_name ILIKE ${like}
          OR p.industry_sector ILIKE ${like}
          OR p.latest_rating ILIKE ${like}
          OR p.investor_type ILIKE ${like}
          OR p.source_ref ILIKE ${like}
        )
      ORDER BY score DESC, p.legal_name ASC
      LIMIT ${Math.min(limit, 25)}
    `);

    const rows = Array.isArray(partyRows)
      ? partyRows
      : ((partyRows as { rows?: typeof partyRows }).rows ?? []);

    for (const r of rows as typeof partyRows) {
      const isLead = false; // refined below if lead_meta
      hits.push({
        kind: "party",
        id: r.party_id,
        title: r.legal_name,
        subtitle: [r.brand_origin, r.status, r.industry_sector, r.latest_rating]
          .filter(Boolean)
          .join(" · "),
        href: `/console/parties/${r.party_id}`,
        score: Number(r.score) + (isLead ? 0 : 0),
        badges: ["Client"],
      });
    }

    // Leads (subset of parties with lead_meta)
    const leadRows = await db.execute<{
      party_id: string;
      legal_name: string;
      stage: string | null;
      deal_type: string | null;
      contact_name: string | null;
      score: number;
    }>(sql`
      SELECT
        p.party_id,
        p.legal_name,
        p.lead_meta->>'stage' AS stage,
        p.lead_meta->>'dealType' AS deal_type,
        p.lead_meta->>'contactName' AS contact_name,
        (
          CASE
            WHEN lower(p.legal_name) = ${primary} THEN 95
            WHEN lower(p.legal_name) LIKE ${prefix} THEN 78
            WHEN lower(p.legal_name) LIKE ${like} THEN 52
            WHEN lower(coalesce(p.lead_meta->>'contactName','')) LIKE ${like} THEN 48
            WHEN lower(coalesce(p.lead_meta->>'contactEmail','')) LIKE ${like} THEN 45
            ELSE 22
          END
        )::int AS score
      FROM party p
      WHERE p.deleted_at IS NULL
        AND p.lead_meta IS NOT NULL
        AND ${brand}
        AND ${ownership}
        AND (
          p.legal_name ILIKE ${like}
          OR p.lead_meta->>'contactName' ILIKE ${like}
          OR p.lead_meta->>'contactEmail' ILIKE ${like}
          OR p.lead_meta->>'dealType' ILIKE ${like}
          OR p.lead_meta->>'notes' ILIKE ${like}
        )
      ORDER BY score DESC
      LIMIT 15
    `);
    const lrows = Array.isArray(leadRows)
      ? leadRows
      : ((leadRows as { rows?: typeof leadRows }).rows ?? []);
    for (const r of lrows as typeof leadRows) {
      hits.push({
        kind: "lead",
        id: r.party_id,
        title: r.legal_name,
        subtitle: [r.stage, r.deal_type?.replace(/_/g, " "), r.contact_name]
          .filter(Boolean)
          .join(" · "),
        href: `/console/leads/${r.party_id}`,
        score: Number(r.score) + 5,
        badges: ["Lead"],
      });
    }
  }

  // --- Deals / mandates ---
  if (can(user, "read", "deal")) {
    const dealRows = await db.execute<{
      deal_id: string;
      deal_code: string | null;
      deal_name: string | null;
      deal_type: string;
      status: string | null;
      score: number;
    }>(sql`
      SELECT
        d.deal_id,
        d.deal_code,
        d.deal_name,
        d.deal_type,
        d.status,
        (
          CASE
            WHEN lower(coalesce(d.deal_code,'')) = ${primary} THEN 100
            WHEN lower(coalesce(d.deal_code,'')) LIKE ${prefix} THEN 85
            WHEN lower(coalesce(d.deal_name,'')) LIKE ${prefix} THEN 75
            WHEN lower(coalesce(d.deal_code,'')) LIKE ${like} THEN 60
            WHEN lower(coalesce(d.deal_name,'')) LIKE ${like} THEN 55
            ELSE 25
          END
        )::int AS score
      FROM deal d
      WHERE d.deleted_at IS NULL
        AND (
          d.deal_code ILIKE ${like}
          OR d.deal_name ILIKE ${like}
          OR d.deal_type::text ILIKE ${like}
          OR d.status::text ILIKE ${like}
        )
      ORDER BY score DESC
      LIMIT 15
    `);
    const drows = Array.isArray(dealRows)
      ? dealRows
      : ((dealRows as { rows?: typeof dealRows }).rows ?? []);
    for (const r of drows as typeof dealRows) {
      hits.push({
        kind: "deal",
        id: r.deal_id,
        title: r.deal_name ?? r.deal_code ?? r.deal_id.slice(0, 8),
        subtitle: [r.deal_code, r.status, r.deal_type?.replace(/_/g, " ")]
          .filter(Boolean)
          .join(" · "),
        href: `/console/deals/${r.deal_id}`,
        score: Number(r.score),
        badges: ["Mandate"],
      });
    }
  }

  // --- Tasks ---
  if (can(user, "read", "task")) {
    const taskRows = await db.execute<{
      task_id: string;
      title: string;
      status: string | null;
      priority: string | null;
      score: number;
    }>(sql`
      SELECT
        t.task_id,
        t.title,
        t.status,
        t.priority,
        (
          CASE
            WHEN lower(t.title) = ${primary} THEN 70
            WHEN lower(t.title) LIKE ${prefix} THEN 55
            WHEN lower(t.title) LIKE ${like} THEN 40
            ELSE 15
          END
        )::int AS score
      FROM task t
      WHERE t.deleted_at IS NULL
        AND t.title ILIKE ${like}
      ORDER BY score DESC
      LIMIT 10
    `);
    const trows = Array.isArray(taskRows)
      ? taskRows
      : ((taskRows as { rows?: typeof taskRows }).rows ?? []);
    for (const r of trows as typeof taskRows) {
      hits.push({
        kind: "task",
        id: r.task_id,
        title: r.title,
        subtitle: [r.status, r.priority].filter(Boolean).join(" · "),
        href: `/console/tasks/${r.task_id}`,
        score: Number(r.score),
        badges: ["Task"],
      });
    }
  }

  // --- Interactions ---
  if (can(user, "read", "interaction")) {
    const ixRows = await db.execute<{
      interaction_id: string;
      subject: string | null;
      channel: string | null;
      score: number;
    }>(sql`
      SELECT
        i.interaction_id,
        i.subject,
        i.channel,
        (
          CASE
            WHEN lower(coalesce(i.subject,'')) LIKE ${prefix} THEN 50
            WHEN lower(coalesce(i.subject,'')) LIKE ${like} THEN 35
            WHEN lower(coalesce(i.body,'')) LIKE ${like} THEN 25
            ELSE 12
          END
        )::int AS score
      FROM interaction i
      WHERE i.deleted_at IS NULL
        AND (
          i.subject ILIKE ${like}
          OR i.body ILIKE ${like}
          OR i.channel::text ILIKE ${like}
        )
      ORDER BY score DESC, i.occurred_at DESC NULLS LAST
      LIMIT 10
    `);
    const irows = Array.isArray(ixRows)
      ? ixRows
      : ((ixRows as { rows?: typeof ixRows }).rows ?? []);
    for (const r of irows as typeof ixRows) {
      hits.push({
        kind: "interaction",
        id: r.interaction_id,
        title: r.subject ?? "Interaction",
        subtitle: r.channel ?? undefined,
        href: `/console/interactions/${r.interaction_id}`,
        score: Number(r.score),
        badges: ["Touch"],
      });
    }
  }

  // Boost multi-token matches in title
  if (tokens.length > 1) {
    for (const h of hits) {
      const hay = `${h.title} ${h.subtitle ?? ""}`.toLowerCase();
      const matched = tokens.filter((t) => hay.includes(t)).length;
      h.score += matched * 8;
    }
  }

  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const top = hits.slice(0, limit);

  const counts: Record<string, number> = {};
  for (const h of top) {
    counts[h.kind] = (counts[h.kind] ?? 0) + 1;
  }

  return {
    q,
    hits: top,
    tookMs: Date.now() - started,
    counts,
  };
}
