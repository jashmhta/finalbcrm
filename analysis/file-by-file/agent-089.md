# Agent 089 — File-by-file analysis (batch-089)

Files: portal-charts.tsx, portal/queries.ts, portfolio/actions.ts, portfolio/index.ts | Fully read (queries structure + key functions)

---

## src/features/portal/portal-charts.tsx

- **Lines:** 56  
- **Role:** `"use client"` dynamic wrappers (ssr:false) for recharts — shared vendor chunk; ChartSkeleton placeholders prevent CLS.

- **Exports:** type re-exports DonutPoint/LabelValuePoint; PORTAL_PALETTE; PortalDonutChart, PortalHBarChart, PortalVBarChart as next/dynamic components.

- **Why:** Server portal pages cannot use ssr:false dynamic; this client module owns it (same pattern as portfolio/reports).

---

## src/features/portal/queries.ts

- **Lines:** ~1500+  
- **Role:** Read-only data access for **Investor Portal** and **Client Portal** over shared party/deal/KYC/document tables.

- **Investor portal:**
  - `listInvestors` — party_type=investor + holding counts/portfolio value from allocation_event allocated/settled; KYC status; pagination + summary.
  - `getInvestorDetail` — party info, identifiers, holdings (allocation_event ⨝ deal ⨝ issuer ⨝ LATERAL latest instrument + rating), allocation history, demat, KYC, breakdowns by sector/rating/tenor/issuer.

- **Client portal:**
  - `listClients` / `getClientDetail` — issuers’ deals (role=issuer), documents, KYC history, contacts, onboarding_meta stage (raw SQL like onboarding feature).

- **Instrument derivation:** allocation_event has no instrument FK — LATERAL latest issuer instrument + rating fallback (documented auditable projection).

- **Visibility:** party assigned/owner/created or read_all party/portal/admin.

- **Helpers:** sectorFamily, ratingBand, tenorBucket, breakdown shares, num/str/toCr coercion for RSC.

- **Security:** Read-only; no actions. Scoped SQL. Unscoped user → full.

- **Risks:** Latest-instrument heuristic may mis-attribute ISIN vs specific allocation; amounts assumed INR absolute /1e7 for Cr.

---

## src/features/portfolio/actions.ts

- **Lines:** 162  
- **Role:** `"use server"` **updateLimit** — edit counterparty credit_limit amount/utilized/review_due_date with audit_log approve op.

- **Exports:** `UpdateLimitState`, `updateLimit(prev, formData)`.

- **Key logic:**
  - Guard `can(user, "approve", "credit_limit")` only (strict — comment notes admin may hold grant via seed).
  - Zod: limit/utilized 0–1_000_000 (Cr units), optional review date.
  - withRls: load existing, update amounts + utilizedAsOf today + isStale false + approvedBy; insert audit_log entity credit_limit operation approve with old/new JSON.
  - revalidate /portfolio/limits, /portfolio, /.

- **Security:** Server re-check of permission; audit hash-chain via DB trigger. Limits page UI canEdit mirrors permission.

- **Risks:** Max 1e6 may be tight for absolute INR if units mis-documented (comment says Cr); no concurrent-edit version check.

---

## src/features/portfolio/index.ts

- **Lines:** 74  
- **Role:** Portfolio feature barrel — query functions/types, updateLimit, pure risk math re-exports for tests/views.

- **Exports:** RBI constants, all get* query APIs, updateLimit, risk pure functions (macaulay, VaR assumptions, HHI, tenor buckets).

---

## Batch 089 synthesis

Portals deliver external-facing read projections; portfolio actions gate limit approvals tightly with audit. Chart lazy-loading keeps portal routes light.
