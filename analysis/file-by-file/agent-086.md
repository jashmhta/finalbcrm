# Agent 086 — File-by-file analysis (batch-086)

Files: securitization.ts, onboarding/actions.ts, onboarding/index.ts, onboarding-icons.tsx | Fully read

---

## src/features/modeling/securitization.ts

- **Lines:** 207  
- **Role:** Quick securitization/structured-finance sizing (FINANCIAL_MODELING_SPEC §3). Tranche CE, loss coverage, waterfall summary. Full monthly waterfall stays in Excel.

- **Exports:** TrancheInput, SecuritizationInputs, TrancheResult, SecuritizationResult, `computeSecuritization`.

- **Key logic:**
  - Cum default ≈ defaultRate × tenor (capped 1); losses = cum×(1−recovery); stress = base×multiplier.
  - OC = max(0, 1 − Σ tranche par%).
  - CE for tranche = junior par + OC + cash reserve (senior only); LCM = CE/stress losses.
  - Break-even default, EL screening (pd = min(1, stress/CE), LGD=1), WAL proxy, IRR ≈ coupon.
  - Waterfall steps 1–7: fees → senior i/p → mezz i/p → reserve top-up → residual.
  - Notes if senior LCM <1 or negative excess spread.

- **Risks:** Linear loss model; cash reserve formula uses senior par% only; indicative IRR ignores losses.

---

## src/features/onboarding/actions.ts

- **Lines:** 855  
- **Role:** Client onboarding server actions — stage machine with gates, 7-doc checklist, KYC raise, compliance sign-off, activate. JSONB `onboarding_meta` via raw SQL + withRls.

- **Exports:** createOnboarding, advanceStage, startKyc, markDocumentUploaded, verifyDocument, rejectDocument, approveCompliance, rejectCompliance, activateClient, updateAssignedRm, deleteOnboarding + state types.

- **Stage machine (enforced):**
  - initiated → profile_created → documents_collected → kyc_verified → compliance_approved → active
  - **Gate docs→KYC:** allDocsVerified AND linked kyc_record.status==='approved' (live read)
  - Compliance approve only from kyc_verified; reject stays at kyc_verified with flags
  - activateClient flips party.status='active'

- **createOnboarding:** party prospect + documents in hand as document rows + meta stage profile_created + stageHistory; PAN/GSTIN regex; redirect detail.

- **Security:**
  - party create/update for most ops.
  - startKyc rides party:update (no kyc_record:create seeded).
  - approve/rejectCompliance: `approve:kyc` OR `update:party` (compliance officer path).
  - Document verify uses party:update (not a dedicated compliance-only gate).

- **Risks:** verifyDocument available to any party updater; deleteOnboarding clears meta only; wizard notes folded into complianceNote; PAN optional empty string via or(literal("")).

---

## src/features/onboarding/index.ts

- **Lines:** 56  
- **Role:** Feature barrel re-exporting types, icons, queries, actions for `/onboarding` routes.

- **Coupling:** Same barrel caution as leads (client icons + server actions).

---

## src/features/onboarding/onboarding-icons.tsx

- **Lines:** 101  
- **Role:** `"use client"` Phosphor icons for 7 checklist docs + 6 stages; stage→IconTone map; ComplianceScaleIcon re-export.

- **DOC_ICONS:** Certificate, IdentificationCard, Stamp, Fingerprint, ChartBar, Users, CheckCircle.  
- **STAGE_ICONS:** Buildings → … → CheckCircle.  
- **Tones:** gold for documents/kyc; emerald for compliance/active.

---

## Batch 086 synthesis

Securitization closes pure modeling engines. Onboarding mutations implement a full PMLA-oriented corporate onboarding workflow with real document rows and KYC linkage — one of the densest compliance UIs in the CRM.
