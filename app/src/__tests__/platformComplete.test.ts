import { describe, expect, it } from "vitest";

import {
  croreToInr,
  formatCrorePlain,
  formatInrPlain,
  inrToCrore,
  INR_PER_CRORE,
} from "@/lib/money";
import {
  decryptSecret,
  encryptSecret,
  isEncryptedSecret,
} from "@/lib/crypto-secrets";
import { can } from "@/lib/rbac-core";
import {
  canTransition,
  phaseFromAnalysis,
  resolveCommitteeAdvance,
} from "@/features/credit/committee";
import { sha256Hex } from "@/lib/storage";

describe("money helpers", () => {
  it("converts crore ↔ INR", () => {
    expect(croreToInr(1)).toBe(INR_PER_CRORE);
    expect(inrToCrore(INR_PER_CRORE)).toBe(1);
    expect(formatCrorePlain(12.5)).toContain("12.5");
    expect(formatInrPlain(INR_PER_CRORE, { compact: true })).toContain("Cr");
  });
});

describe("crypto secrets (MFA at rest)", () => {
  it("round-trips encrypt/decrypt", () => {
    const plain = "JBSWY3DPEHPK3PXP";
    const enc = encryptSecret(plain);
    expect(isEncryptedSecret(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("pass-through legacy plaintext", () => {
    const legacy = "JBSWY3DPEHPK3PXP";
    expect(decryptSecret(legacy)).toBe(legacy);
  });
});

describe("rbac can()", () => {
  it("admin bypasses", () => {
    const admin = {
      roles: ["admin"],
      permissions: new Set<string>(),
    };
    expect(can(admin, "run", "integration")).toBe(true);
  });

  it("checks permission set", () => {
    const user = {
      roles: ["coverage_rm"],
      permissions: new Set(["matching:run", "deal:create"]),
    };
    expect(can(user, "run", "matching")).toBe(true);
    expect(can(user, "live", "integration")).toBe(false);
  });
});

describe("credit committee state machine", () => {
  it("maps actions to phases", () => {
    expect(
      phaseFromAnalysis({
        internalRatingAction: "upgrade",
        watchlistFlag: false,
      }),
    ).toBe("approved");
    expect(
      phaseFromAnalysis({
        internalRatingAction: "watch_negative",
        watchlistFlag: true,
      }),
    ).toBe("watch");
  });

  it("allows draft → approved via upgrade", () => {
    const r = resolveCommitteeAdvance({
      currentAction: null,
      currentWatchlist: false,
      currentRecommendation: null,
      nextAction: "upgrade",
      recommendation: "Approve BC-2",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.to).toBe("approved");
      expect(r.watchlistFlag).toBe(false);
    }
  });

  it("canTransition matrix is defined", () => {
    expect(canTransition("draft", "submitted")).toBe(true);
    expect(canTransition("approved", "draft")).toBe(false);
  });
});

describe("storage hash", () => {
  it("sha256Hex is stable", () => {
    const h = sha256Hex(Buffer.from("hello"));
    expect(h).toHaveLength(64);
    expect(h).toBe(sha256Hex(Buffer.from("hello")));
  });
});
