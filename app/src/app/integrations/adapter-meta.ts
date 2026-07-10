// View-layer metadata for the /integrations CONNECTION CARDS.
//
// This module is DISPLAY-ONLY derivation. DATA_FLOW + ADAPTER_HEALTH + the
// category labels are read off each adapter's own access-requirement / cost-risk
// text (in @/features/integrations/*) and surfaced as the control-panel's
// "what data flows" + "how ready is Binary to actually connect" gauges. They do
// NOT touch the data registry, the Server Actions, zod, or force-dynamic - the
// data layer is preserved exactly. If a field is missing from the registry, it
// is derived here in the view (per the "view-layer + minimal query-extension"
// rule); no query was extended for this screen.
//
// `deriveConnectionState` is the single source for the live connection
// lifecycle shared by the explorer header counts and the per-card button /
// pulse / ambient. Pure function (no JSX) so it can live in this .ts module and
// be imported by both the client explorer and the client adapter card.
import type { AdapterResult } from "@/features/integrations/types";
import type { IntegrationSummary } from "@/features/integrations/registry";

/* ──────────────────────────────────────────────────────────────────────────
   Category order + labels - the control-panel's section grouping.
   Order follows the data-supply chain: financial-data feeds first (the credit
   spine), then KYC/identity, then registry/depository, market data, regulatory
   reporting, and finally communication. Refined labels read as control-panel
   section heads rather than raw enum values.
   ────────────────────────────────────────────────────────────────────────── */

export type IntegrationCategory = IntegrationSummary["category"];

export const CATEGORY_ORDER: IntegrationCategory[] = [
  "financial_data",
  "kyc",
  "registry",
  "market_data",
  "reporting",
  "communication",
];

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  financial_data: "Financial data",
  kyc: "KYC & identity",
  registry: "Registry & depository",
  market_data: "Market data",
  reporting: "Reporting & filing",
  communication: "Communication",
};

/** One-line control-panel blurb per category - the quiet hint under each
 *  section eyebrow so a group reads as a labelled instrument rack, not a raw
 *  enum header. */
export const CATEGORY_BLURB: Record<IntegrationCategory, string> = {
  financial_data: "Consented credit-data feeds: the analysis spine.",
  kyc: "Identity verification & KYC profile lookups.",
  registry: "Company / tax / depository registries.",
  market_data: "Pricing, trade reporting & external ratings.",
  reporting: "Regulatory filing & trade-repository workflows.",
  communication: "Channel sync for record retention.",
};

/* ──────────────────────────────────────────────────────────────────────────
   DATA_FLOW - what data flows IN to each adapter and what comes OUT. The mini
   data-flow diagram on each connection card renders these as labelled chips on
   either side of the adapter node. Short labels (≤ ~18 chars) so they fit the
   card rail; the drawer carries the full payload. Derived from each adapter's
   runMock sample shape + its access-requirement text.
   ────────────────────────────────────────────────────────────────────────── */

export interface DataFlow {
  in: string[];
  out: string[];
}

export const DATA_FLOW: Record<string, DataFlow> = {
  accountAggregator: {
    in: ["Consent handle", "PAN"],
    out: ["Deposits", "Term deposits", "MF / SIP"],
  },
  kra: {
    in: ["PAN"],
    out: ["KRA record", "KYC status"],
  },
  ckyc: {
    in: ["PAN / CKYC id"],
    out: ["CKYC profile", "KYC history"],
  },
  gstinPan: {
    in: ["GSTIN", "PAN"],
    out: ["GST returns", "PAN status"],
  },
  mca: {
    in: ["CIN / name"],
    out: ["Company master", "Charges", "Filings"],
  },
  ratingFeed: {
    in: ["ISIN / issuer"],
    out: ["External ratings", "Rating history"],
  },
  fiuInd: {
    in: ["Suspicious txn"],
    out: ["FINnet XML", "STR filing"],
  },
  emailCalendar: {
    in: ["OAuth2 consent"],
    out: ["Email threads", "Calendar events"],
  },
  whatsapp: {
    in: ["Phone (opt-in)", "Template"],
    out: ["Message log", "Delivery status"],
  },
  bseNse: {
    in: ["Member login", "Date"],
    out: ["Debt trades", "Bhavcopy"],
  },
  ccil: {
    in: ["Sponsoring member", "Trade ref"],
    out: ["F-TRAC report", "Reconciliation"],
  },
  demat: {
    in: ["BO id / PAN"],
    out: ["Demat holdings", "Pledge status"],
  },
};

/* ──────────────────────────────────────────────────────────────────────────
   ADAPTER_HEALTH - the per-adapter "access readiness" gauge. A 0–100 view-layer
   estimate of how ready Binary is to actually connect each feed, derived from
   the adapter's own access-requirement + cost-risk text:
     • Phase-1 open / self-serve architectures (AA, KRA, GSTN, OAuth, Meta) →
       high (80–88) - the feasible, near-term connects.
     • Phase-1/2 member-workflow or licensed feeds (CKYC, MCA, ratings, FIU) →
       mid (58–76) - onboarding- or license-gated.
     • Phase-3 member-only / UNVERIFIED feeds (BSE/NSE, CCIL, demat) → low
       (24–30) - membership unverified, likely out of scope for an arranger.
   The one-word `label` is the gauge's caption (e.g. "Self-serve",
   "Membership unverified"). Honest, not aspirational.
   ────────────────────────────────────────────────────────────────────────── */

export interface AdapterHealth {
  /** 0–100 access-readiness estimate. */
  readiness: number;
  /** One-word / short caption for the gauge. */
  label: string;
}

export const ADAPTER_HEALTH: Record<string, AdapterHealth> = {
  accountAggregator: { readiness: 88, label: "Ready to onboard" },
  kra: { readiness: 82, label: "Open KRA API" },
  ckyc: { readiness: 74, label: "CERSAI onboarding" },
  gstinPan: { readiness: 84, label: "GSTN / NSDL self-serve" },
  mca: { readiness: 76, label: "MCA21 public portal" },
  ratingFeed: { readiness: 64, label: "Licensed feed" },
  fiuInd: { readiness: 58, label: "Regulatory filing" },
  emailCalendar: { readiness: 86, label: "OAuth self-serve" },
  whatsapp: { readiness: 80, label: "Meta Cloud API" },
  bseNse: { readiness: 28, label: "Membership unverified" },
  ccil: { readiness: 24, label: "Not a direct member" },
  demat: { readiness: 30, label: "DP registration unverified" },
};

/** Readiness band → meter accent. ≥70 emerald (green-light), 50–69 gold
 *  (onboarding-gated), <50 down (membership-blocked). Drawn from the muted
 *  brand tokens so the gauge never reads as neon. */
export function readinessTone(
  readiness: number,
): "emerald" | "gold" | "down" {
  if (readiness >= 70) return "emerald";
  if (readiness >= 50) return "gold";
  return "down";
}

/* ──────────────────────────────────────────────────────────────────────────
   ConnectionState - the live lifecycle of one adapter, derived from the
   registry status (mock | ready) PLUS the runtime result of a mock run. The
   explorer header counts and the per-card button / pulse / ambient all read
   from this so the whole board shares one source of truth.
   ────────────────────────────────────────────────────────────────────────── */

export type ConnectionState = "connected" | "available" | "failed" | "mock";

export function deriveConnectionState(
  adapter: { status: "mock" | "ready" },
  result: AdapterResult | null,
  error: string | null,
): ConnectionState {
  if (error || (result && !result.ok)) return "failed";
  if (result?.ok) return "connected";
  if (adapter.status === "ready") return "available";
  return "mock";
}
