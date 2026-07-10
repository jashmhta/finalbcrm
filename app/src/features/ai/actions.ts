"use server";

// AI Features - server actions.
//
// The client components under src/app/ai/* (notably the credit-summary panel
// that slots into /credit/[id]) need to fetch generated summaries WITHOUT a
// function prop crossing the server→client boundary. These "use server"
// actions are the bridge: a client component calls `fetchCreditSummary(id)`
// with a serializable string and gets back a serializable CreditSummary -
// the data-fetch + generation runs server-side, the client only renders.
//
// This mirrors the NotificationBell pattern (a self-contained client component
// that fetches its own data via a server action). No external LLM is called.

import { getCreditSummary } from "./creditSummary";
import { getInteractionSummary } from "./interactionSummary";
import { requireUser } from "@/lib/rbac";
import type { CreditSummary, InteractionSummary } from "./types";

/**
 * Fetch + generate the AI credit summary for a single credit analysis.
 * Used by the `AiCreditSummary` client panel on /credit/[id].
 *
 * Returns null when the analysis does not exist (the client panel renders an
 * empty state in that case).
 */
export async function fetchCreditSummary(
  creditAnalysisId: string,
): Promise<CreditSummary | null> {
  const user = await requireUser();
  return getCreditSummary(creditAnalysisId, user);
}

/**
 * Fetch + generate the interaction summary for a single party or deal scope.
 * Used by an optional client panel that summarises a relationship's recent
 * interaction history on demand.
 */
export async function fetchInteractionSummary(
  scope: { partyId?: string; dealId?: string },
): Promise<InteractionSummary> {
  const user = await requireUser();
  return getInteractionSummary(scope, 25, user);
}
