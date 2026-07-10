// RBAC helper + server-side current-user loader.
// Brand scope + super-admin export rules from CEO org model (lib/org.ts).

import { cache } from "react";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  appUser,
  permission,
  role,
  rolePermission,
  userRole,
} from "@/db/schema";
import {
  brandFromDesk,
  isFirmWide,
  isSuperAdmin,
  type BrandScope,
} from "@/lib/org";
export { can } from "./rbac-core";

export interface CrmUser {
  id: string;
  email: string;
  name?: string | null;
  appUserId: string | null;
  roles: string[];
  wall: string[];
  permissions: Set<string>;
  /** Desk from app_user (ib_advisory, bond_underwriting, management, …). */
  desk: string | null;
  /** Derived brand book: binarycapital | binarybonds | shared (firm-wide). */
  brandScope: BrandScope;
}

export const getCurrentUser = cache(async (): Promise<CrmUser | null> => {
  const session = await auth();
  const s = session?.user;
  if (!s?.appUserId) return null;

  const permRows = await db
    .select({ code: permission.code })
    .from(userRole)
    .innerJoin(rolePermission, eq(rolePermission.roleId, userRole.roleId))
    .innerJoin(role, eq(role.roleId, userRole.roleId))
    .innerJoin(permission, eq(permission.permissionId, rolePermission.permissionId))
    .where(
      and(
        eq(userRole.userId, s.appUserId),
        isNull(userRole.validTo),
        isNull(userRole.deletedAt),
      ),
    );

  const [profile] = await db
    .select({
      isActive: appUser.isActive,
      desk: appUser.desk,
      email: appUser.email,
    })
    .from(appUser)
    .where(eq(appUser.userId, s.appUserId));
  if (!profile?.isActive) return null;

  const roles = s.roles ?? [];
  const desk = (profile.desk as string | null) ?? null;
  // Prefer JWT desk if present, else DB
  const brandScope =
    (s as { brandScope?: BrandScope }).brandScope ?? brandFromDesk(desk);

  const permissions = new Set(
    permRows.map((r) => r.code).filter((c): c is string => !!c),
  );

  // Implicit grants when role_permission seed is incomplete (production
  // roster: super_admin + coverage_rm + bond_desk). Keeps desks productive
  // without requiring a full permission matrix seed.
  // Platform permission matrix (implicit grants when role_permission seed is thin).
  // resource:action codes match can(user, action, resource).
  if (isSuperAdmin(roles) || roles.includes("admin")) {
    for (const code of [
      "party:read",
      "party:create",
      "party:update",
      "party:assign",
      "party:merge",
      "party:read_all",
      "deal:read",
      "deal:create",
      "deal:update",
      "kyc:read",
      "kyc:approve",
      "kyc:create",
      "reports:export",
      "user:manage",
      "audit:read_all",
      "interaction:read",
      "interaction:create",
      "task:read",
      "task:create",
      "task:update",
      "lead:read",
      "lead:create",
      "lead:update",
      "document:read",
      "document:create",
      "credit:read",
      "credit:create",
      "credit_score:override",
      "model:read",
      "model:create",
      "matching:read",
      "matching:run",
      "integration:read",
      "integration:run",
      "integration:live",
      "onboarding:read",
      "onboarding:update",
      "portfolio:read",
      "consent:read",
      "consent:update",
    ]) {
      permissions.add(code);
    }
  } else if (roles.includes("coverage_rm") || roles.includes("bond_desk")) {
    for (const code of [
      "party:read",
      "party:create",
      "party:update",
      "deal:read",
      "deal:create",
      "deal:update",
      "interaction:read",
      "interaction:create",
      "task:read",
      "task:create",
      "task:update",
      "lead:read",
      "lead:create",
      "lead:update",
      "document:read",
      "document:create",
      "kyc:read",
      "matching:read",
      "matching:run",
      "credit:read",
      "model:read",
      "model:create",
      "integration:read",
      "integration:run",
      "onboarding:read",
      "onboarding:update",
      "portfolio:read",
    ]) {
      permissions.add(code);
    }
  } else if (roles.includes("credit_analyst") || roles.includes("credit")) {
    for (const code of [
      "party:read",
      "deal:read",
      "credit:read",
      "credit:create",
      "credit_score:override",
      "document:read",
      "document:create",
      "model:read",
      "model:create",
      "kyc:read",
      "task:read",
      "task:create",
    ]) {
      permissions.add(code);
    }
  } else if (roles.includes("compliance")) {
    for (const code of [
      "party:read",
      "kyc:read",
      "kyc:approve",
      "kyc:create",
      "consent:read",
      "consent:update",
      "document:read",
      "audit:read_all",
      "integration:read",
      "integration:run",
      "onboarding:read",
      "onboarding:update",
    ]) {
      permissions.add(code);
    }
  }

  return {
    id: s.appUserId,
    email: s.email ?? profile.email ?? "",
    name: s.name ?? null,
    appUserId: s.appUserId,
    roles,
    wall: s.wall ?? [],
    permissions,
    desk,
    brandScope,
  };
});

export async function requireUser(): Promise<CrmUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** True if user can see every party in their brand (or firm-wide). */
export function canReadAllInScope(user: CrmUser | null | undefined): boolean {
  if (!user) return false;
  if (isSuperAdmin(user.roles) || user.roles.includes("admin")) return true;
  return user.permissions.has("party:read_all") || user.permissions.has("user:manage");
}

export function isFirmWideUser(user: CrmUser | null | undefined): boolean {
  if (!user) return false;
  return isFirmWide(user.brandScope) && canReadAllInScope(user);
}
