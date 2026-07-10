"use server";

// Admin Panel - server actions (mutations on app_user / role / role_permission).
//
// ARCHITECTURE §3 mutation boundary per action: authenticate (requireUser),
// authorize (can → user:manage), validate (zod), mutate, write an audit_log
// row, revalidate. app_user / role / role_permission / user_role are NOT under
// RLS (management tables), so the mutations run on the shared `db` client
// inside a plain `db.transaction` - no withRls context. The audit_log insert
// rides the same transaction so the audit row commits atomically with the
// mutation (the hash-chain trigger populates prev_hash / row_hash).
//
// PASSWORDS: createUser + updateUser accept a plaintext password when supplied
// and store a bcrypt hash (bcryptjs, cost 10) on app_user.password_hash - the
// same scheme as seed-admin.ts and the credentials provider in @/lib/auth. An
// empty/omitted password on updateUser leaves the hash untouched. The plaintext
// is never logged, never written to audit_log (only the boolean "password_set"
// is recorded), and never returned to the client.
//
// AUTH LINKAGE: the credentials provider in @/lib/auth looks up app_user by
// email and uses app_user.user_id as the Auth.js subject - it does NOT require
// a `users` or `accounts` row (see the authorize comment in auth.ts). So
// createUser only inserts an app_user row + role grants; no auth-table inserts
// are needed for the new user to sign in.

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod/v4";

import { can, requireUser } from "@/lib/rbac";
import { db } from "@/db";
import {
  appUser,
  auditLog,
  permission,
  role,
  rolePermission,
  userRole,
} from "@/db/schema";
import { parseUpdateUserFormFields } from "./update-user-form";
// ---------------------------------------------------------------------------
// Permission guard - admin mutations all require user:manage.
// ---------------------------------------------------------------------------

function requireManage(
  user: Awaited<ReturnType<typeof requireUser>>,
): { ok: true } | { ok: false; error: string } {
  if (!can(user, "manage", "user")) {
    return {
      ok: false,
      error: "You do not have permission to manage users and roles.",
    };
  }
  return { ok: true };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Append an audit_log row inside the caller's transaction. */
async function appendAudit(
  tx: Tx,
  input: {
    entityType: string;
    entityId?: string;
    operation: string;
    fieldName?: string;
    oldValue?: unknown;
    newValue?: unknown;
    actorUserId: string | null;
    actorRoleAtTime?: string;
    correlationId?: string;
  },
): Promise<void> {
  await tx.insert(auditLog).values({
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    operation: input.operation as (typeof auditLog.$inferSelect)["operation"],
    fieldName: input.fieldName ?? null,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    actorUserId: input.actorUserId,
    actorRoleAtTime: input.actorRoleAtTime ?? null,
    correlationId: input.correlationId ?? null,
  });
}

// ---------------------------------------------------------------------------
// Shared enum list (kept in sync with src/db/schema/enums.ts deskEnum).
// ---------------------------------------------------------------------------

const DESKS = [
  "ib_advisory",
  "bond_underwriting",
  "gsec_trading",
  "secondary_mm",
  "portfolio_mgmt",
  "credit",
  "rating_advisory",
  "operations",
  "compliance",
  "management",
] as const;

// ---------------------------------------------------------------------------
// createUser
// ---------------------------------------------------------------------------

const createUserSchema = z.object({
  email: z.email("A valid email is required."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password is too long."),
  desk: z.enum(DESKS, "Select a desk."),
  isActive: z.enum(["true", "false"]).default("true"),
  barrierClearance: z.array(z.string()).optional(),
  roleNames: z.array(z.string().min(1)).optional(),
});

export type CreateUserState = { error?: string; userId?: string } | undefined;

/**
 * Create an app_user with a bcrypt-hashed password, optional barrier clearance
 * tags, and a set of role grants. The new user can sign in immediately via
 * the credentials provider (it reads app_user by email + password_hash). Role
 * grants are validated against the live `role` table (unknown names rejected).
 */
export async function createUser(
  _prev: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const user = await requireUser();
  const guard = requireManage(user);
  if (!guard.ok) return { error: guard.error };

  // roleNames + barrierClearance arrive as repeated form fields.
  const roleNames = formData
    .getAll("roleNames")
    .map((v) => String(v))
    .filter(Boolean);
  const barrierClearance = formData
    .getAll("barrierClearance")
    .map((v) => String(v))
    .filter(Boolean);

  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    desk: formData.get("desk"),
    isActive: formData.get("isActive") ?? "true",
    barrierClearance,
    roleNames,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  // De-duplicate + validate role names against the live role table.
  const uniqueRoleNames = Array.from(new Set(input.roleNames));
  let roleIds: { roleId: string; name: string }[] = [];
  if (uniqueRoleNames.length > 0) {
    roleIds = await db
      .select({ roleId: role.roleId, name: role.name })
      .from(role)
      .where(and(isNull(role.deletedAt), inArray(role.name, uniqueRoleNames)));
    if (roleIds.length !== uniqueRoleNames.length) {
      const found = new Set(roleIds.map((r) => r.name));
      const missing = uniqueRoleNames.filter((n) => !found.has(n));
      return { error: `Unknown role(s): ${missing.join(", ")}` };
    }
  }

  // Uniqueness check - citext email, case-insensitive.
  const [existing] = await db
    .select({ userId: appUser.userId })
    .from(appUser)
    .where(and(eq(appUser.email, input.email), isNull(appUser.deletedAt)));
  if (existing) {
    return { error: "A user with that email already exists." };
  }

  const passwordHash = bcrypt.hashSync(input.password, 10);
  const isActive = input.isActive === "true";

  const userId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(appUser)
      .values({
        email: input.email,
        isActive,
        desk: input.desk,
        barrierClearance: input.barrierClearance ?? [],
        passwordHash,
        mfaEnabled: false,
        failedLoginCount: 0,
      })
      .returning({ userId: appUser.userId });
    if (!created) throw new Error("app_user insert returned no row");

    // Role grants (time-bounded, valid_to null = current).
    if (roleIds.length > 0) {
      await tx.insert(userRole).values(
        roleIds.map((r) => ({
          userId: created.userId,
          roleId: r.roleId,
          validFrom: new Date(),
          assignedByUserId: user.appUserId,
        })),
      );
    }

    await appendAudit(tx, {
      entityType: "app_user",
      entityId: created.userId,
      operation: "insert",
      newValue: {
        email: input.email,
        desk: input.desk,
        isActive,
        barrierClearance: input.barrierClearance ?? [],
        roles: roleIds.map((r) => r.name),
        passwordSet: true,
      },
      actorUserId: user.appUserId,
      actorRoleAtTime: user.roles[0] ?? null,
    });
    return created.userId;
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/console/admin");
  revalidatePath("/console");
  revalidatePath("/console/admin");
  revalidatePath("/console");
  return { userId };
}

// ---------------------------------------------------------------------------
// updateUser - change desk, barrier clearance, active, password, and/or roles.
// ---------------------------------------------------------------------------

const updateUserSchema = z.object({
  userId: z.uuid("A valid user id is required."),
  desk: z.enum(DESKS, "Select a desk.").optional(),
  isActive: z.enum(["true", "false"]).optional(),
  barrierClearance: z.array(z.string()).optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password is too long.")
    .optional()
    .or(z.literal("")),
  roleNames: z.array(z.string().min(1)).optional(),
});

export type UpdateUserState = { error?: string; ok?: boolean } | undefined;

/**
 * Update an app_user's desk / active / barrier clearance / password, and
 * optionally sync role grants when `rolesSync` is present on the form.
 * Password-only forms omit role/barrier keys so RBAC is left intact.
 * Self-deactivation is refused.
 */
export async function updateUser(
  _prev: UpdateUserState,
  formData: FormData,
): Promise<UpdateUserState> {
  const user = await requireUser();
  const guard = requireManage(user);
  if (!guard.ok) return { error: guard.error };

  const fields = parseUpdateUserFormFields(formData);

  const parsed = updateUserSchema.safeParse({
    userId: fields.userId,
    desk: fields.desk,
    isActive: fields.isActive,
    barrierClearance: fields.barrierClearance,
    password: fields.password,
    roleNames: fields.roleNames,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const [target] = await db
    .select({
      userId: appUser.userId,
      email: appUser.email,
      isActive: appUser.isActive,
      desk: appUser.desk,
      barrierClearance: appUser.barrierClearance,
    })
    .from(appUser)
    .where(and(eq(appUser.userId, input.userId), isNull(appUser.deletedAt)));
  if (!target) return { error: "User not found." };

  // Refuse self-deactivation.
  if (input.isActive === "false" && input.userId === user.appUserId) {
    return { error: "You cannot deactivate your own account through this surface." };
  }

  // Validate role names only when syncing roles.
  const uniqueRoleNames =
    input.roleNames !== undefined
      ? Array.from(new Set(input.roleNames))
      : [];
  let roleIds: { roleId: string; name: string }[] = [];
  if (input.roleNames !== undefined && uniqueRoleNames.length > 0) {
    roleIds = await db
      .select({ roleId: role.roleId, name: role.name })
      .from(role)
      .where(and(isNull(role.deletedAt), inArray(role.name, uniqueRoleNames)));
    if (roleIds.length !== uniqueRoleNames.length) {
      const found = new Set(roleIds.map((r) => r.name));
      const missing = uniqueRoleNames.filter((n) => !found.has(n));
      return { error: `Unknown role(s): ${missing.join(", ")}` };
    }
  }

  const updates: Partial<typeof appUser.$inferInsert> = { updatedAt: new Date() };
  if (input.desk) updates.desk = input.desk;
  if (input.isActive) updates.isActive = input.isActive === "true";
  if (input.barrierClearance !== undefined)
    updates.barrierClearance = input.barrierClearance;
  const passwordSet = !!input.password;
  if (passwordSet && input.password) {
    updates.passwordHash = bcrypt.hashSync(input.password, 10);
  }

  await db.transaction(async (tx) => {
    await tx.update(appUser).set(updates).where(eq(appUser.userId, input.userId));

    // Sync role grants only when rolesSync was present (input.roleNames defined).
    // Empty array = revoke all current grants intentionally.
    if (input.roleNames !== undefined) {
      await tx
        .update(userRole)
        .set({ validTo: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(userRole.userId, input.userId),
            isNull(userRole.validTo),
            isNull(userRole.deletedAt),
          ),
        );
      if (roleIds.length > 0) {
        await tx.insert(userRole).values(
          roleIds.map((r) => ({
            userId: input.userId,
            roleId: r.roleId,
            validFrom: new Date(),
            assignedByUserId: user.appUserId,
          })),
        );
      }
    }

    await appendAudit(tx, {
      entityType: "app_user",
      entityId: input.userId,
      operation: "update",
      newValue: {
        desk: input.desk ?? target.desk,
        isActive: input.isActive ? input.isActive === "true" : target.isActive,
        barrierClearance: input.barrierClearance ?? target.barrierClearance,
        ...(input.roleNames !== undefined
          ? { roles: roleIds.map((r) => r.name) }
          : {}),
        passwordSet,
      },
      oldValue: {
        desk: target.desk,
        isActive: target.isActive,
        barrierClearance: target.barrierClearance,
      },
      actorUserId: user.appUserId,
      actorRoleAtTime: user.roles[0] ?? null,
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/console/admin");
  revalidatePath("/console");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// deactivateUser - set is_active = false (NOT a soft-delete; the row stays
// queryable for audit). Reversible by updateUser(isActive=true).
// ---------------------------------------------------------------------------

const deactivateUserSchema = z.object({ userId: z.uuid() });

export type DeactivateUserState = { error?: string; ok?: boolean } | undefined;

export async function deactivateUser(
  _prev: DeactivateUserState,
  formData: FormData,
): Promise<DeactivateUserState> {
  const user = await requireUser();
  const guard = requireManage(user);
  if (!guard.ok) return { error: guard.error };

  const parsed = deactivateUserSchema.safeParse({
    userId: formData.get("userId"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;

  if (input.userId === user.appUserId) {
    return { error: "You cannot deactivate your own account." };
  }

  const [target] = await db
    .select({
      userId: appUser.userId,
      isActive: appUser.isActive,
      email: appUser.email,
    })
    .from(appUser)
    .where(and(eq(appUser.userId, input.userId), isNull(appUser.deletedAt)));
  if (!target) return { error: "User not found." };
  if (!target.isActive) return { error: "User is already deactivated." };

  await db.transaction(async (tx) => {
    await tx
      .update(appUser)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(appUser.userId, input.userId));
    // End any current role grants too - a deactivated user holds no active
    // role (getCurrentUser already rejects inactive profiles, but closing the
    // grants keeps the role→user-count read honest).
    await tx
      .update(userRole)
      .set({ validTo: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(userRole.userId, input.userId),
          isNull(userRole.validTo),
          isNull(userRole.deletedAt),
        ),
      );
    await appendAudit(tx, {
      entityType: "app_user",
      entityId: input.userId,
      operation: "update",
      fieldName: "is_active",
      oldValue: { isActive: true, email: target.email },
      newValue: { isActive: false, email: target.email },
      actorUserId: user.appUserId,
      actorRoleAtTime: user.roles[0] ?? null,
    });
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  revalidatePath("/console/admin");
  revalidatePath("/console");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// updateRolePermissions - sync a role's permission set to the submitted codes.
// ---------------------------------------------------------------------------

const updateRolePermissionsSchema = z.object({
  roleId: z.uuid(),
  permissionCodes: z.array(z.string().min(1)).optional(),
});

export type UpdateRolePermissionsState = {
  error?: string;
  ok?: boolean;
} | undefined;

/**
 * Replace a role's permission grants with the submitted set. Existing grants
 * not in the new set are deleted (role_permission has a composite PK + ON
 * DELETE CASCADE); new grants are inserted. The `admin` role is protected -
 * editing its permissions is refused (an admin locking themselves out of
 * user:manage would brick the panel).
 */
export async function updateRolePermissions(
  _prev: UpdateRolePermissionsState,
  formData: FormData,
): Promise<UpdateRolePermissionsState> {
  const user = await requireUser();
  const guard = requireManage(user);
  if (!guard.ok) return { error: guard.error };

  const permissionCodes = formData
    .getAll("permissionCodes")
    .map((v) => String(v))
    .filter(Boolean);

  const parsed = updateRolePermissionsSchema.safeParse({
    roleId: formData.get("roleId"),
    permissionCodes,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const [target] = await db
    .select({ roleId: role.roleId, name: role.name })
    .from(role)
    .where(and(eq(role.roleId, input.roleId), isNull(role.deletedAt)));
  if (!target) return { error: "Role not found." };
  if (target.name === "admin") {
    return {
      error: "The admin role's permissions are protected and cannot be edited.",
    };
  }

  // Resolve submitted codes → permission ids.
  const uniqueCodes = Array.from(new Set(input.permissionCodes));
  let permIds: { permissionId: string; code: string }[] = [];
  if (uniqueCodes.length > 0) {
    permIds = await db
      .select({ permissionId: permission.permissionId, code: permission.code })
      .from(permission)
      .where(
        and(isNull(permission.deletedAt), inArray(permission.code, uniqueCodes)),
      );
    if (permIds.length !== uniqueCodes.length) {
      const found = new Set(permIds.map((p) => p.code));
      const missing = uniqueCodes.filter((c) => !found.has(c));
      return { error: `Unknown permission code(s): ${missing.join(", ")}` };
    }
  }

  // Existing grants (for the audit diff).
  const existing = await db
    .select({ permissionId: permission.permissionId, code: permission.code })
    .from(rolePermission)
    .innerJoin(permission, eq(permission.permissionId, rolePermission.permissionId))
    .where(eq(rolePermission.roleId, input.roleId));
  const existingCodes = new Set(existing.map((e) => e.code));
  const newCodes = new Set(permIds.map((p) => p.code));
  const added = Array.from(newCodes).filter((c) => !existingCodes.has(c));
  const removed = Array.from(existingCodes).filter((c) => !newCodes.has(c));

  await db.transaction(async (tx) => {
    // Replace: delete all current grants, insert the new set. (Cleaner than
    // diffing inserts/deletes - role_permission is a pure join table.)
    await tx.delete(rolePermission).where(eq(rolePermission.roleId, input.roleId));
    if (permIds.length > 0) {
      await tx.insert(rolePermission).values(
        permIds.map((p) => ({
          roleId: input.roleId,
          permissionId: p.permissionId,
        })),
      );
    }
    await appendAudit(tx, {
      entityType: "role_permission",
      entityId: input.roleId,
      operation: "update",
      fieldName: target.name,
      oldValue: { permissions: Array.from(existingCodes).sort() },
      newValue: {
        permissions: Array.from(newCodes).sort(),
        added,
        removed,
      },
      actorUserId: user.appUserId,
      actorRoleAtTime: user.roles[0] ?? null,
    });
  });

  revalidatePath("/admin/roles");
  revalidatePath("/admin");
  revalidatePath("/console/admin");
  revalidatePath("/console");
  return { ok: true };
}
