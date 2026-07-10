# Agent 080 — File-by-file analysis (batch-080)

Files: queries.ts, ratingFeed.ts, registry.ts, types.ts | Fully read

---

## src/features/integrations/queries.ts

- **Lines:** 44  
- **Role:** Cached integration-status data access for `/integrations` page only. Wraps registry list/counts in Next `unstable_cache` (revalidate 300s, tag `integrations`).

- **Exports:**
  - `export const listIntegrationsCached = unstable_cache(async () => listIntegrations(), ["integrations-list-v1"], { revalidate: 300, tags: ["integrations"] })`
  - `export const getIntegrationStatusCounts = unstable_cache(...)`

- **Business purpose:** Status page is env-derived (stable per deploy). Cache skips re-mapping on every request. Action/explorer paths keep using uncached registry exports.

- **Key logic:** Payloads are plain serializable (strings/booleans/string[]). Cache key versions v1.

- **Side effects:** Read-only; data cache population.

- **Security:** No auth inside cache functions — page must call `requireUser` itself. Cached content is non-secret metadata (env key names listed, not values).

- **Risks:** If env credentials change at runtime, status may lag up to 300s until revalidate/tag bust. No `revalidateTag("integrations")` call from actions when mock toggle changes.

---

## src/features/integrations/ratingFeed.ts

- **Lines:** 221  
- **Role:** Licensed rating-agency action feed (CRISIL/ICRA/CARE/India Ratings/Brickwork). Phase 2 market_data. Cost-dominant (commercial license).

- **Exports:** `RatingAction`, `RatingFeedData`, `buildRatingFeedSample`, `RatingFeedClient`, `ratingFeed`.

- **Key logic:**
  - Mock: 3 actions (HDFC AAA reaffirm, Tata Cap A1+ reaffirm, Acme BB+ downgrade).
  - Real: bearer RATING_FEED_API_KEY; GET `/ratings/actions?agency&asOn`.
  - Default base `https://feeds.crisil.com` — swap per redistributor.

- **Business purpose:** Credit analysis + Indian rating-scale mapping; feed internal_rating / external_rating workflows.

- **Risks:** License cost TO CONFIRM; multi-agency normalization not in this adapter (single key).

---

## src/features/integrations/registry.ts

- **Lines:** 155  
- **Role:** **Single ordered registry** of all 12 India-regulatory / financial-data adapters per COMPLIANCE_LEGAL_FEASIBILITY §11. Dispatch surface for Server Actions and status page.

- **Exports:**
  - `integrationRegistry: IntegrationAdapter[]` — order: AA, kra, ckyc, gstinPan, mca, ratingFeed, fiuInd, emailCalendar, whatsapp, bseNse, ccil, demat
  - `integrationsById: Record<string, IntegrationAdapter>`
  - `IntegrationSummary` interface
  - `listIntegrations()`, `getAdapter(id)`, `runAdapterMock`, `runAdapter`, `runMock`, `runAll`, `integrationStatusCounts()`
  - type re-exports

- **Key logic:**
  - Mock runners always call `runMock` (UI demos never hit network).
  - Production `run` / `runAll` use env dispatch per adapter.
  - Unknown id throws `Error("Unknown integration adapter: …")` — actions catch via zod id but not this throw for typo IDs that pass zod.

- **Side effects:** None at import; run* invoke adapters (network in live mode).

- **Security:** Registry itself has no auth — security is entirely Server Action layer (currently weak).

- **Coupling:** Imports every adapter module; actions/queries import registry.

- **Risks:** `Promise.all` in runAll — one slow upstream delays all; no isolation/timeout at registry level beyond per-client timeouts.

---

## src/features/integrations/types.ts

- **Lines:** 124  
- **Role:** Shared TypeScript contracts for adapters — JSON-serializable results for Server Action → UI path.

- **Exports:**
  - `AdapterStatus = "mock" | "ready"`
  - `AdapterResult<TData>` — adapter, name, ok, status, fetchedAt, summary, data, optional raw/error/errorCode
  - `AdapterInput` — identifier?, context? Record<string,string>
  - `IntegrationAdapter` interface — full metadata + credentialsPresent + runMock/runReal/run
  - `errorResult(adapter, name, status, err): AdapterResult<null>` — extracts Error.message and optional `.code`

- **Categories:** financial_data | kyc | registry | market_data | reporting | communication  
- **Phases:** "Phase 1" | "Phase 2" | "Phase 3" strings on adapters

- **Key logic:** `errorResult` never throws; stable UI failure shape. FIU uses `raw` for XML exception to pure JSON.

- **Security:** Does not sanitize messages — IntegrationError messages should stay free of secrets (env-missing messages name key names only).

- **Coupling:** All adapters + actions + registry.

---

## Batch 080 synthesis

Integrations feature core closed: types contract, ordered registry, cached status queries, rating feed. System is demo-ready with realistic mocks; production readiness is credential + RBAC + real API envelope work.
