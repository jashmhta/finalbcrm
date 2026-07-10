// Cached integration-status data access for the /integrations page.
//
// The adapter registry itself is in-process (src/features/integrations/registry.ts)
// and its summaries are derived from env + the static adapter list, so they are
// stable for the lifetime of a deploy and cheap to recompute. We still wrap them
// in Next's unstable_cache (revalidate 300s / 5 minutes) so a cache hit on the
// status page skips the per-adapter env reads + object mapping on every request
// and the page renders straight from the data cache. The registry's synchronous
// `listIntegrations` / `integrationStatusCounts` exports are preserved untouched
// for the action / explorer paths; only the page render path goes through here.
//
// Payloads are plain serializable shapes (strings / booleans / string[]), so
// they round-trip through the JSON data cache without loss.

import { unstable_cache } from "next/cache";

import {
  integrationStatusCounts,
  listIntegrations,
  type IntegrationSummary,
} from "./registry";

/**
 * Cached adapter list for the integrations status page (revalidate 300s).
 * Returns the same IntegrationSummary[] shape as registry.listIntegrations.
 */
export const listIntegrationsCached = unstable_cache(
  async (): Promise<IntegrationSummary[]> => listIntegrations(),
  ["integrations-list-v1"],
  { revalidate: 300, tags: ["integrations"] },
);

/**
 * Cached aggregate status counts (total / mock / ready) for the status-page
 * header (revalidate 300s). Tagged "integrations" so a future adapter-status
 * change can bust both the list + the counts together.
 */
export const getIntegrationStatusCounts = unstable_cache(
  async (): Promise<ReturnType<typeof integrationStatusCounts>> =>
    integrationStatusCounts(),
  ["integrations-status-v1"],
  { revalidate: 300, tags: ["integrations"] },
);
