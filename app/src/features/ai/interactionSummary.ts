// AI Features - Interaction summary generator.
//
// Given a set of interaction notes (subject + body + channel + next_action),
// generate a summary with:
//   - a 1-2 sentence overview,
//   - 3-6 key topics (ranked by mention frequency across a domain vocabulary),
//   - action items (extracted from next_action fields + imperative sentences
//     in the body),
//   - supporting counts (interaction count, channels, last interaction date).
//
// Deterministic heuristic - no external LLM. The topic vocabulary is the
// Indian bond house / IB deal vocabulary (rating, underwriting, pricing,
// allocation, KYC, mandate, term sheet, coupon, tenor, settlement, roadshow,
// investor, committee, refinance, IPO, etc.) so the extracted topics always
// read as deal-relevant themes, not generic word-frequency noise.
//
// `summarizeInteractions` is PURE. `getInteractionSummary` /
// `getRecentInteractionSummaries` are the SERVER loaders.

import { and, desc, eq, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  contact,
  deal,
  interaction,
  party,
} from "@/db/schema";
import { can } from "@/lib/rbac-core";

import type {
  InteractionSummary,
  RecentInteractionSummary,
} from "./types";

interface ScopedCrmUser {
  appUserId: string | null;
  roles: string[];
  permissions: Set<string>;
}

function canReadAllAiInteractions(
  user?: Pick<ScopedCrmUser, "roles" | "permissions"> | null,
) {
  return (
    !user ||
    user.roles.includes("admin") ||
    user.roles.includes("super_admin") ||
    can(user, "read_all", "interaction") ||
    can(user, "read_all", "party") ||
    can(user, "manage", "user")
  );
}

function interactionVisibilityClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllAiInteractions(user) || !userId) return undefined;
  return or(
    eq(interaction.userId, userId),
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
    eq(deal.leadUserId, userId),
    eq(deal.creditAnalystUserId, userId),
    eq(deal.createdByUserId, userId),
    sql`EXISTS (
      SELECT 1
      FROM party_contact pc_scope
      JOIN party p_scope ON p_scope.party_id = pc_scope.party_id
      WHERE pc_scope.contact_id = ${interaction.contactId}
        AND pc_scope.deleted_at IS NULL
        AND p_scope.deleted_at IS NULL
        AND (
          p_scope.assigned_user_id = ${userId}
          OR p_scope.data_owner_user_id = ${userId}
          OR p_scope.created_by_user_id = ${userId}
        )
    )`,
  );
}

function partyScopeClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllAiInteractions(user) || !userId) return undefined;
  return or(
    eq(party.assignedUserId, userId),
    eq(party.dataOwnerUserId, userId),
    eq(party.createdByUserId, userId),
  );
}

function dealScopeClause(user?: ScopedCrmUser | null) {
  const userId = user?.appUserId;
  if (canReadAllAiInteractions(user) || !userId) return undefined;
  return or(
    eq(deal.leadUserId, userId),
    eq(deal.creditAnalystUserId, userId),
    eq(deal.createdByUserId, userId),
  );
}

// ---------------------------------------------------------------------------
// Pure input shape
// ---------------------------------------------------------------------------

export interface InteractionNote {
  interactionId: string;
  subject: string | null;
  body: string | null;
  channel: string | null;
  occurredAt: string | null; // ISO
  nextAction: string | null;
  partyName: string | null;
  dealCode: string | null;
  dealName: string | null;
}

export interface InteractionSummaryInput {
  notes: InteractionNote[];
  scope: { partyId?: string; dealId?: string };
  scopeLabel: string;
}

// ---------------------------------------------------------------------------
// Domain vocabulary - topic detection. Each topic has a label + the keyword
// alternation that triggers a mention. Mentions are counted across the
// subject + body of every note; the top N by count become the key topics.
// ---------------------------------------------------------------------------

interface TopicDef {
  label: string;
  /** Regex alternation matched case-insensitively against the note text. */
  match: RegExp;
}

const TOPIC_DEFS: TopicDef[] = [
  { label: "Credit rating", match: /\b(rating|crisil|icra|care|india ratings|acuite|rating agency|rating presentation|rating rationale)\b/i },
  { label: "Underwriting", match: /\b(underwrit|placement|book.?build|syndicat|book run|lead manager)\b/i },
  { label: "Pricing & coupon", match: /\b(pricing|coupon|yield|spread|g.?sec|basis points|bps|cut.?off)\b/i },
  { label: "Allocation & settlement", match: /\b(allocation|allotment|settlement|ccil|nds.?om|demat|clearing)\b/i },
  { label: "KYC & onboarding", match: /\b(kyc|cdd|edd|beneficial owner|re.?kyc|onboarding|aml|pmla)\b/i },
  { label: "Mandate & term sheet", match: /\b(mandate|term sheet|engagement letter|mandate letter|engagement)\b/i },
  { label: "Tenor & structure", match: /\b(tenor|maturity|structure|structured|ncd|commercial paper|cp|bond|debt)\b/i },
  { label: "Due diligence", match: /\b(due diligence|dd|site visit|legal dd|financial dd|management presentation|mp)\b/i },
  { label: "Investor outreach", match: /\b(investor|roadshow|marketing|placement agent|ifa|family office|fund|allocator)\b/i },
  { label: "Credit committee", match: /\b(committee|credit committee|ic|approval|approving|memo|credit memo)\b/i },
  { label: "Refinancing", match: /\b(refinanc|refinance|takeout|repricing|reset)\b/i },
  { label: "M&A / ECM", match: /\b(merger|acquisition|m&a|ma deal|ipo|fpo|qip|rights issue|capital markets|ecm)\b/i },
  { label: "Project finance", match: /\b(project finance|spv|special purpose vehicle|infrastructure|renewable|solar|wind|road|toll)\b/i },
  { label: "Supply chain finance", match: /\b(supply chain|reverse factoring|invoice|payables|receivables discounting)\b/i },
  { label: "Compliance & consent", match: /\b(consent|dpdp|sebi|rbi|fema|regulator|compliance|pep)\b/i },
];

// ---------------------------------------------------------------------------
// Action-item extraction - imperatives in the body + explicit next_action.
// ---------------------------------------------------------------------------

/** Imperative verbs that signal an action item in a note body. */
const IMPERATIVE_RE =
  /\b(follow up|follow-up|schedule|send|share|circulate|confirm|review|prepare|draft|chase|remind|complete|finalise|finalize|arrange|coordinate|reach out|set up|book|prepare|circulate|reverify|re-verify|verify|obtain|collect|update|escalate)\b/gi;

/** Extract candidate action-item sentences from a body. Returns the first
 *  sentence containing an imperative verb, trimmed. Pure. */
function extractActionFromBody(body: string | null): string | null {
  if (!body) return null;
  // Split into sentences on . ! ? followed by whitespace/newline.
  const sentences = body.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    // Reset lastIndex on the shared global regex.
    IMPERATIVE_RE.lastIndex = 0;
    if (IMPERATIVE_RE.test(trimmed)) {
      // Cap length for a tidy bullet.
      return cap(trimmed, 160);
    }
  }
  return null;
}

function cap(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length).trim()}…`;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const CHANNEL_LABELS: Record<string, string> = {
  meeting: "Meeting",
  call: "Call",
  email: "Email",
  whatsapp: "WhatsApp",
  rfq: "RFQ",
  ndsom_chat: "NDS-OM chat",
  site_visit: "Site visit",
  management_presentation: "Mgmt presentation",
};

function channelLabel(c: string | null): string {
  if (!c) return "Other";
  return CHANNEL_LABELS[c] ?? c.replace(/_/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
}

function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "-";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diffMs = t - now;
  const past = diffMs <= 0;
  const abs = Math.abs(diffMs);
  const day = Math.round(abs / (24 * 60 * 60 * 1000));
  if (day < 1) return past ? "today" : "today";
  if (day === 1) return past ? "yesterday" : "tomorrow";
  if (day < 30) return past ? `${day} days ago` : `in ${day} days`;
  const month = Math.round(day / 30);
  if (month < 12) return past ? `${month} mo ago` : `in ${month} mo`;
  const year = Math.round(month / 12);
  return past ? `${year} yr ago` : `in ${year} yr`;
}

// ---------------------------------------------------------------------------
// summarizeInteractions - the pure entry point.
// ---------------------------------------------------------------------------

export function summarizeInteractions(input: InteractionSummaryInput): InteractionSummary {
  const { notes, scope, scopeLabel } = input;
  const count = notes.length;

  // Topic frequency.
  const topicCounts = new Map<string, number>();
  for (const n of notes) {
    const text = `${n.subject ?? ""} ${n.body ?? ""}`;
    for (const def of TOPIC_DEFS) {
      const matches = text.match(new RegExp(def.match.source, "gi"));
      if (matches && matches.length > 0) {
        topicCounts.set(def.label, (topicCounts.get(def.label) ?? 0) + matches.length);
      }
    }
  }
  const keyTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label]) => label);

  // Action items - prefer explicit next_action; fall back to body imperatives.
  const actionItems: string[] = [];
  const seen = new Set<string>();
  for (const n of notes) {
    const candidates = [n.nextAction, extractActionFromBody(n.body)].filter(Boolean) as string[];
    for (const c of candidates) {
      const norm = c.toLowerCase().replace(/\s+/g, " ").trim();
      if (seen.has(norm)) continue;
      seen.add(norm);
      actionItems.push(c);
      if (actionItems.length >= 6) break;
    }
    if (actionItems.length >= 6) break;
  }

  // Channels.
  const channelSet = new Set<string>();
  for (const n of notes) {
    if (n.channel) channelSet.add(n.channel);
  }
  const channels = [...channelSet].map(channelLabel);

  // Last interaction.
  const sortedByDate = [...notes]
    .map((n) => ({ n, t: n.occurredAt ? new Date(n.occurredAt).getTime() : 0 }))
    .filter((x) => Number.isFinite(x.t))
    .sort((a, b) => b.t - a.t);
  const lastInteractionAt = sortedByDate[0]?.n.occurredAt ?? null;

  // Overview - 1-2 sentences.
  const overview = buildOverview(notes, scopeLabel, keyTopics, channels, count);

  return {
    scope,
    scopeLabel,
    overview,
    keyTopics,
    actionItems,
    interactionCount: count,
    lastInteractionAt,
    channels,
  };
}

function buildOverview(
  notes: InteractionNote[],
  scopeLabel: string,
  topics: string[],
  channels: string[],
  count: number,
): string {
  if (count === 0) {
    return `No interactions have been logged for ${scopeLabel} yet. Capture the next meeting, call, or email to start building the relationship timeline.`;
  }
  const subject = count === 1 ? "1 interaction" : `${count} interactions`;
  const channelBit = channels.length ? ` across ${joinNatural(channels.slice(0, 3))}` : "";
  const topicBit = topics.length
    ? ` Dominant themes: ${joinNatural(topics.slice(0, 3))}.`
    : "";
  return `The recent history for ${scopeLabel} covers ${subject}${channelBit}.${topicBit}`;
}

function joinNatural(parts: string[]): string {
  const clean = parts.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Per-note mini-summary - used by the "recent auto-summaries" rail. Pure.
// ---------------------------------------------------------------------------

/** Produce a one-line topic + a single action item for one interaction. */
export function summarizeOneInteraction(n: InteractionNote): {
  topic: string;
  actionItem: string | null;
} {
  const text = `${n.subject ?? ""} ${n.body ?? ""}`;
  let topic = "General check-in";
  let best = 0;
  for (const def of TOPIC_DEFS) {
    const matches = text.match(new RegExp(def.match.source, "gi"));
    if (matches && matches.length > best) {
      best = matches.length;
      topic = def.label;
    }
  }
  // If the subject itself is informative and no topic matched, use the subject.
  if (best === 0 && n.subject && n.subject.trim().length > 0) {
    topic = cap(n.subject.trim(), 70);
  }
  const actionItem = n.nextAction?.trim() || extractActionFromBody(n.body) || null;
  return { topic, actionItem: actionItem ? cap(actionItem, 140) : null };
}

// ---------------------------------------------------------------------------
// SERVER loaders
// ---------------------------------------------------------------------------

/** Resolve the scope label (party legal name or deal code/name). */
async function resolveScopeLabel(
  scope: { partyId?: string; dealId?: string },
  user?: ScopedCrmUser | null,
): Promise<string> {
  if (scope.partyId) {
    const [p] = await db
      .select({ legalName: party.legalName })
      .from(party)
      .where(
        and(
          eq(party.partyId, scope.partyId),
          isNull(party.deletedAt),
          partyScopeClause(user),
        ),
      );
    if (p?.legalName) return p.legalName;
  }
  if (scope.dealId) {
    const [d] = await db
      .select({ dealCode: deal.dealCode, dealName: deal.dealName })
      .from(deal)
      .where(and(eq(deal.dealId, scope.dealId), isNull(deal.deletedAt), dealScopeClause(user)));
    if (d?.dealName || d?.dealCode) return d.dealName?.trim() || d.dealCode!;
  }
  return "this relationship";
}

/** Load the most recent N interactions for a scope and map to notes. */
async function loadNotes(
  scope: { partyId?: string; dealId?: string },
  limit: number,
  user?: ScopedCrmUser | null,
): Promise<InteractionNote[]> {
  const where = and(
    isNull(interaction.deletedAt),
    interactionVisibilityClause(user),
    scope.partyId ? eq(interaction.partyId, scope.partyId) : undefined,
    scope.dealId ? eq(interaction.dealId, scope.dealId) : undefined,
  );
  const rows = await db
    .select({
      interactionId: interaction.interactionId,
      subject: interaction.subject,
      body: interaction.body,
      channel: interaction.channel,
      occurredAt: interaction.occurredAt,
      nextAction: interaction.nextAction,
      partyId: interaction.partyId,
      dealId: interaction.dealId,
      partyName: party.legalName,
      dealCode: deal.dealCode,
      dealName: deal.dealName,
    })
    .from(interaction)
    .leftJoin(party, eq(party.partyId, interaction.partyId))
    .leftJoin(deal, eq(deal.dealId, interaction.dealId))
    .where(where)
    .orderBy(desc(interaction.occurredAt), desc(interaction.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    interactionId: r.interactionId,
    subject: r.subject,
    body: r.body,
    channel: r.channel,
    occurredAt: r.occurredAt ? new Date(r.occurredAt).toISOString() : null,
    nextAction: r.nextAction,
    partyName: r.partyName,
    dealCode: r.dealCode,
    dealName: r.dealName,
  }));
}

/** Summarize the recent interactions for a single party or deal. */
export async function getInteractionSummary(
  scope: { partyId?: string; dealId?: string },
  limit = 25,
  user?: ScopedCrmUser | null,
): Promise<InteractionSummary> {
  const scopeLabel = await resolveScopeLabel(scope, user);
  const notes = await loadNotes(scope, limit, user);
  return summarizeInteractions({ notes, scope, scopeLabel });
}

/** The N most recent interactions across the whole firm, each with a
 *  one-line topic + action item - for the AI hub's "recent auto-summaries"
 *  rail. */
export async function getRecentInteractionSummaries(
  limit = 6,
  user?: ScopedCrmUser | null,
): Promise<RecentInteractionSummary[]> {
  const rows = await db
    .select({
      interactionId: interaction.interactionId,
      subject: interaction.subject,
      body: interaction.body,
      channel: interaction.channel,
      occurredAt: interaction.occurredAt,
      nextAction: interaction.nextAction,
      partyId: interaction.partyId,
      dealId: interaction.dealId,
      partyName: party.legalName,
      dealCode: deal.dealCode,
    })
    .from(interaction)
    .leftJoin(party, eq(party.partyId, interaction.partyId))
    .leftJoin(deal, eq(deal.dealId, interaction.dealId))
    .where(and(isNull(interaction.deletedAt), interactionVisibilityClause(user)))
    .orderBy(desc(interaction.occurredAt), desc(interaction.createdAt))
    .limit(limit);

  return rows.map((r) => {
    const note: InteractionNote = {
      interactionId: r.interactionId,
      subject: r.subject,
      body: r.body,
      channel: r.channel,
      occurredAt: r.occurredAt ? new Date(r.occurredAt).toISOString() : null,
      nextAction: r.nextAction,
      partyName: r.partyName,
      dealCode: r.dealCode,
      dealName: null,
    };
    const mini = summarizeOneInteraction(note);
    const href = r.partyId
      ? `/parties/${r.partyId}`
      : r.dealId
        ? `/deals`
        : "/interactions";
    return {
      interactionId: r.interactionId,
      subject: r.subject,
      partyName: r.partyName,
      dealCode: r.dealCode,
      channel: r.channel,
      occurredAt: note.occurredAt ?? new Date().toISOString(),
      relative: relativeTime(note.occurredAt),
      topic: mini.topic,
      actionItem: mini.actionItem,
      href,
    };
  });
}
