# Agent 087 — File-by-file analysis (batch-087)

Files: onboarding/queries.ts, seed.ts, types.ts, parties/actions.ts | Fully read (seed partially + structure)

---

## src/features/onboarding/queries.ts

- **Lines:** 696  
- **Role:** Onboarding pipeline/detail/analytics data access. Live KYC JOIN from kyc_record so gates never trust denormalized status alone.

- **Exports:** RmOption, OnboardingKycState, OnboardingRow/PipelineGroup/Contact/Task/Detail, analytics types, `normalizeOnboarding`, `listRms`, `fetchAllOnboarding`, `getOnboardingPipeline`, `getOnboardingDetail`, `getLinkedKycStatus`, `getOnboardingAnalytics`, checklist helpers re-exports.

- **ONBOARDING_SELECT:** party + onboarding_meta + kyc_record by meta kycRecordId + RM name join.

- **Scope:** assigned/owner/created party OR onboarding_meta.assignedRm.

- **getOnboardingDetail:** types, contacts, listInteractions, tasks — same pattern as leads.

- **Analytics:** open/active/overdue/dueSoon/awaitingDocs/awaitingCompliance, avg days to activate, by stage/clientType/RM.

- **Security:** rbac-core can; unscoped full read.

---

## src/features/onboarding/seed.ts

- **Lines:** ~450+  
- **Role:** CLI seed for 28 fixed Indian company names across funnel stages; self-cleaning by legal_name; mulberry32 0x0b0a7d1e.

- **Key logic:**
  - DELETE kyc_record edd_reason=ONBOARDING_SEED, documents ONBOARDING_SEED:%, parties by name list.
  - Stage distribution + SLA-tuned stageHistory + checklist completion by stage.
  - Approved KYC for kyc_verified+; pending in_review for some documents_collected with all verified.
  - Compliance rejection sample on some kyc_verified cases.
  - party.status active only when stage active.

- **Side effects:** Destructive re-seed of named parties. Ops-only.

---

## src/features/onboarding/types.ts

- **Lines:** 516  
- **Role:** Onboarding domain constants — stages, client types, 7-doc checklist, SLA clocks, transition adjacency, progress helpers.

- **Key constants:**
  - Stages order + labels + tones + SLA days (1/3/7/2/1/0) + SLA due-soon window 1 day
  - ONBOARDING_ALLOWED_TRANSITIONS adjacency; canTransitionOnboarding; nextStageOf
  - DOC order/labels/hints; ONBOARDING_DOC_TO_DOCUMENT_TYPE (some map to `other`)
  - `computeOnboardingSla`, freshChecklist, docsUploaded/Verified/Rejected, allDocsVerified, progress bars

- **Business purpose:** SEBI/PMLA corporate onboarding distinct from lead funnel and deal pipeline.

---

## src/features/parties/actions.ts

- **Lines:** 358  
- **Role:** Party master mutations: create (with type + optional address + **duplicate candidates**), assign (with task), update segmentation fields.

- **Exports:** createParty, assignParty, updatePartySegmentation + state types.

- **createParty:**
  - RBAC create:party; nature/type enums; brandOrigin shared; assigned/owner = creator.
  - `queueDuplicateCandidates`: pg_trgm similarity ≥0.72 or exact legal_name same country; insert party_duplicate_candidate ON CONFLICT DO NOTHING.
  - address line1="-" stub if city+state provided.

- **assignParty:** super_admin/admin/assign:party/update:party; updates assigned+dataOwner; creates pending task "Review assigned relationship" due +2d.

- **updatePartySegmentation:** turnover/sector/rating/investor/portfolio/riskAppetite/HY/existing securities — zod catalog enums from segmentation.ts.

- **Security:** Full authz on each action; withRls. Duplicate detection evidence JSON stored.

- **Risks:** address line1 placeholder; similarity requires pg_trgm extension; create redirects always.

---

## Batch 087 synthesis

Onboarding read/seed/types complete the feature; parties actions open master-data mutations with dedup and segmentation — core CRM write surface for relationship managers.
