# Agent 066 — Extreme detail analysis

Batch files: `src/db/schema/index.ts`, `src/db/schema/information_barrier.ts`, `src/db/schema/interactions.ts`, `src/db/schema/modeling.ts`

Schema barrel, Chinese-wall registry, CRM activity log, financial models.

---

## `src/db/schema/index.ts`

- **Lines:** 42 | **Role:** Schema entry / re-export order
- **Exports:** `export *` from enums → rbac → information_barrier → party → contact → relationship → demat → deals → credit → modeling → compliance → interactions → tasks → documents → audit → **auth last**
- **Business purpose:** Documented FK resolution order; auth last avoids TS 7022 on contact from rbac↔contact mutual cycle
- **Key logic:** Comment maps full domain graph; Drizzle lazy-resolves references()
- **Side effects:** Module evaluation order is load-bearing for TypeScript
- **Risks:** Reordering exports can reintroduce circular type errors

---

## `src/db/schema/information_barrier.ts`

- **Lines:** 129 | **Role:** Chinese wall / MNPI wall registry (§1.7, §2.23.2, ARCH §4.4–4.5)
- **Exports:** `informationBarrier`, relations, types
- **Columns:**
  - barrier_id PK, name
  - deal_id, party_id as **plain uuids** (FK via migration to break mutual type cycle with deal/party)
  - restricted_role_set text[] NOT NULL — e.g. trading_desk tags blocked from MNPI
  - restricted_desk_set deskEnum[]
  - reason, created_by, erected_at, **lifted_at null = active**, is_active, soft delete
  - CHECK: deal_id OR party_id must be set (firm-wide walls with both null allowed per comment but CHECK actually requires one — verify intent)
- **Indexes:** deal, party, partial active WHERE deleted/lifted null
- **Business:** Rows on deal/party/interaction/document/credit_analysis/allocation/trade/audit reference barrier_id; RLS uses app.wall clearance tags
- **Security:** Lifting walls must be audited; restricted sets encode who is blocked
- **Coupling:** All walled operational tables; withContext GUCs
- **Risks:** CHECK vs firm-wide null-null comment may conflict; deal/party FKs only in migration

---

## `src/db/schema/interactions.ts`

- **Lines:** 184 | **Role:** Activity / CRM notes with MNPI flag
- **Exports:** `interaction`, `interactionAttendee`, relations, types
- **interaction:**
  - Anchors: party_id, deal_id, contact_id — CHECK `num_nonnulls(...) >= 1` (no free-floating notes)
  - channel: meeting|call|email|whatsapp|rfq|ndsom_chat|site_visit|management_presentation
  - direction inbound|outbound
  - subject, body, occurred_at, duration_min
  - primary_contact_id (denormalized), user_id (logger)
  - barrier_id, **contains_mnpi** boolean NOT NULL default false
  - next_action text (feeds AI summarizer)
  - Soft delete; BRIN migration note on occurred_at
- **interaction_attendee:** junction with role_at_meeting attendeeRoleEnum; UQ (interaction, contact)
- **Business:** Coverage desk CRM; MNPI walls trading desks via RLS
- **Security:** Walled table; contains_mnpi forces wall discipline in UI/policies
- **Coupling:** AI interactionSummary topic extraction; calendar queries
- **Risks:** Interaction list in calendar not scoped by user for non-admin (see calendar queries)

---

## `src/db/schema/modeling.ts`

- **Lines:** 117 | **Role:** Versioned financial models
- **Exports:** `financialModel`, relations, types
- **Columns:**
  - deal_id nullable, credit_analysis_id plain uuid, party_id
  - model_type: bond_pricing | project_finance | securitization | dcf | m_and_a | lbo | valuation | portfolio_construction | scenario_stress
  - version integer NOT NULL (append-only versioning), parent_model_id self
  - currency, **params jsonb**, **outputs jsonb** (schema-validated per type at app layer)
  - assumptions_doc, scenario_tag, engine_version, computed_at/by
  - **four-eyes:** approved_by_user_id
- **Indexes:** deal, party, type, parent; GIN notes for params/outputs
- **Business:** Pluggable engines (bondPricing pure TS used in seed); credit analysis may have multiple scenarios
- **Security:** Walled as financial_model; approval audit trail
- **Coupling:** features/modeling/*, seed bond metrics, credit analysis detail
- **Risks:** credit_analysis_id no Drizzle FK; CHECK/JSON schema only in app
