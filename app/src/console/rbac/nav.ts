// Console navigation builder: brand shell defaults ∩ permissions.
// Pure module — unit-testable, no React.

import type { BrandScope } from "@/lib/org";
import { can, type RbacSubject } from "@/lib/rbac-core";
import { isSuperAdmin } from "@/lib/org";

export type ConsoleBrand = BrandScope; // binarycapital | binarybonds | shared

export type NavIconKey =
  | "home"
  | "parties"
  | "deals"
  | "leads"
  | "matching"
  | "onboarding"
  | "tasks"
  | "interactions"
  | "documents"
  | "calendar"
  | "alerts"
  | "reports"
  | "portfolio"
  | "credit"
  | "modeling"
  | "compliance"
  | "integrations"
  | "ai"
  | "admin"
  | "investors"
  | "clients"
  | "activity";

export interface NavItemDef {
  href: string;
  label: string;
  shortLabel?: string;
  icon: NavIconKey;
  /** permission check: action + resource */
  permission?: { action: string; resource: string };
  /** If true, only super/admin */
  adminOnly?: boolean;
  /** Credit module special gate */
  creditGate?: boolean;
  mobilePrimary?: boolean;
}

const BASE = "/console";

/** Capital default IA (advisory) */
const CAPITAL_ORDER: NavItemDef[] = [
  { href: `${BASE}`, label: "Home", shortLabel: "Home", icon: "home", mobilePrimary: true },
  {
    href: `${BASE}/parties`,
    label: "Client book",
    shortLabel: "Book",
    icon: "parties",
    permission: { action: "read", resource: "party" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/leads`,
    label: "Leads",
    icon: "leads",
    permission: { action: "read", resource: "lead" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/deals`,
    label: "Mandates",
    shortLabel: "Deals",
    icon: "deals",
    permission: { action: "read", resource: "deal" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/tasks`,
    label: "Tasks",
    icon: "tasks",
    permission: { action: "read", resource: "task" },
  },
  {
    href: `${BASE}/matching`,
    label: "Investor match",
    shortLabel: "Match",
    icon: "matching",
    permission: { action: "read", resource: "matching" },
  },
  {
    href: `${BASE}/interactions`,
    label: "Interactions",
    icon: "interactions",
    permission: { action: "read", resource: "interaction" },
  },
  {
    href: `${BASE}/calendar`,
    label: "Calendar",
    icon: "calendar",
  },
  {
    href: `${BASE}/onboarding`,
    label: "Onboarding",
    icon: "onboarding",
    permission: { action: "read", resource: "onboarding" },
  },
  {
    href: `${BASE}/reports`,
    label: "Reports",
    icon: "reports",
    permission: { action: "read", resource: "deal" },
  },
  {
    href: `${BASE}/credit`,
    label: "Credit",
    icon: "credit",
    permission: { action: "read", resource: "credit" },
    creditGate: true,
  },
  {
    href: `${BASE}/modeling`,
    label: "Modeling",
    icon: "modeling",
    permission: { action: "read", resource: "model" },
  },
  {
    href: `${BASE}/documents`,
    label: "Documents",
    icon: "documents",
    permission: { action: "read", resource: "document" },
  },
  {
    href: `${BASE}/notifications`,
    label: "Alerts",
    icon: "alerts",
  },
  {
    href: `${BASE}/activity`,
    label: "Coverage",
    shortLabel: "Cover",
    icon: "activity",
    adminOnly: true,
  },
  {
    href: `${BASE}/assignments`,
    label: "Assignments",
    shortLabel: "Assign",
    icon: "onboarding",
    permission: { action: "read", resource: "party" },
  },
  {
    href: `${BASE}/admin`,
    label: "Admin",
    icon: "admin",
    adminOnly: true,
  },
];

/** Bonds default IA (markets) */
const BONDS_ORDER: NavItemDef[] = [
  { href: `${BASE}`, label: "Home", shortLabel: "Home", icon: "home", mobilePrimary: true },
  {
    href: `${BASE}/matching`,
    label: "Investor match",
    shortLabel: "Match",
    icon: "matching",
    permission: { action: "read", resource: "matching" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/deals`,
    label: "Pipeline",
    shortLabel: "Deals",
    icon: "deals",
    permission: { action: "read", resource: "deal" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/parties`,
    label: "Counterparties",
    shortLabel: "Book",
    icon: "parties",
    permission: { action: "read", resource: "party" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/portfolio`,
    label: "Portfolio",
    icon: "portfolio",
    permission: { action: "read", resource: "portfolio" },
  },
  {
    href: `${BASE}/tasks`,
    label: "Tasks",
    icon: "tasks",
    permission: { action: "read", resource: "task" },
  },
  {
    href: `${BASE}/leads`,
    label: "Leads",
    icon: "leads",
    permission: { action: "read", resource: "lead" },
  },
  {
    href: `${BASE}/credit`,
    label: "Credit",
    icon: "credit",
    permission: { action: "read", resource: "credit" },
    creditGate: true,
  },
  {
    href: `${BASE}/compliance/kyc`,
    label: "KYC queue",
    shortLabel: "KYC",
    icon: "compliance",
    permission: { action: "read", resource: "kyc" },
  },
  {
    href: `${BASE}/onboarding`,
    label: "Onboarding",
    icon: "onboarding",
    permission: { action: "read", resource: "onboarding" },
  },
  {
    href: `${BASE}/interactions`,
    label: "Interactions",
    icon: "interactions",
    permission: { action: "read", resource: "interaction" },
  },
  {
    href: `${BASE}/calendar`,
    label: "Calendar",
    icon: "calendar",
  },
  {
    href: `${BASE}/reports`,
    label: "Reports",
    icon: "reports",
    permission: { action: "read", resource: "deal" },
  },
  {
    href: `${BASE}/notifications`,
    label: "Alerts",
    icon: "alerts",
  },
  {
    href: `${BASE}/activity`,
    label: "Coverage",
    shortLabel: "Cover",
    icon: "activity",
    adminOnly: true,
  },
  {
    href: `${BASE}/assignments`,
    label: "Assignments",
    shortLabel: "Assign",
    icon: "onboarding",
    permission: { action: "read", resource: "party" },
  },
  {
    href: `${BASE}/admin`,
    label: "Admin",
    icon: "admin",
    adminOnly: true,
  },
];

/** Firm-wide super command */
const FIRM_ORDER: NavItemDef[] = [
  { href: `${BASE}`, label: "Command", shortLabel: "Home", icon: "home", mobilePrimary: true },
  {
    href: `${BASE}/parties`,
    label: "All parties",
    shortLabel: "Book",
    icon: "parties",
    permission: { action: "read", resource: "party" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/deals`,
    label: "All mandates",
    shortLabel: "Deals",
    icon: "deals",
    permission: { action: "read", resource: "deal" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/matching`,
    label: "Matching",
    icon: "matching",
    permission: { action: "read", resource: "matching" },
    mobilePrimary: true,
  },
  {
    href: `${BASE}/reports`,
    label: "Reports",
    icon: "reports",
  },
  {
    href: `${BASE}/admin`,
    label: "Admin",
    icon: "admin",
    adminOnly: true,
  },
  {
    href: `${BASE}/activity`,
    label: "Coverage",
    shortLabel: "Cover",
    icon: "activity",
    adminOnly: true,
  },
  {
    href: `${BASE}/assignments`,
    label: "Assignments",
    shortLabel: "Assign",
    icon: "onboarding",
    permission: { action: "read", resource: "party" },
  },
  {
    href: `${BASE}/calendar`,
    label: "Calendar",
    icon: "calendar",
  },
  {
    href: `${BASE}/interactions`,
    label: "Interactions",
    icon: "interactions",
    permission: { action: "read", resource: "interaction" },
  },
  {
    href: `${BASE}/compliance/kyc`,
    label: "Compliance",
    icon: "compliance",
    permission: { action: "read", resource: "kyc" },
  },
  {
    href: `${BASE}/credit`,
    label: "Credit",
    icon: "credit",
    creditGate: true,
  },
  {
    href: `${BASE}/portfolio`,
    label: "Portfolio",
    icon: "portfolio",
  },
  {
    href: `${BASE}/notifications`,
    label: "Alerts",
    icon: "alerts",
  },
  {
    href: `${BASE}/integrations`,
    label: "Integrations",
    icon: "integrations",
    permission: { action: "read", resource: "integration" },
  },
  {
    href: `${BASE}/portal/investor`,
    label: "Investors",
    icon: "investors",
  },
  {
    href: `${BASE}/portal/client`,
    label: "Clients",
    icon: "clients",
  },
];

export function shellCatalog(brand: ConsoleBrand): NavItemDef[] {
  if (brand === "shared") return FIRM_ORDER;
  if (brand === "binarybonds") return BONDS_ORDER;
  return CAPITAL_ORDER;
}

export function resolveConsoleBrand(input: {
  brandScope: BrandScope;
  roles: readonly string[];
  /** Pre-auth / shell brand preference (cookie). Used when user is firm-wide. */
  brandPref?: "binarycapital" | "binarybonds" | null;
}): ConsoleBrand {
  // Explicit desk book always wins.
  if (input.brandScope === "binarycapital") return "binarycapital";
  if (input.brandScope === "binarybonds") return "binarybonds";

  // Firm-wide / super: honor Capital vs Bonds choice for day shell theming + IA.
  if (input.brandScope === "shared" || isSuperAdmin(input.roles)) {
    if (input.brandPref === "binarycapital") return "binarycapital";
    if (input.brandPref === "binarybonds") return "binarybonds";
    return "shared";
  }
  return input.brandScope;
}

function canAccessCredit(user: RbacSubject & { roles?: string[] }): boolean {
  if (isSuperAdmin(user.roles) || user.roles?.includes("admin")) return true;
  if (user.roles?.includes("credit_analyst") || user.roles?.includes("director")) {
    return true;
  }
  if (
    process.env.CREDIT_ANALYSIS_ACTIVE === "true" ||
    process.env.NEXT_PUBLIC_CREDIT_ANALYSIS_ACTIVE === "true"
  ) {
    return can(user, "read", "credit");
  }
  return can(user, "read", "credit") && !!user.roles?.includes("credit_analyst");
}

export function buildConsoleNav(
  user: RbacSubject & {
    roles?: string[];
    brandScope: BrandScope;
    brandPref?: "binarycapital" | "binarybonds" | null;
  },
): NavItemDef[] {
  const brand = resolveConsoleBrand({
    brandScope: user.brandScope,
    roles: user.roles ?? [],
    brandPref: user.brandPref,
  });
  const catalog = shellCatalog(brand);
  const adminish =
    isSuperAdmin(user.roles) ||
    !!user.roles?.includes("admin") ||
    can(user, "manage", "user");

  const filtered = catalog.filter((item) => {
    if (item.adminOnly && !adminish) return false;
    if (item.creditGate && !canAccessCredit(user)) return false;
    if (item.permission) {
      // Matching may only have deal:create in older grants — allow deal:read as soft fallback
      const { action, resource } = item.permission;
      if (can(user, action, resource)) return true;
      if (resource === "matching" && can(user, "read", "deal")) return true;
      if (resource === "lead" && can(user, "read", "party")) return true;
      if (resource === "onboarding" && can(user, "read", "party")) return true;
      if (resource === "portfolio" && can(user, "read", "deal")) return true;
      if (resource === "model" && can(user, "read", "credit")) return true;
      if (resource === "integration" && adminish) return true;
      // Super already passed can(); employees without grant drop out
      if (adminish) return true;
      return false;
    }
    return true;
  });

  // Firm-wide search engine entry for every desk.
  const searchItem: NavItemDef = {
    href: `${BASE}/search`,
    label: "Search",
    shortLabel: "Find",
    icon: "alerts",
  };
  const withSearch = filtered.some((i) => i.href === searchItem.href)
    ? filtered
    : [
        filtered[0]!,
        searchItem,
        ...filtered.slice(1),
      ].filter(Boolean);

  if (isSuperAdmin(user.roles)) {
    const settingsItem: NavItemDef = {
      href: `${BASE}/settings`,
      label: "Settings",
      icon: "admin",
      adminOnly: true,
    };
    if (!withSearch.some((i) => i.href === settingsItem.href)) {
      withSearch.push(settingsItem);
    }
  }

  return withSearch;
}

export function mobilePrimaryNav(items: NavItemDef[]): NavItemDef[] {
  const primary = items.filter((i) => i.mobilePrimary).slice(0, 4);
  if (primary.length >= 4) return primary;
  return items.slice(0, 4);
}

export function brandLabel(brand: ConsoleBrand): string {
  switch (brand) {
    case "binarycapital":
      return "Binary Capital";
    case "binarybonds":
      return "Binary Bonds";
    default:
      return "Binary Firm";
  }
}

export function homeQuestion(brand: ConsoleBrand): string {
  switch (brand) {
    case "binarycapital":
      return "Which mandates need you?";
    case "binarybonds":
      return "Who do we place this paper with?";
    default:
      return "What needs the firm right now?";
  }
}
