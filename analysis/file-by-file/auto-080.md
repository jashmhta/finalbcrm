
# Batch 080

## `src/features/integrations/queries.ts`

- **Lines:** 43 | **Bytes:** 1832
- **Kind:** Feature data-access (queries)
- **Header intent:** Cached integration-status data access for the /integrations page.  The adapter registry itself is in-process (src/features/integrations/registry.ts) and its summaries are derived from env + the static adapter list, so they are stable for the lifetime of a deploy and cheap to recompute. We still wrap them in Next's unstable_cache (revalidate 300s / 5 minutes) so a cache hit on the status page skips the per-adapter env reads + object mapping on every request and the page renders straight from the 
- **Exported const:** listIntegrationsCached, getIntegrationStatusCounts
- **External deps:** next/cache
- **Internal imports (1):** ./registry

## `src/features/integrations/ratingFeed.ts`

- **Lines:** 220 | **Bytes:** 7423
- **Kind:** Application module
- **Header intent:** Rating-agency feed adapter (CRISIL / ICRA / CARE Edge / India Ratings / Brickwork).  §11: LICENSED COMMERCIAL DATA, not open. Sold via rating agencies' subscription products or redistributors (Bloomberg/Refinitiv). Low technical risk; cost is the dominant constraint.  Access to swap for real: commercial license agreement with one or more agencies (typical for a bond house). Significant annual license cost (TO CONFIRM per agency).  Env (see .env.example): RATING_FEED_API_KEY. Agency selected via 
- **Exported functions:** buildRatingFeedSample
- **Exported const:** ratingFeed
- **Exported types:** RatingAction, RatingFeedData
- **Exported classes:** RatingFeedClient
- **Security signals:** auth
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** bond, issuer

## `src/features/integrations/registry.ts`

- **Lines:** 154 | **Bytes:** 5260
- **Kind:** Application module
- **Header intent:** Integration adapter registry.  Single source of truth for the set of India-regulatory / financial-data integrations the CRM must support (per §11 of COMPLIANCE_LEGAL_FEASIBILITY.md). Each adapter ships BOTH a real API client class (typed request/response, env-credential loading, fetch with timeout + retry + structured errors) AND a mock implementation that returns the realistic sample data the UI screens use.  Mock vs real is resolved from env per adapter (see env.ts): • `USE_MOCK_INTEGRATIONS` 
- **Exported functions:** listIntegrations, getAdapter, runAdapterMock, runAdapter, runMock, runAll, integrationStatusCounts
- **Exported const:** integrationRegistry, integrationsById
- **Exported types:** IntegrationSummary
- **Security signals:** india-compliance
- **Internal imports (13):** ./types, ./accountAggregator, ./kra, ./ckyc, ./mca, ./gstinPan, ./bseNse, ./ccil, ./demat, ./ratingFeed, ./fiuInd, ./emailCalendar, ./whatsapp
- **Domain terms:** demat

## `src/features/integrations/types.ts`

- **Lines:** 123 | **Bytes:** 4774
- **Kind:** Application module
- **Header intent:** Shared types for integration adapters.  Every adapter in this directory implements `IntegrationAdapter`. Each adapter ships BOTH a real API client class (typed request/response, env-credential loading, fetch with timeout + retry + structured errors) AND a mock implementation that returns the realistic sample data the UI screens use.  Which one the registry/Server Actions invoke is driven by env (see env.ts): • `USE_MOCK_INTEGRATIONS` (default: true in dev, false in prod when credentials are pres
- **Exported functions:** errorResult
- **Exported types:** AdapterStatus, AdapterResult, AdapterInput, IntegrationAdapter
- **Security signals:** india-compliance
- **Internal imports (1):** ./env
- **Domain terms:** kyc, party
