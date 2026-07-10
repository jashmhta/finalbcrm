# 03 — Database (schema, migrations, RLS)

Drizzle schema modules, SQL migrations (including RLS + indexes), client, context helpers, and seed scripts.

## File inventory

_41 files · 29,619 lines_

### Domain: `client-rls-seed`

PRD: **Security RLS**

#### `app/src/db/.gitkeep`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | db — placeholder. Implementation after design docs finalized. |

#### `app/src/db/context.ts`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 159 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (3) | withContext, withRls, withRlsRead |
| Has TODO | N |
| Purpose | RLS context helper - sets Postgres session GUCs per-transaction so Row Level Security policies on `deal`, `deal_party`, `allocation_event`, `credit_*`, `interaction`, `document`, `party` can consult them (ARCHITECTURE §4.4).  GUCs: app.user_id      text         - the acting app_user.user_id (uuid as text) app.wall         text[]       - barrier clearance tags (ABAC compartments) app.mandate_ids  u |

#### `app/src/db/domain-check.ts`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 165 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Domain-logic smoke check - exercises the real modeling/credit/scorecard code paths against a sample instrument and seeded DB rows, then prints results so a human can eyeball whether the values are sane.  Run:  npx tsx src/db/domain-check.ts |

#### `app/src/db/index.ts`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 64 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (2) | db, DB |
| Has TODO | N |
| Purpose | Exports: db, DB |

#### `app/src/db/rls.ts`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 363 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (5) | WALLED_TABLES, RlsTableStatus, RlsVerifyReport, applyRlsMigration, verifyRls |
| Has TODO | N |
| Purpose | RLS apply + verify helper (Track B / RLS).  Pairs with drizzle/0003_rls.sql. The migration provisions: - a non-superuser, non-BYPASSRLS app role `crm_app`; - ENABLE + FORCE ROW LEVEL SECURITY on the 16 walled tables; - GUC-driven policies (app.user_id, app.wall text[], app.mandate_ids uuid[]); - an immutable, tamper-evident audit_log (INSERT-only + sha256 hash chain); - GRANTs: SELECT/INSERT/UPDAT |

#### `app/src/db/seed-admin.ts`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 133 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Track B / AUTH - provision the seeded admin user with a REAL bcrypt-hashed password and MFA disabled.  Run:  npx tsx src/db/seed-admin.ts  Idempotent: looks up `app_user` by email (citext, case-insensitive) and - if found: sets password_hash, resets failed_login_count/locked_until, keeps MFA disabled, and ensures a current 'admin' role grant exists; - if not found: inserts a minimal active admin a |

#### `app/src/db/seed-scale.ts`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 716 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | 10k-party scale seed + performance proof (IMPORT-PERF track).  Run:  npx tsx src/db/seed-scale.ts  This is a SEPARATE, additive seed - it does NOT replace the demo seed (src/db/seed.ts, 801 rows). It seeds ~10,000 scale parties + identifiers + types + addresses + contacts + party_contact + a modest set of deals / deal_party into the LIVE local Postgres (binary_crm), then runs a performance check t |

#### `app/src/db/seed.ts`

| Field | Value |
|---|---|
| Role | `db-infra` — DB client, RLS helpers, seed scripts |
| LOC | 3750 |
| Runtime | server |
| Uses DB | Y |
| Maturity | partial |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Deterministic mock-data seed for the Binary Capital CRM.  Run:  npx tsx src/db/seed.ts  Connects via the shared `db` client (src/db/index.ts) and inserts a realistic Indian capital-markets dev dataset into the LIVE local Postgres (binary_crm). Re-runnable: TRUNCATEs every table (CASCADE) before inserting.  Determinism: a seeded mulberry32 PRNG drives every "random" choice so two runs produce ident |

### Domain: `migrations`

PRD: **Cross-cutting Data Model**

#### `app/drizzle/0000_minor_kitty_pryde.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 995 |
| Runtime | sql |
| Uses DB | N |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0001_easy_scarlet_spider.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 64 |
| Runtime | sql |
| Uses DB | N |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0002_auth.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 22 |
| Runtime | sql |
| Uses DB | N |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0003_rls.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 382 |
| Runtime | sql |
| Uses DB | Y |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0004_rls_fix.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 111 |
| Runtime | sql |
| Uses DB | Y |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0005_indexes.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 146 |
| Runtime | sql |
| Uses DB | Y |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0006_leads.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 62 |
| Runtime | sql |
| Uses DB | Y |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0007_onboarding.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 80 |
| Runtime | sql |
| Uses DB | Y |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0008_users_app_user_id.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 60 |
| Runtime | sql |
| Uses DB | Y |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0009_rls_guc_safe.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 87 |
| Runtime | sql |
| Uses DB | Y |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0010_party_segmentation_rbac_filters.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 64 |
| Runtime | sql |
| Uses DB | N |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/0011_party_duplicate_candidates.sql`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 34 |
| Runtime | sql |
| Uses DB | N |
| Maturity | migrated |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/meta/0000_snapshot.json`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 8672 |
| Runtime | n/a |
| Uses DB | Y |
| Maturity | supporting |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/meta/0001_snapshot.json`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 8938 |
| Runtime | n/a |
| Uses DB | Y |
| Maturity | supporting |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

#### `app/drizzle/meta/_journal.json`

| Field | Value |
|---|---|
| Role | `migration-sql` — SQL migration applied via Drizzle |
| LOC | 20 |
| Runtime | n/a |
| Uses DB | Y |
| Maturity | supporting |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | SQL migration applied via Drizzle |

### Domain: `schema`

PRD: **Cross-cutting Data Model**

#### `app/src/db/schema/.gitkeep`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | schema — placeholder. Implementation after design docs finalized. |

#### `app/src/db/schema/audit.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 129 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (4) | auditLog, auditLogRelations, AuditLog, AuditLogInsert |
| Has TODO | N |
| Purpose | audit_log - IMMUTABLE, INSERT-only (§1.3, §2.22, ARCHITECTURE §5.1). Append-only: enforced by RLS (no UPDATE/DELETE policy for any role) plus a Postgres trigger that rejects any non-INSERT on the table. The `audit_purge` role is the only role with DELETE, used by a documented, signed-off retention purge job (§5.6).  RANGE PARTITIONING by occurred_at (monthly partitions: audit_log_y2026m01, …) - Dr |

#### `app/src/db/schema/auth.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 159 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (15) | users, accounts, sessions, verificationTokens, authenticators, AuthUser, AuthUserInsert, AuthAccount |
| Has TODO | N |
| Purpose | Auth.js v5 identity tables (users / accounts / sessions / verificationTokens / authenticators) - the standard @auth/drizzle-adapter shape.  LINKAGE DESIGN (app_user ↔ users): the 1:1 link is `users.app_user_id` → `app_user.user_id`. The column is declared here as a plain `uuid` (NOT via Drizzle `references()`) and the FK constraint is added via raw SQL in a migration - see the MIGRATION NOTE below |

#### `app/src/db/schema/compliance.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 175 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (8) | consentRecord, dataSubjectRequest, consentRecordRelations, dataSubjectRequestRelations, ConsentRecord, ConsentRecordInsert, DataSubjectRequest, DataSubjectRequestInsert |
| Has TODO | N |
| Purpose | Compliance: consent_record (DPDP Act 2023) + data_subject_request. DATA_MODEL §2.21, §2.23.8. Consent is purpose-bound - a marketing consent does not authorize sharing data with a rating agency; that requires its own consent_record. Withdrawal triggers a data_subject_request workflow. |

#### `app/src/db/schema/contact.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 179 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (8) | contact, partyContact, contactRelations, partyContactRelations, Contact, ContactInsert, PartyContact, PartyContactInsert |
| Has TODO | N |
| Purpose | Contact (natural person) + party_contact (role link with interval). DATA_MODEL §2.4-2.5. Contacts are decoupled from parties; roles are the link. We never delete a contact when they leave a firm - we close the PartyContact interval (§1.2). |

#### `app/src/db/schema/credit.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 989 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (56) | sectorCode, creditAnalysis, financialStatement, creditAnalysisFsLink, ratioResult, scorecardTemplate, scorecard, creditScore |
| Has TODO | N |
| Purpose | Credit analysis subsystem. DATA_MODEL §2.12-2.16, §2.20, §2.23.6-2.23.7. CREDIT_ANALYSIS_SPEC §13.  Tables: sector_code, credit_analysis, financial_statement, credit_analysis_fs_link (junction), ratio_result, credit_score, scorecard, scorecard_template, external_rating, rating_ladder, exposure, credit_limit, kyc_record, kyc_beneficial_owner (junction).  Interpretation note: DATA_MODEL §2.23.6 `sco |

#### `app/src/db/schema/deals.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 464 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (20) | instrument, deal, dealParty, allocationEvent, tradeEvent, instrumentRelations, dealRelations, dealPartyRelations |
| Has TODO | N |
| Purpose | Deals: instrument, deal, deal_party, allocation_event, trade_event. DATA_MODEL §2.9-2.11, §2.16, §2.23.3. Allocation and trade events are IMMUTABLE append-only (§1.3, §2.11, §2.23.3) - post-pricing rows are frozen; corrections append a new compensating event. This is the regulator-grade trade-record pattern for CCIL/NDS-OM reportable trades (§2.11). |

#### `app/src/db/schema/demat.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 64 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (4) | dematAccount, dematAccountRelations, DematAccount, DematAccountInsert |
| Has TODO | N |
| Purpose | Demat account - investor depository account (§2.23.1, §3). NSDL `IN...` 8-char alphanumeric DP IDs vs CDSL 8-digit numeric. The dedup key is (dp_id, client_id, depository) WHERE deleted_at IS NULL. Referenced by allocation_event.demat_account_id and by party_identifier(identifier_type='demat_dp_client'). |

#### `app/src/db/schema/documents.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 113 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (4) | document, documentRelations, Document, DocumentInsert |
| Has TODO | N |
| Purpose | document - metadata only (§2.20). The file blob lives in S3-compatible object storage with a reference; KYC documents are encryption-at-rest + access-logged separately (ARCHITECTURE §4.3). barrier_id is the information-wall tag for RLS (§1.7). |

#### `app/src/db/schema/enums.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 768 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (68) | citext, partyTypeEnum, partyStatusEnum, partyNatureEnum, brandEnum, dataSourceEnum, identifierTypeEnum, regnCategoryEnum |
| Has TODO | N |
| Purpose | Enums and shared column primitives for the Binary Capital / Binary Bonds CRM schema. Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md §6 (enumerations) + inline enum mentions throughout §2 and §3, plus /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13.  NOTE on `citext`: PostgreSQL's case-insensitive text type. Requires `CREATE EXTENSION IF NOT EXISTS citext;` in a baseline migration befor |

#### `app/src/db/schema/index.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 41 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Drizzle schema entry point - re-exports all modules. Source of truth: /home/Jashmhta/crm/docs/DATA_MODEL.md (full domain model), /home/Jashmhta/crm/docs/CREDIT_ANALYSIS_SPEC.md §13 (ScorecardTemplate & SectorCode), and /home/Jashmhta/crm/docs/ARCHITECTURE.md §4-5 (RLS / information-barrier + immutable audit intent).  Order matters for foreign-key resolution - Drizzle resolves `references()` lambda |

#### `app/src/db/schema/information_barrier.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 128 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (4) | informationBarrier, informationBarrierRelations, InformationBarrier, InformationBarrierInsert |
| Has TODO | N |
| Purpose | Information barrier (Chinese wall) - DATA_MODEL §1.7, §2.23.2. ARCHITECTURE §4.4-4.5: RLS policies tag rows by barrier_id on deal, party, interaction, document, credit_analysis, allocation_event. This table is the wall registry; lifting is audited and `lifted_at` null = active. |

#### `app/src/db/schema/interactions.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 183 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (8) | interaction, interactionAttendee, interactionRelations, interactionAttendeeRelations, Interaction, InteractionInsert, InteractionAttendee, InteractionAttendeeInsert |
| Has TODO | N |
| Purpose | interactions: interaction + interaction_attendee (junction). DATA_MODEL §2.18. An interaction must anchor to at least one of a party, a deal, or a contact (CHECK num_nonnulls >= 1). MNPI interactions are walled via barrier_id (§1.7). Attendees are a junction (replacing the former attendee_contact_ids uuid[] array - §2.18). |

#### `app/src/db/schema/modeling.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 116 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (4) | financialModel, financialModelRelations, FinancialModel, FinancialModelInsert |
| Has TODO | N |
| Purpose | financial_model - versioned, type-specific financial models (§2.17). Inputs and outputs are JSONB; the engine is pluggable but the *shape* is constrained by model_type. Per-type output schemas (bond_pricing, project_finance, securitization, dcf, m_and_a, lbo) are enforced by CHECK constraints / JSON schema at the app layer (§2.17). |

#### `app/src/db/schema/party.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 460 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (20) | party, partyTypeAssignment, partyIdentifier, address, partyDuplicateCandidate, partyRelations, partyTypeAssignmentRelations, partyIdentifierRelations |
| Has TODO | N |
| Purpose | Party master + typing + canonical identifiers + address. DATA_MODEL §2.1-2.3, §2.23.9, §3 (Indian-specific fields), §1.4 (dedup). The party master is the single source of truth - no deal/contact/exposure/ credit record references free-text names; all reference party_id (§1.1). |

#### `app/src/db/schema/rbac.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 319 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (18) | appUser, role, permission, rolePermission, userRole, appUserRelations, roleRelations, permissionRelations |
| Has TODO | N |
| Purpose | RBAC - app_user, role, permission, role_permission, user_role. DATA_MODEL §2.8, §2.23.12. ARCHITECTURE §4.2: RBAC baseline + ABAC attributes (wall/compartment, mandate_id, client_id). Time-bounded roles matter because secondees and temps rotate through the credit desk. |

#### `app/src/db/schema/relationship.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 98 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (4) | relationship, relationshipRelations, Relationship, RelationshipInsert |
| Has TODO | N |
| Purpose | Relationship - org hierarchy / beneficial-ownership edges (§1.5, §2.6). parent_party_id / child_party_id directed edge. relationship_type ∈ {wholly_owned, subsidiary, associate, jv, promoter, beneficial_owner, guarantor, sister_concern, management_control}. Ultimate parent is computed via a recursive CTE; party.ultimate_parent_party_id is a denormalized cache refreshed on edge change (§1.5). A ben |

#### `app/src/db/schema/tasks.ts`

| Field | Value |
|---|---|
| Role | `drizzle-table` — Drizzle ORM table/enum definitions |
| LOC | 145 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (8) | task, taskDependency, taskRelations, taskDependencyRelations, Task, TaskInsert, TaskDependency, TaskDependencyInsert |
| Has TODO | N |
| Purpose | task - standard task model (§2.19). Tasks auto-generate from deal-stage transitions (e.g., entering `rating_marketing` creates "Coordinate agency management meeting" tasks per agency). depends_on is modeled as a separate junction table (task_dependency) to preserve FK integrity - an array could not. |
