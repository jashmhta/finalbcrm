// KYC lifecycle helpers - exhaustive verification (PMLA 2002 + RBI Master
// Direction on KYC).
//
// Source of truth: src/features/compliance/kyc.ts and the
// COMPLIANCE_LEGAL_FEASIBILITY.md §5 research.
//
// Coverage:
//   - Beneficial-ownership thresholds: company/SPV >10%, partnership >15%,
//     trust >15%, natural_person / government / regulator → role-based (null).
//   - requiresEddForBo: EDD triggers at >= threshold; null/missing inputs are
//     safe (no false positives); partnership legal-form override.
//   - Periodic re-KYC periodicity: low=10yr, medium=8yr, high=2yr.
//   - computeValidUntil / computeRekycDueDate (lead time subtract).
//   - Retention horizon (PMLA s.12: 5yr).
//   - Status transitions (allowedTransitions / canTransition).
//   - shouldEscalateToEdd: high risk / BO threshold / PEP / sanctions.
//   - PEP/sanctions screening stubs return clear (safe default).
//
// Pure helpers - no DB - so the suite is hermetic.

import { describe, expect, it } from "vitest";

import {
  BO_THRESHOLD_PCT,
  PARTNERSHIP_BO_THRESHOLD_PCT,
  RISK_REFRESH_YEARS,
  RISK_LEAD_TIME_MONTHS,
  KYC_RETENTION_YEARS,
  STR_FILING_DEADLINE_WORKING_DAYS,
  CTR_MONTHLY_THRESHOLD_INR,
  boThresholdFor,
  requiresEddForBo,
  computeValidUntil,
  computeRekycDueDate,
  computeRetentionUntil,
  allowedTransitions,
  canTransition,
  shouldEscalateToEdd,
  screenSanctions,
  screenPep,
  type PartyNature,
  type LegalForm,
  type KycRisk,
  type KycStatus,
} from "@/features/compliance/kyc";

// ---------------------------------------------------------------------------
// Beneficial-ownership thresholds.
// ---------------------------------------------------------------------------

describe("BO_THRESHOLD_PCT - PML Rules 2005 Rule 9(3) (2019 amendment)", () => {
  it("company / organization / SPV threshold is 10%", () => {
    expect(BO_THRESHOLD_PCT.organization).toBe(10);
    expect(BO_THRESHOLD_PCT.spv).toBe(10);
  });

  it("trust threshold is 15%", () => {
    expect(BO_THRESHOLD_PCT.trust).toBe(15);
  });

  it("natural_person / government / regulator are role-based (null - no % threshold)", () => {
    expect(BO_THRESHOLD_PCT.natural_person).toBeNull();
    expect(BO_THRESHOLD_PCT.government).toBeNull();
    expect(BO_THRESHOLD_PCT.regulator).toBeNull();
  });

  it("PARTNERSHIP_BO_THRESHOLD_PCT is 15% (PML Rules 2005)", () => {
    expect(PARTNERSHIP_BO_THRESHOLD_PCT).toBe(15);
  });
});

describe("boThresholdFor - nature + legal-form override", () => {
  it("organization → 10%", () => {
    expect(boThresholdFor("organization")).toBe(10);
  });

  it("trust → 15%", () => {
    expect(boThresholdFor("trust")).toBe(15);
  });

  it("spv → 10%", () => {
    expect(boThresholdFor("spv")).toBe(10);
  });

  it("natural_person → null (the principal IS the BO)", () => {
    expect(boThresholdFor("natural_person")).toBeNull();
  });

  it("government / regulator → null (senior managing official fallback)", () => {
    expect(boThresholdFor("government")).toBeNull();
    expect(boThresholdFor("regulator")).toBeNull();
  });

  it("partnership legal form overrides organization → 15%", () => {
    // A partnership is modeled with party_nature='organization', so the caller
    // MUST pass legalForm='partnership' to get the 15% threshold.
    expect(boThresholdFor("organization", "partnership")).toBe(15);
  });

  it("company legal form does not override the organization threshold (still 10%)", () => {
    expect(boThresholdFor("organization", "company")).toBe(10);
    expect(boThresholdFor("organization", "llp")).toBe(10);
  });

  it("partnership override applies regardless of nature (even trust-shaped)", () => {
    // The override is unconditional on the legalForm arg.
    expect(boThresholdFor("trust", "partnership")).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// requiresEddForBo - EDD trigger from BO ownership %.
// ---------------------------------------------------------------------------

describe("requiresEddForBo - EDD trigger logic", () => {
  it("organization at exactly 10% → EDD (>= threshold)", () => {
    expect(requiresEddForBo("organization", 10)).toBe(true);
  });

  it("organization at 9.9% → no EDD (below threshold)", () => {
    expect(requiresEddForBo("organization", 9.9)).toBe(false);
  });

  it("organization at 25% → EDD (well above threshold)", () => {
    expect(requiresEddForBo("organization", 25)).toBe(true);
  });

  it("trust at exactly 15% → EDD", () => {
    expect(requiresEddForBo("trust", 15)).toBe(true);
  });

  it("trust at 14.9% → no EDD", () => {
    expect(requiresEddForBo("trust", 14.9)).toBe(false);
  });

  it("partnership (organization + legalForm) at 15% → EDD", () => {
    expect(requiresEddForBo("organization", 15, "partnership")).toBe(true);
  });

  it("partnership at 10% → no EDD (partnership threshold is 15, not 10)", () => {
    // Confirms the partnership override actually raises the bar.
    expect(requiresEddForBo("organization", 10, "partnership")).toBe(false);
  });

  it("role-based natures (natural_person / government / regulator) → always false", () => {
    expect(requiresEddForBo("natural_person", 100)).toBe(false);
    expect(requiresEddForBo("government", 100)).toBe(false);
    expect(requiresEddForBo("regulator", 100)).toBe(false);
  });

  it("null ownership % → false (no false positives on missing data)", () => {
    expect(requiresEddForBo("organization", null)).toBe(false);
    // `undefined` is treated as missing by the runtime null check (== null).
    expect(requiresEddForBo("organization", undefined as unknown as null)).toBe(false);
  });

  it("string-encoded % is coerced (organization '10' → EDD)", () => {
    expect(requiresEddForBo("organization", "10")).toBe(true);
    expect(requiresEddForBo("organization", "9")).toBe(false);
  });

  it("non-numeric string → false (safe)", () => {
    expect(requiresEddForBo("organization", "n/a")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Periodic re-KYC periodicity.
// ---------------------------------------------------------------------------

describe("RISK_REFRESH_YEARS - RBI Master Direction on KYC (FAQ Id=3782)", () => {
  it("low risk → 10 years", () => {
    expect(RISK_REFRESH_YEARS.low).toBe(10);
  });

  it("medium risk → 8 years", () => {
    expect(RISK_REFRESH_YEARS.medium).toBe(8);
  });

  it("high risk → 2 years", () => {
    expect(RISK_REFRESH_YEARS.high).toBe(2);
  });
});

describe("RISK_LEAD_TIME_MONTHS - re-KYC runway before valid_until", () => {
  it("low / medium risk → 3 months lead", () => {
    expect(RISK_LEAD_TIME_MONTHS.low).toBe(3);
    expect(RISK_LEAD_TIME_MONTHS.medium).toBe(3);
  });

  it("high risk → 1 month lead", () => {
    expect(RISK_LEAD_TIME_MONTHS.high).toBe(1);
  });
});

describe("computeValidUntil - risk-based expiry date", () => {
  const base = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01

  it("low risk → +10 years (2034-01-01)", () => {
    expect(computeValidUntil("low", base)).toBe("2034-01-01");
  });

  it("medium risk → +8 years (2032-01-01)", () => {
    expect(computeValidUntil("medium", base)).toBe("2032-01-01");
  });

  it("high risk → +2 years (2026-01-01)", () => {
    expect(computeValidUntil("high", base)).toBe("2026-01-01");
  });

  it("returns an ISO YYYY-MM-DD string", () => {
    const s = computeValidUntil("low", base);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("computeRekycDueDate - valid_until minus lead time", () => {
  it("low risk: 2034-01-01 minus 3 months → 2033-10-01", () => {
    expect(computeRekycDueDate("2034-01-01", "low")).toBe("2033-10-01");
  });

  it("medium risk: 2032-01-01 minus 3 months → 2031-10-01", () => {
    expect(computeRekycDueDate("2032-01-01", "medium")).toBe("2031-10-01");
  });

  it("high risk: 2026-01-01 minus 1 month → 2025-12-01", () => {
    expect(computeRekycDueDate("2026-01-01", "high")).toBe("2025-12-01");
  });

  it("throws on an invalid valid_until", () => {
    expect(() => computeRekycDueDate("not-a-date", "low")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Retention horizon (PMLA s.12).
// ---------------------------------------------------------------------------

describe("KYC_RETENTION_YEARS - PMLA s.12 retention", () => {
  it("identity + transaction records retained 5 years", () => {
    expect(KYC_RETENTION_YEARS).toBe(5);
  });
});

describe("computeRetentionUntil - base + 5yr", () => {
  it("5 years from 2024-01-01 → 2029-01-01", () => {
    const base = new Date(Date.UTC(2024, 0, 1));
    expect(computeRetentionUntil(base)).toBe("2029-01-01");
  });

  it("honours a custom years override", () => {
    const base = new Date(Date.UTC(2024, 0, 1));
    expect(computeRetentionUntil(base, 10)).toBe("2034-01-01");
  });
});

// ---------------------------------------------------------------------------
// Status transitions.
// ---------------------------------------------------------------------------

describe("allowedTransitions / canTransition - KYC state machine", () => {
  it("pending → in_review (forward only)", () => {
    expect(canTransition("pending", "in_review")).toBe(true);
    expect(canTransition("pending", "approved")).toBe(false); // cannot skip
  });

  it("in_review → approved | rejected | under_eds_check (EDD path)", () => {
    expect(canTransition("in_review", "approved")).toBe(true);
    expect(canTransition("in_review", "rejected")).toBe(true);
    expect(canTransition("in_review", "under_eds_check")).toBe(true);
  });

  it("under_eds_check → approved | rejected | back to in_review", () => {
    expect(canTransition("under_eds_check", "approved")).toBe(true);
    expect(canTransition("under_eds_check", "rejected")).toBe(true);
    expect(canTransition("under_eds_check", "in_review")).toBe(true);
  });

  it("approved → expired | rekyc_due (lifecycle after approval)", () => {
    expect(canTransition("approved", "expired")).toBe(true);
    expect(canTransition("approved", "rekyc_due")).toBe(true);
    expect(canTransition("approved", "in_review")).toBe(false); // not allowed directly
  });

  it("rejected → in_review (re-submission)", () => {
    expect(canTransition("rejected", "in_review")).toBe(true);
    expect(canTransition("rejected", "approved")).toBe(false);
  });

  it("expired → rekyc_due", () => {
    expect(canTransition("expired", "rekyc_due")).toBe(true);
  });

  it("rekyc_due → in_review (re-KYC cycle restarts)", () => {
    expect(canTransition("rekyc_due", "in_review")).toBe(true);
  });

  it("every status has an entry in allowedTransitions", () => {
    const statuses: KycStatus[] = [
      "pending",
      "in_review",
      "approved",
      "rejected",
      "expired",
      "rekyc_due",
      "under_eds_check",
    ];
    for (const s of statuses) {
      expect(allowedTransitions[s]).toBeDefined();
      expect(Array.isArray(allowedTransitions[s])).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// shouldEscalateToEdd - composite EDD routing.
// ---------------------------------------------------------------------------

describe("shouldEscalateToEdd - composite escalation", () => {
  const baseInput = {
    partyNature: "organization" as PartyNature,
    highestBoOwnershipPct: 5 as number | null, // below 10% threshold
    pepStatus: "none" as string | null,
    sanctionsStatus: "clear" as const,
    riskRating: "low" as KycRisk,
    legalForm: null as LegalForm | null,
  };

  it("clean low-risk organization below BO threshold → no EDD", () => {
    expect(shouldEscalateToEdd(baseInput)).toBe(false);
  });

  it("high risk rating → EDD regardless of other inputs", () => {
    expect(shouldEscalateToEdd({ ...baseInput, riskRating: "high" })).toBe(true);
  });

  it("BO ownership crossing the 10% corporate threshold → EDD", () => {
    expect(shouldEscalateToEdd({ ...baseInput, highestBoOwnershipPct: 10 })).toBe(true);
    expect(shouldEscalateToEdd({ ...baseInput, highestBoOwnershipPct: 12 })).toBe(true);
  });

  it("partnership BO crossing the 15% threshold → EDD (legalForm override)", () => {
    // 12% would NOT trigger EDD for a company (10% threshold met) but for a
    // partnership the threshold is 15%, so 12% is below - confirm the override
    // path is exercised: at 15% a partnership DOES trigger.
    expect(
      shouldEscalateToEdd({ ...baseInput, highestBoOwnershipPct: 15, legalForm: "partnership" }),
    ).toBe(true);
    expect(
      shouldEscalateToEdd({ ...baseInput, highestBoOwnershipPct: 14, legalForm: "partnership" }),
    ).toBe(false);
  });

  it("PEP status (any non-none) → EDD", () => {
    expect(shouldEscalateToEdd({ ...baseInput, pepStatus: "domestic" })).toBe(true);
    expect(shouldEscalateToEdd({ ...baseInput, pepStatus: "foreign" })).toBe(true);
  });

  it("PEP status 'none' → no EDD from PEP", () => {
    expect(shouldEscalateToEdd({ ...baseInput, pepStatus: "none" })).toBe(false);
  });

  it("sanctions match → EDD", () => {
    expect(shouldEscalateToEdd({ ...baseInput, sanctionsStatus: "match" })).toBe(true);
  });

  it("sanctions pending → EDD (pending match must be dispositioned)", () => {
    expect(shouldEscalateToEdd({ ...baseInput, sanctionsStatus: "pending" })).toBe(true);
  });

  it("sanctions clear → no EDD from sanctions", () => {
    expect(shouldEscalateToEdd({ ...baseInput, sanctionsStatus: "clear" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Screening rule engine (advanced, offline-capable).
// ---------------------------------------------------------------------------

describe("screenSanctions - rule engine", () => {
  it("returns status 'clear' for ordinary names", () => {
    const r = screenSanctions("Some Entity");
    expect(r.status).toBe("clear");
    expect(r.matchScore).toBe(0);
  });

  it("flags deterministic fixture hit as match", () => {
    const r = screenSanctions("Test Sanctions Hit LLC");
    expect(r.status).toBe("match");
    expect(r.matchScore).toBeGreaterThanOrEqual(85);
  });

  it("listsChecked includes the canonical UN/RBI lists", () => {
    const r = screenSanctions("Some Entity");
    expect(r.listsChecked).toContain("UN_1267");
    expect(r.listsChecked).toContain("UN_1373");
    expect(r.listsChecked).toContain("RBI_UAPA");
    expect(r.listsChecked).toContain("OFAC_SDN");
  });

  it("screenedAt is a valid ISO timestamp", () => {
    const r = screenSanctions("Some Entity");
    expect(Number.isFinite(new Date(r.screenedAt).getTime())).toBe(true);
  });
});

describe("screenPep - rule engine", () => {
  it("returns status 'clear' for ordinary names", () => {
    const r = screenPep("Some Person");
    expect(r.status).toBe("clear");
    expect(r.matchScore).toBe(0);
  });

  it("flags deterministic PEP fixture as match", () => {
    const r = screenPep("Test PEP Hit");
    expect(r.status).toBe("match");
    expect(r.matchScore).toBeGreaterThanOrEqual(85);
  });

  it("listsChecked covers domestic, foreign, and associate PEP lists", () => {
    const r = screenPep("Some Person");
    expect(r.listsChecked).toContain("PEP_domestic");
    expect(r.listsChecked).toContain("PEP_foreign");
    expect(r.listsChecked).toContain("PEP_associate");
  });
});

// ---------------------------------------------------------------------------
// STR / CTR policy constants.
// ---------------------------------------------------------------------------

describe("STR / CTR policy constants", () => {
  it("STR filing deadline is 7 working days", () => {
    expect(STR_FILING_DEADLINE_WORKING_DAYS).toBe(7);
  });

  it("CTR monthly threshold is INR 10 lakh (1,000,000)", () => {
    expect(CTR_MONTHLY_THRESHOLD_INR).toBe(1_000_000);
  });
});
