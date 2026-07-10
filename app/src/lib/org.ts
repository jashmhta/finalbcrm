// Binary Capital org model (CEO meeting).
// Brand scope is derived from desk so we need no schema migration.

export type BrandScope = "binarycapital" | "binarybonds" | "shared";

/** Map app_user.desk → brand book. management/compliance = firm-wide (shared). */
export function brandFromDesk(desk: string | null | undefined): BrandScope {
  switch (desk) {
    case "bond_underwriting":
    case "gsec_trading":
    case "secondary_mm":
    case "portfolio_mgmt":
    case "credit":
    case "rating_advisory":
      return "binarybonds";
    case "ib_advisory":
    case "operations":
      return "binarycapital";
    case "management":
    case "compliance":
    default:
      return "shared";
  }
}

export function isSuperAdmin(roles: readonly string[] | undefined): boolean {
  return !!roles?.includes("super_admin");
}

/**
 * Can staff of `staffBrand` own / cover a party with `partyBrand`?
 * - Shared clients: either desk
 * - Firm-wide (shared) staff: any brand
 * - Capital staff: capital + shared only
 * - Bonds staff: bonds + shared only
 */
export function staffCanOwnPartyBrand(
  partyBrand: string | null | undefined,
  staffBrand: BrandScope,
): boolean {
  const pb = (partyBrand ?? "shared") as BrandScope | string;
  if (pb === "shared") return true;
  if (staffBrand === "shared") return true;
  return pb === staffBrand;
}

/**
 * Brand Chinese wall for assignment / coverage handoff.
 * Firm-wide super_admin (Shray) may mix freely.
 * Brand supers and employees may only assign within their brand book
 * and only to staff of the same brand (or shared/management).
 */
export function assertBrandAssignmentAllowed(input: {
  actorBrand: BrandScope;
  actorRoles: readonly string[];
  partyBrand: string | null | undefined;
  assigneeBrand: BrandScope;
}): { ok: true } | { ok: false; reason: string } {
  const firmWideSuper =
    isSuperAdmin(input.actorRoles) && isFirmWide(input.actorBrand);

  if (firmWideSuper) return { ok: true };

  if (!staffCanOwnPartyBrand(input.partyBrand, input.actorBrand)) {
    return {
      ok: false,
      reason:
        "This client belongs to the other brand desk. Capital and Bonds books are segregated.",
    };
  }

  if (!staffCanOwnPartyBrand(input.partyBrand, input.assigneeBrand)) {
    return {
      ok: false,
      reason:
        "Cannot assign a Binary Capital client to Bonds staff (or vice versa).",
    };
  }

  // Non–firm-wide actors cannot pick the other desk's employees.
  if (
    !isFirmWide(input.actorBrand) &&
    input.assigneeBrand !== "shared" &&
    input.assigneeBrand !== input.actorBrand
  ) {
    return {
      ok: false,
      reason:
        "Capital and Bonds staff cannot be mixed. Pick someone on your brand desk.",
    };
  }

  return { ok: true };
}

/** Default brandOrigin when a desk user creates a party. */
export function defaultPartyBrandForUser(brandScope: BrandScope): BrandScope {
  if (brandScope === "binarybonds") return "binarybonds";
  if (brandScope === "binarycapital") return "binarycapital";
  return "shared";
}

export function isAdminish(roles: readonly string[] | undefined): boolean {
  return (
    !!roles?.includes("super_admin") ||
    !!roles?.includes("admin") ||
    !!roles?.includes("director")
  );
}

/** Firm-wide supers (Shray / management desk) see Capital + Bonds. */
export function isFirmWide(brand: BrandScope | null | undefined): boolean {
  return !brand || brand === "shared";
}

/**
 * Party brand filter for brand-scoped supers.
 * shared parties are visible to both Capital and Bonds supers.
 */
export function partyBrandSqlValues(brand: BrandScope): string[] {
  if (brand === "shared") return ["binarycapital", "binarybonds", "shared"];
  return [brand, "shared"];
}

export const ORG_ROSTER = [
  {
    email: "shray@binarycapital.in",
    name: "Shray Vasudeva",
    brand: "shared" as BrandScope,
    level: "super_admin" as const,
  },
  {
    email: "shahrukh@binarycapital.in",
    name: "Shahrukh Sheikh",
    brand: "binarycapital" as BrandScope,
    level: "super_admin" as const,
  },
  {
    email: "rati@binarybonds.in",
    name: "Rati Ravi Kant",
    brand: "binarybonds" as BrandScope,
    level: "super_admin" as const,
  },
  {
    email: "niraj@binarybonds.in",
    name: "Niraj",
    brand: "binarybonds" as BrandScope,
    level: "super_admin" as const,
  },
  {
    email: "yash@binarycapital.in",
    name: "Yash",
    brand: "binarycapital" as BrandScope,
    level: "employee" as const,
  },
  {
    email: "pranjali@binarycapital.in",
    name: "Pranjali",
    brand: "binarycapital" as BrandScope,
    level: "employee" as const,
  },
  {
    email: "tashmit@binarybonds.in",
    name: "Tashmit",
    brand: "binarybonds" as BrandScope,
    level: "employee" as const,
  },
] as const;

/** Credit analysis module: inactive for general staff unless env enables it. */
export function isCreditModuleActive(): boolean {
  const v = process.env.CREDIT_ANALYSIS_ACTIVE;
  if (v === "0" || v === "false" || v === "inactive") return false;
  // Default: active for supers/credit desk only is enforced in nav; module routes still work for authorized roles.
  return v !== "0";
}

export function canAccessCreditModule(roles: readonly string[] | undefined): boolean {
  if (!roles?.length) return false;
  if (isSuperAdmin(roles) || roles.includes("admin")) return true;
  if (roles.includes("credit_analyst") || roles.includes("director")) return true;
  // Default CEO posture: inactive for coverage/bond employees
  if (
    process.env.CREDIT_ANALYSIS_ACTIVE === "true" ||
    process.env.NEXT_PUBLIC_CREDIT_ANALYSIS_ACTIVE === "true"
  ) {
    return true;
  }
  return false;
}
