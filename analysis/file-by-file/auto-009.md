
# Batch 009

## `src/__tests__/aiSummary.test.ts`

- **Lines:** 511 | **Bytes:** 18222
- **Kind:** Vitest unit test
- **Header intent:** AI engines - heuristic generator invariants. Source of truth: src/features/ai/{creditSummary,interactionSummary,clientInsights}.ts.  Pins the deterministic behaviour of the "no external LLM" generators: - creditSummary: recommendation posture by band, NBFC framing, trend line, strengths/concerns thresholds, rating line. - interactionSummary: topic extraction, action-item extraction, empty scope, per-note mini-summary. - clientInsights: score bounding + the recommended-action taxonomy.  Only the 
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (3):** @/features/ai/creditSummary, @/features/ai/interactionSummary, @/features/ai/clientInsights
- **Domain terms:** Allocation, BC-1, BC-2, BC-4, BC-5, BC-6, KYC, allocation, bond, investor, mandate, onboarding

## `src/__tests__/bondPricing.test.ts`

- **Lines:** 480 | **Bytes:** 17020
- **Kind:** Vitest unit test
- **Header intent:** Bond pricing engine - canonical-case verification. Source of truth for expected behaviour: src/features/modeling/bondPricing.ts and docs/FINANCIAL_MODELING_SPEC.md §1.  These tests pin the financially-meaningful invariants, not floating-point exactness: a par bond prices cleanly at 100 with YTM == coupon, a discount bond prices below par, Macaulay duration is bounded by (0, maturity), convexity is strictly positive, and accrued interest follows the strict ACT/365 form (Face × c × days/DaysInYear
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/bondPricing
- **Domain terms:** Bond, GSEC, bond, gsec

## `src/__tests__/kyc.test.ts`

- **Lines:** 428 | **Bytes:** 15653
- **Kind:** Vitest unit test
- **Header intent:** KYC lifecycle helpers - exhaustive verification (PMLA 2002 + RBI Master Direction on KYC).  Source of truth: src/features/compliance/kyc.ts and the COMPLIANCE_LEGAL_FEASIBILITY.md §5 research.  Coverage: - Beneficial-ownership thresholds: company/SPV >10%, partnership >15%, trust >15%, natural_person / government / regulator → role-based (null). - requiresEddForBo: EDD triggers at >= threshold; null/missing inputs are safe (no false positives); partnership legal-form override. - Periodic re-KYC 
- **Security signals:** india-compliance
- **External deps:** vitest
- **Internal imports (1):** @/features/compliance/kyc
- **Domain terms:** KYC, kyc

## `src/__tests__/lboModel.test.ts`

- **Lines:** 192 | **Bytes:** 7209
- **Kind:** Vitest unit test
- **Header intent:** LBO engine - financial invariants verification. Source of truth: src/features/modeling/lboModel.ts. Pins the real-IB invariants: S&U balance, debt schedule amortizes to ≤ origin, sponsor IRR rises with exit multiple / falls with entry multiple, MOIC = exit / entry equity, sensitivity grid shape & monotonicity.
- **External deps:** vitest
- **Internal imports (1):** @/features/modeling/lboModel
