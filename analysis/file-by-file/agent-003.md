# Agent 003 — File-by-file analysis

**Batch:** `batch-003.list`  
**Scope:** `drizzle/0007` … `drizzle/0010` (SQL migrations under app root)  
**Generated:** 2026-07-09  

---

## 1. `drizzle/0007_onboarding.sql`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0007_onboarding.sql` |
| **Lines** | 81 |
| **Kind** | PostgreSQL DDL migration (additive) |
| **Exports** | N/A (SQL). **Creates:** column `party.onboarding_meta`; indexes `party_onboarding_meta_present_idx`, `party_onboarding_stage_idx` |
| **Imports** | N/A. **Depends on existing:** table `party` (`party_id`, `deleted_at`); design parity with `lead_meta` (0006); conceptual links to `app_user.user_id`, `kyc_record.kyc_record_id`, `party_type_assignment` |

### Role

Adds Client Onboarding support **on the existing `party` master table** via a single nullable JSONB column plus two partial indexes. Onboarding is deliberately **not** a parallel entity table; a party is an onboarding case iff `onboarding_meta IS NOT NULL`.

### Business purpose

Models the bond-house / IB workflow that turns a prospect into an active, KYC-cleared, compliance-approved client:

- Funnel stages drive kanban / SLA.
- Document checklist (7 docs) and verification state live in the blob.
- Assigned RM, contact/signatory, company IDs (PAN/CIN/GSTIN), geography, compliance approval/rejection, and stage history (SLA clocks) are onboarding-specific fields the frozen party columns do not hold.
- Party `status` still tracks coarse lifecycle (`onboarding` → `active`); fine-grained stage + checklist + SLA sit in `onboarding_meta`.

### Objects / signatures

```sql
ALTER TABLE party
  ADD COLUMN IF NOT EXISTS onboarding_meta jsonb;

CREATE INDEX IF NOT EXISTS party_onboarding_meta_present_idx
  ON party (party_id)
  WHERE onboarding_meta IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS party_onboarding_stage_idx
  ON party ((onboarding_meta->>'stage'))
  WHERE onboarding_meta IS NOT NULL AND deleted_at IS NULL;
```

**Column type:** `onboarding_meta jsonb` — nullable, no default, no backfill.

### Documented JSONB shape (`onboarding_meta`)

| Key | Type / values | Notes |
|-----|----------------|-------|
| `stage` | enum string | `initiated` \| `profile_created` \| `documents_collected` \| `kyc_verified` \| `compliance_approved` \| `active` |
| `clientType` | enum string | intended role: `issuer` \| `investor` \| `intermediary` \| `arranger` \| `underwriter` \| `broker` \| `ifa` \| `rating_agency` \| `trustee` \| `registrar` \| `legal_counsel` \| `auditor` \| `guarantor` \| `government` \| `spv` \| `vendor` — activation can create real `party_type_assignment` |
| `assignedRm` | uuid-as-text or null | `app_user.user_id` |
| `contactName`, `contactTitle`, `contactEmail`, `contactPhone` | strings | primary authorized signatory |
| `pan`, `cin`, `gstin`, `state`, `city` | strings | company IDs + registered-office geography |
| `documents[]` | array of objects | 7-doc checklist: incorporation certificate, PAN card, board resolution, authorized signatory KYC, financial statements, beneficial ownership declaration, consent form |
| document item | `{ key, status, verification, documentId, uploadedAt, verifiedAt, verifiedBy, rejectionReason }` | `status`: `pending`\|`uploaded`; `verification`: `pending`\|`verified`\|`rejected` |
| `kycRecordId` | uuid-as-text or null | FK-ish link to `kyc_record.kyc_record_id`; **live KYC status is denormalized on read from `kyc_record`, not stored in the blob** |
| `complianceApprovedBy` / `complianceApprovedAt` | text / ISO | compliance approval |
| `complianceRejectedBy` / `complianceRejectedAt` / `complianceNote` | text / ISO / text | compliance rejection |
| `stageHistory[]` | `{ stage, enteredAt }` | per-stage entry timestamps for SLA (docs 3d, KYC 7d, compliance 2d) |
| `rejectionReason` | text | whole-case rejection |
| `createdAt` / `updatedAt` | ISO timestamps | case timestamps |

### Key logic

1. **Presence semantics:** only non-null `onboarding_meta` marks an onboarding case; no separate case table.
2. **Partial indexes** exclude soft-deleted parties and non-onboarding rows — pipeline/kanban reads stay index-friendly.
3. **Expression index** on `(onboarding_meta->>'stage')` supports `GROUP BY stage` / stage filters without full JSONB scan.
4. **Idempotent:** `IF NOT EXISTS` on column and indexes; safe to re-run.
5. **Additive only:** no column renames, no data mutation, no RLS policy changes.

### Side effects

- Schema change on `party` (new column + 2 indexes).
- Existing parties remain non-onboarding (`NULL` meta) until feature/seed writes the blob.
- No RLS policy DDL; column inherits existing `party` policies (`rls_wall_clear(barrier_id)` etc. from earlier migrations).
- Index maintenance cost on write for onboarding parties only (partial).

### Security / RBAC

- **No new RLS functions or policies.** Access control is entirely whatever already applies to `party` (Chinese wall / barrier visibility from 0003+).
- Sensitive onboarding data (PAN, CIN, GSTIN, KYC linkage, compliance notes, signatory PII) lives in JSONB under party RLS — **no field-level encryption or column-level ACL**.
- `assignedRm` is free-form text in JSON, not a DB FK — no referential integrity or privilege check at DB layer for RM assignment.
- App-layer must ensure only authorized roles write stages / compliance approval; DB does not encode stage machine or compliance role gates.

### Coupling

| Coupled to | How |
|------------|-----|
| `party` | host table |
| 0006 `lead_meta` pattern | same “feature meta on party” design |
| `app_user` | `assignedRm` logical ref |
| `kyc_record` | `kycRecordId` logical ref |
| `party_type_assignment` | activation path from `clientType` |
| Onboarding feature code / seed | owns population and shape of JSONB |
| Party RLS (0003 / later) | visibility of onboarding cases |

### Risks / TODOs

- **No CHECK / JSON Schema** on `onboarding_meta` — invalid stages, missing keys, wrong document shapes only fail at app layer.
- **No GIN** on full JSONB; only presence + `stage` expression — filters on other keys (e.g. `assignedRm`) may scan.
- **Logical FKs as text** (`assignedRm`, `kycRecordId`) can dangle if users/KYC rows are deleted.
- **Duplicate identity risk:** PAN/CIN/GSTIN in blob vs party identifier tables may diverge.
- **SLA clocks** (`stageHistory`) are client-written timestamps — clock skew / tampering possible without server-side enforcement.
- Comment claims party status flips to `active` by `activateClient` — that behavior is **application**, not in this migration.
- Soft-delete filter on indexes assumes queries always use `deleted_at IS NULL`; app bugs bypassing that still hit full table.

---

## 2. `drizzle/0008_users_app_user_id.sql`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0008_users_app_user_id.sql` |
| **Lines** | 61 |
| **Kind** | PostgreSQL DDL + DML migration (additive + backfill) |
| **Exports** | N/A. **Creates:** column `users.app_user_id`; FK `users_app_user_id_app_user_user_id_fk`; index `users_app_user_id_idx` |
| **Imports** | N/A. **Depends on:** `"users"` (Auth.js / `@auth/drizzle-adapter` table), `"app_user"` (`user_id`, `email`) |

### Role

Aligns live Neon `users` table with Drizzle schema (`db/schema/auth.ts`) by adding the missing **1:1 link** from Auth.js identity rows to CRM profiles (`app_user.user_id`), backfilling via email, enforcing FK, and indexing.

### Business purpose

Unblocks feature read queries (leads, onboarding, matching) that join:

```text
users usr ON usr.app_user_id = app_user.user_id
```

to show RM display names. Without the column, those joins throw `column usr.app_user_id does not exist`, routes error-boundary to bare headings. Seed already attempted this backfill but swallowed exceptions when the column was missing.

### Objects / signatures

```sql
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "app_user_id" uuid;

UPDATE "users" u
  SET "app_user_id" = au."user_id"
  FROM "app_user" au
  WHERE u."email" = au."email"
    AND u."app_user_id" IS NULL;

ALTER TABLE "users"
  DROP CONSTRAINT IF EXISTS "users_app_user_id_app_user_user_id_fk";

ALTER TABLE "users"
  ADD CONSTRAINT "users_app_user_id_app_user_user_id_fk"
  FOREIGN KEY ("app_user_id") REFERENCES "app_user"("user_id")
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "users_app_user_id_idx"
  ON "users" ("app_user_id")
  WHERE "app_user_id" IS NOT NULL;
```

**Types:**

| Object | Definition |
|--------|------------|
| `users.app_user_id` | `uuid` nullable |
| FK | `users.app_user_id` → `app_user.user_id` **ON DELETE SET NULL** |
| Index | partial on `app_user_id` WHERE NOT NULL |

### Key logic

1. **Add column** if missing (matches declared schema).
2. **Email join backfill** only where `app_user_id IS NULL` — preserves manual links; re-runs are no-ops for already-linked rows.
3. **Drop-then-add FK** for stable constraint name and re-runnability.
4. **Partial index** for reverse joins (`app_user` → `users` by `app_user_id`).

### Side effects

- **Data mutation:** `UPDATE` may set many `users.app_user_id` values in one go.
- **FK enforcement** after backfill: insert/update of non-null `app_user_id` must reference existing `app_user.user_id`.
- **ON DELETE SET NULL:** deleting an `app_user` nulls linked Auth user link (auth row remains; CRM profile gone).
- Seed backfill path becomes viable (column exists).

### Security / RBAC

- No RLS changes on `users` or `app_user`.
- Links Auth identity to CRM principal — **wrong email match = wrong identity mapping** (privilege / attribution risk).
- Email equality is case-sensitive in SQL (`u."email" = au."email"`); casing mismatches leave `app_user_id` NULL and RM names blank.
- No uniqueness constraint on `users.app_user_id` in this file — multiple Auth rows could point at the same `app_user` if emails collide or data is bad (1:1 is by convention only unless schema elsewhere enforces UNIQUE).

### Coupling

| Coupled to | How |
|------------|-----|
| `db/schema/auth.ts` | declared column + MIGRATION NOTE for FK |
| `@auth/drizzle-adapter` live `users` table | was missing column |
| `app_user` | FK target + email source |
| Leads / onboarding / matching read queries | join on `app_user_id` |
| `db/seed.ts` | previously silent failure on missing column |

### Risks / TODOs

- **Email-only linkage** is brittle: rename email, multi-account same email, or Auth vs CRM email drift leaves orphans or wrong maps.
- **No UNIQUE** on `app_user_id` here — true 1:1 not DB-enforced in this migration.
- **Multiple `app_user` rows with same email:** non-deterministic `UPDATE ... FROM` (Postgres may pick any matching row).
- **FK add fails** if backfill somehow leaves invalid UUIDs (unlikely with join) or if concurrent bad writes race between UPDATE and ADD CONSTRAINT (narrow window).
- Quoted identifiers `"users"` / `"app_user"` — consistent with Auth adapter naming; unquoted elsewhere may refer to different objects if mixed.
- Does not set `app_user_id` for Auth users with no matching `app_user` email — those remain NULL by design.

---

## 3. `drizzle/0009_rls_guc_safe.sql`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0009_rls_guc_safe.sql` |
| **Lines** | 88 |
| **Kind** | PostgreSQL function redefinition (security-critical RLS helpers) |
| **Exports** | N/A. **CREATE OR REPLACE FUNCTION:** `rls_guc_text_array(text)`, `rls_guc_uuid_array(text)`, `rls_wall_clear(uuid)`, `rls_deal_visible(uuid)` |
| **Imports** | N/A. **Depends on:** GUCs `app.wall`, `app.mandate_ids` (via `current_setting(..., true)`); table `deal` (`deal_id`, `barrier_id`); prior RLS from `0003_rls.sql` |

### Role

Hardens RLS helper functions so **empty-string session GUCs** do not cast-fail and abort queries. Fixes 500s on RSC re-render after `withRls` writes when pool connections reuse sessions with GUCs left as `''`.

### Business purpose

Keep Chinese-wall and mandate-scoped visibility working without intermittent server errors:

- **Problem:** `current_setting('app.wall', true)::text[]` (and mandate uuid[]) throws `malformed array literal: ''` when GUC is empty string (not NULL, not `'{}'`). Postgres OR does not guarantee short-circuit, so fail-open-style evaluation still hit the cast.
- **Reproducer (documented):** `/leads/[id]` re-render after `updateBant` (and any `withRls` write + `revalidatePath`).
- **Fix:** safe parsers + redefine wall/deal predicates to use them. Missing `app.user_id` is **not** treated as fail-open here; callers must set RLS context when they need walled access.

### Function signatures and bodies

#### `rls_guc_text_array(val text) → text[]` (STABLE, LANGUAGE sql)

```sql
CREATE OR REPLACE FUNCTION rls_guc_text_array(val text)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN val IS NULL OR btrim(val) = '' THEN ARRAY[]::text[]
    ELSE
      COALESCE(
        NULLIF(val, '')::text[],
        ARRAY[]::text[]
      )
  END
$$;
```

- Documented contract: NULL / `''` / unparseable → `ARRAY[]::text[]` (never throws).
- Empty result makes `= ANY(...)` match nothing.

#### `rls_guc_uuid_array(val text) → uuid[]` (STABLE, LANGUAGE sql)

```sql
CREATE OR REPLACE FUNCTION rls_guc_uuid_array(val text)
RETURNS uuid[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN val IS NULL OR btrim(val) = '' THEN ARRAY[]::uuid[]
    ELSE
      COALESCE(
        NULLIF(val, '')::uuid[],
        ARRAY[]::uuid[]
      )
  END
$$;
```

- Same pattern for uuid arrays (`app.mandate_ids`).

#### `rls_wall_clear(barrier uuid) → boolean` (STABLE)

```sql
SELECT barrier IS NULL
    OR barrier::text = ANY(rls_guc_text_array(current_setting('app.wall', true)))
```

- Wall-cleared if barrier is null **or** barrier text is in `app.wall` text array GUC.

#### `rls_deal_visible(d_id uuid) → boolean` (STABLE)

```sql
SELECT EXISTS (
  SELECT 1 FROM deal d
  WHERE d.deal_id = d_id
    AND (rls_wall_clear(d.barrier_id)
         OR d.deal_id = ANY(rls_guc_uuid_array(current_setting('app.mandate_ids', true)))))
```

- Deal visible if wall-clear **or** deal id is in mandate GUC set.

### Key logic

1. Guard empty/NULL GUC strings before array cast.
2. Replace prior inline `COALESCE(current_setting(...)::text[], ARRAY[]::text[])` pattern used in 0003.
3. `CREATE OR REPLACE` — idempotent redefinition of all four functions.
4. Explicit policy shift: **no fail-open when `app.user_id` is missing** in these helpers (comment); request code must set context.

### Side effects

- **Replaces** live definitions of `rls_wall_clear` and `rls_deal_visible` (all dependent RLS policies inherit new behavior immediately).
- Empty GUC → empty arrays → **stricter deny** for wall-gated rows (no accidental match; no cast crash).
- Functions are `STABLE` SQL — inlinable by planner; no security definer privilege elevation in this file.
- Pool connection GUC residue still matters for **correct** walls/mandates (app must `SET LOCAL` properly); this migration only stops **crashes**.

### Security / RBAC

| Aspect | Detail |
|--------|--------|
| **Chinese wall** | `rls_wall_clear` — barrier null or barrier listed in `app.wall` |
| **Mandate scope** | `rls_deal_visible` — wall clear OR deal in `app.mandate_ids` |
| **Fail mode** | Empty/missing wall/mandate GUCs → empty arrays → no wall match, no mandate match → **deny** for barred rows (unless barrier IS NULL) |
| **Trust boundary** | GUCs are session-settable; whoever can `SET app.wall` / `app.mandate_ids` controls visibility — must only run under trusted `withRls` / server role |
| **No `SECURITY DEFINER`** | Runs as invoker; table access still subject to caller rights + policies |
| **Recursion** | `rls_deal_visible` SELECTs `deal`; policies on `deal` that call this function must remain cycle-safe (established in 0003 design) |

### Coupling

| Coupled to | How |
|------------|-----|
| `drizzle/0003_rls.sql` | original `rls_wall_clear` / `rls_deal_visible`; many policies `USING`/`WITH CHECK` these functions |
| `deal` | existence + `barrier_id` |
| App session GUCs | `app.wall` (text array literal), `app.mandate_ids` (uuid array literal) |
| `withRls` transaction helper | sets GUCs via `SET LOCAL`; pool reuse is the failure mode this fixes |
| RSC / `revalidatePath` | post-write re-read path that hit 500s |

### Risks / TODOs

- **“Never throws” claim vs implementation:** `COALESCE(NULLIF(val,'')::text[], ...)` does **not** catch cast exceptions. Non-empty **malformed** literals (e.g. `'not-an-array'`) still throw `malformed array literal`. Only NULL and blank (after `btrim`) are truly safe. True resilience would use `EXCEPTION` PL/pgSQL or validate array literal form.
- **Whitespace-only** is handled (`btrim`); but value like `'{}'` parses to empty array (OK); value with spaces around a valid array may still fail cast depending on literal.
- **Semantic change vs older fail-open:** if any code path relied on missing user + broken cast aborting vs returning rows, behavior changes; comment says fail-open on missing `app.user_id` is intentionally not in these helpers.
- **`barrier::text = ANY(...)`** depends on how wall GUC stores barrier ids (text form of uuid); formatting mismatch → false denials.
- Replacing functions mid-flight is safe for new queries; no table rewrites.
- Does not redefine other RLS helpers (e.g. `rls_party_visible`) if they still use unsafe casts — **scope is only wall + deal** here; audit other GUC casts separately.

---

## 4. `drizzle/0010_party_segmentation_rbac_filters.sql`

| Field | Value |
|--------|--------|
| **Path** | `/home/Jashmhta/crm/bc-crm/app/drizzle/0010_party_segmentation_rbac_filters.sql` |
| **Lines** | 64 |
| **Kind** | PostgreSQL DDL migration (additive columns, FKs, indexes) |
| **Exports** | N/A. **Creates:** 16 columns on `party`; FKs `party_assigned_user_id_app_user_fk`, `party_data_owner_user_id_app_user_fk`; indexes listed below |
| **Imports** | N/A. **Depends on:** `party`, `app_user(user_id)` |

### Role

Adds **production CRM segmentation, credit rating, investor-suitability, and ownership** fields to `party` for filtering, assignment, and RBAC-oriented data ownership. Additive only; safe to re-run.

### Business purpose

Enable:

- **Ownership / RM assignment:** `assigned_user_id`, `data_owner_user_id` → `app_user`.
- **Issuer / corporate segmentation:** turnover (absolute + band), industry sector/subsector.
- **Credit ratings snapshot:** latest rating, agency, year, header.
- **Investor suitability:** investor type, portfolio size (absolute + band), risk appetite, high-yield flag, existing securities note.

These first-class columns (vs only JSONB) support list filters, indexes, and future RLS/RBAC predicates by owner/assignee.

### Objects / signatures

#### Columns (`ALTER TABLE party ADD COLUMN IF NOT EXISTS ...`)

| Column | Type | Default | Role |
|--------|------|---------|------|
| `assigned_user_id` | `uuid` | null | assigned CRM user / RM |
| `data_owner_user_id` | `uuid` | null | data owner for RBAC/ownership |
| `annual_turnover_cr` | `numeric(18,4)` | null | annual turnover in crores |
| `turnover_band` | `text` | null | banded turnover for filters |
| `industry_sector` | `text` | null | industry sector |
| `industry_subsector` | `text` | null | industry subsector |
| `latest_rating` | `text` | null | latest credit rating |
| `latest_rating_agency` | `text` | null | rating agency |
| `latest_rating_year` | `integer` | null | rating year |
| `latest_rating_header` | `text` | null | rating display/header |
| `investor_type` | `text` | null | investor classification |
| `portfolio_size_cr` | `numeric(18,4)` | null | portfolio size in crores |
| `portfolio_size_band` | `text` | null | portfolio size band |
| `risk_appetite` | `text` | null | risk appetite label |
| `high_yield_appetite` | `boolean` | **`DEFAULT false`** | HY appetite flag |
| `existing_securities_note` | `text` | null | free-text securities note |

#### Foreign keys (idempotent DO block)

```sql
-- party_assigned_user_id_app_user_fk
FOREIGN KEY (assigned_user_id) REFERENCES app_user(user_id) ON DELETE SET NULL

-- party_data_owner_user_id_app_user_fk
FOREIGN KEY (data_owner_user_id) REFERENCES app_user(user_id) ON DELETE SET NULL
```

Existence check: `pg_constraint.conname` before add.

#### Indexes (all partial `WHERE deleted_at IS NULL`)

| Index name | Columns |
|------------|---------|
| `party_assigned_user_idx` | `(assigned_user_id)` |
| `party_turnover_band_idx` | `(turnover_band)` |
| `party_industry_sector_idx` | `(industry_sector, industry_subsector)` |
| `party_latest_rating_idx` | `(latest_rating, latest_rating_agency, latest_rating_year)` |
| `party_investor_suitability_idx` | `(investor_type, portfolio_size_band, risk_appetite)` |

**No index** on `data_owner_user_id` in this file.

### Key logic

1. Bulk additive columns for segmentation dimensions.
2. Ownership FKs with `ON DELETE SET NULL` (user delete clears assignment/ownership, not party).
3. Partial indexes tuned for common filter combinations; soft-deleted parties excluded.
4. Only `high_yield_appetite` has a non-null default (`false`); other new columns stay NULL for existing rows.

### Side effects

- Widens `party` row; existing rows get NULLs (except new inserts get `high_yield_appetite = false` by default).
- FK adds may **fail** if dirty non-null `assigned_user_id` / `data_owner_user_id` already exist pointing at missing `app_user` (only if columns pre-existed with bad data); clean add is fine.
- Index build on large `party` tables may take locks/time depending on Postgres version and concurrency settings.
- Does **not** add CHECK constraints on band/enum text values — free text.

### Security / RBAC

- **Filename includes `rbac_filters`** but this migration **does not create RLS policies or functions**. It only adds columns that **application or future RLS** can use for filters (e.g. `assigned_user_id = current user`, `data_owner_user_id`).
- Until policies reference these columns, they are ordinary data under existing party wall RLS only.
- `ON DELETE SET NULL` can **strip ownership** when an `app_user` is deleted — may leave parties unowned and invisible under owner-scoped app filters.
- No grant/revoke changes.

### Coupling

| Coupled to | How |
|------------|-----|
| `party` | host table + `deleted_at` for partial indexes |
| `app_user(user_id)` | FK targets for assignment/ownership |
| Onboarding `assignedRm` in `onboarding_meta` (0007) | parallel assignment concept (JSONB vs column) — risk of dual sources of truth |
| Matching / issuer-investor filters | expected consumers of sector, rating, suitability indexes |
| Future RBAC policies | likely `data_owner_user_id` / `assigned_user_id` |

### Risks / TODOs

- **Dual assignment:** 0007 `onboarding_meta.assignedRm` vs `party.assigned_user_id` may diverge unless app syncs them.
- **No CHECKs / enums** for `turnover_band`, `investor_type`, `risk_appetite`, ratings — inconsistent free-text breaks filters and indexes cardinality.
- **No `data_owner_user_id` index** — owner-scoped lists may sequential-scan if used heavily.
- **`high_yield_appetite DEFAULT false`** may misrepresent “unknown” as “false” for unfilled parties.
- **Ratings denormalized** on party vs dedicated rating tables/history — staleness vs multi-rating issuers.
- **RBAC incomplete at DB layer:** columns alone do not enforce ownership; app must filter or RLS must be extended.
- Less narrative header than 0007–0009; intent inferred from names and short comment.

---

## Cross-file summary (batch 003)

| Migration | Theme | Tables touched | Functions | DML |
|-----------|--------|----------------|-----------|-----|
| **0007** | Onboarding case on party (JSONB) | `party` + 2 indexes | — | no |
| **0008** | Auth ↔ CRM user link | `users` + FK + index | — | yes (email backfill) |
| **0009** | RLS GUC cast safety | — | 4 functions | no |
| **0010** | Party segmentation / ownership | `party` + 2 FKs + 5 indexes | — | no (DDL defaults only) |

### Ordering / dependency notes

- **0007 → 0010:** both alter `party`; independent columns; apply either order relative to each other after `party` exists.
- **0008:** requires `users` + `app_user`; independent of onboarding/segmentation.
- **0009:** must run after `0003` RLS + `deal` exist; should run before production traffic hits empty GUC paths (or anytime as fix).
- **0010 FKs** depend on `app_user`; assignment columns complement 0007’s JSON `assignedRm` conceptually.

### Security posture of the batch

1. **0009** is the only direct security control change (RLS helper hardening / fail-closed empty GUCs).  
2. **0007 / 0010** expand sensitive party surface (PII, financials, ratings) under existing party RLS only.  
3. **0008** identity linkage correctness is a privilege-attribution control — wrong email join is a security risk.  
4. **0010** prepares RBAC filter dimensions but **does not implement** owner-based RLS policies.

### Shared risks

- Additive migrations are re-runnable, but **0009’s “unparseable never throws”** is only partial.  
- Free-text / JSONB without CHECKs defer integrity to the application.  
- Soft-delete-aware indexes assume consistent `deleted_at` usage in queries.  
- Assignment fields appear in both JSONB (0007) and columns (0010) — coordination required in app code.

---

*End of agent-003 analysis. Sources: full contents of the four SQL files listed in `batch-003.list`.*
