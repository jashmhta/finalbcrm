// RBAC - app_user, role, permission, role_permission, user_role.
// DATA_MODEL §2.8, §2.23.12. ARCHITECTURE §4.2: RBAC baseline + ABAC attributes
// (wall/compartment, mandate_id, client_id). Time-bounded roles matter because
// secondees and temps rotate through the credit desk.

import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

import { citext, deskEnum } from "./enums";

// Forward declarations - real value imports (NOT `import type`) because the
// `references()` lambdas below resolve the table binding at runtime. Circular
// imports are safe here: the lambdas are evaluated lazily after all modules
// have finished loading, and ES module live bindings reflect the final value.
import { party as partyTable } from "./party";
import { contact as contactTable } from "./contact";

// ---------------------------------------------------------------------------
// app_user - the firm's staff (and portal users) modeled as a user record.
// The firm's own staff are also modeled as a `party` (internal_staff type) so
// that "exposure to a related party" can capture firm-as-counterparty flows.
// ---------------------------------------------------------------------------

export const appUser = pgTable(
  "app_user",
  {
    userId: uuid("user_id").defaultRandom().primaryKey(),
    // The firm's own staff modeled as a party (§2.8). Nullable for portal-only
    // users (e.g. ifa_portal) who are not staff parties.
    //
    // NOTE: `employeePartyId` and `contactId` are declared as plain uuid columns
    // (NOT via `references()`) to break the mutual-FK type-inference cycle
    // (app_user↔party, app_user↔contact) that otherwise produces TS error 7022
    // on `contact`/`party` once the schema is imported by the app. The DB-level
    // FK constraints are added via raw SQL in a migration - see MIGRATION NOTE
    // at the bottom of this file. The columns are fully queryable either way.
    employeePartyId: uuid("employee_party_id"),
    contactId: uuid("contact_id"),
    email: citext("email").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    desk: deskEnum("desk"),
    // ABAC: array of barrier tags this user can see (RLS consults this via
    // current_setting('app.wall') set per-transaction - see ARCHITECTURE §4.4).
    barrierClearance: text("barrier_clearance").array(),
    lastLoginAt: timestamp("last_login_at", {
      withTimezone: true,
      mode: "date",
    }),
    mfaEnrolledAt: timestamp("mfa_enrolled_at", {
      withTimezone: true,
      mode: "date",
    }),
    // ----- Credentials auth columns (Track B / AUTH, migration 0002_auth) -----
    // bcrypt hash of the user's password (bcryptjs, ~60 chars). Nullable so
    // portal/SSO-only users (no password login) are supported; `authorize`
    // rejects a NULL hash as "no password login for this user".
    passwordHash: text("password_hash"),
    // TOTP secret for MFA (otpauth). Stored as text - PRODUCTION should encrypt
    // this at rest (e.g. pgcrypto or app-layer AES-GCM with a KMS-wrapped key)
    // because a leaked secret breaks the second factor. See ARCHITECTURE §4.7.
    // Nullable; NULL when mfa_enabled = false.
    mfaSecret: text("mfa_secret"),
    // Whether TOTP MFA is required at login for this user. When false,
    // `authorize` skips the TOTP step entirely (password-only login).
    mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
    // Account-lockout fields. `authorize` enforces: if `locked_until` is in the
    // future, login is rejected; on a wrong password `failed_login_count` is
    // incremented and, on hitting LOCKOUT_THRESHOLD, `locked_until` is set.
    failedLoginCount: integer("failed_login_count").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
    // Standard audit columns.
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    emailUnique: uniqueIndex("app_user_email_uidx")
      .on(table.email)
      .where(sql`deleted_at IS NULL`),
    activeIdx: index("app_user_active_idx")
      .on(table.isActive, table.desk)
      .where(sql`deleted_at IS NULL`),
  }),
);

// ---------------------------------------------------------------------------
// role
// ---------------------------------------------------------------------------

export const role = pgTable(
  "role",
  {
    roleId: uuid("role_id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    desk: deskEnum("desk"),
    description: text("description"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    nameUnique: uniqueIndex("role_name_uidx")
      .on(table.name)
      .where(sql`deleted_at IS NULL`),
  }),
);

// ---------------------------------------------------------------------------
// permission - resource-action pair codes, e.g. deal:create, kyc:approve.
// ---------------------------------------------------------------------------

export const permission = pgTable(
  "permission",
  {
    permissionId: uuid("permission_id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    codeUnique: uniqueIndex("permission_code_uidx")
      .on(table.code)
      .where(sql`deleted_at IS NULL`),
  }),
);

// ---------------------------------------------------------------------------
// role_permission - many-to-many grant.
// ---------------------------------------------------------------------------

export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.roleId, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permission.permissionId, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  }),
);

// ---------------------------------------------------------------------------
// user_role - time-bounded role grants. Secondees/temps rotate; valid_to
// null = current. Exclusion constraint (gist, tstzrange) prevents overlapping
// grants - added via raw SQL in a migration (Drizzle can't declare exclusion
// constraints); see comment below.
// ---------------------------------------------------------------------------

export const userRole = pgTable(
  "user_role",
  {
    userRoleId: uuid("user_role_id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.userId, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => role.roleId, { onDelete: "cascade" }),
    validFrom: timestamp("valid_from", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true, mode: "date" }),
    assignedByUserId: uuid("assigned_by_user_id").references(
      () => appUser.userId,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    }).defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => ({
    // At most one current grant per (user, role).
    currentGrantUnique: uniqueIndex("user_role_current_uidx")
      .on(table.userId, table.roleId)
      .where(sql`valid_to IS NULL AND deleted_at IS NULL`),
    userIdx: index("user_role_user_idx").on(table.userId),
    roleIdx: index("user_role_role_idx").on(table.roleId),
    // MIGRATION NOTE: add the exclusion constraint via raw SQL in a migration:
    //   CREATE EXTENSION IF NOT EXISTS btree_gist;
    //   ALTER TABLE user_role
    //     ADD CONSTRAINT user_role_no_overlap EXCLUDE USING gist
    //     (user_id WITH =, role_id WITH =, tstzrange(valid_from, valid_to) WITH &&);
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const appUserRelations = relations(appUser, ({ one, many }) => ({
  employeeParty: one(partyTable, {
    fields: [appUser.employeePartyId],
    references: [partyTable.partyId],
  }),
  contact: one(contactTable, {
    fields: [appUser.contactId],
    references: [contactTable.contactId],
  }),
  roles: many(userRole),
}));

export const roleRelations = relations(role, ({ many }) => ({
  permissions: many(rolePermission),
  userRoles: many(userRole),
}));

export const permissionRelations = relations(permission, ({ many }) => ({
  roles: many(rolePermission),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(role, {
    fields: [rolePermission.roleId],
    references: [role.roleId],
  }),
  permission: one(permission, {
    fields: [rolePermission.permissionId],
    references: [permission.permissionId],
  }),
}));

export const userRoleRelations = relations(userRole, ({ one }) => ({
  user: one(appUser, {
    fields: [userRole.userId],
    references: [appUser.userId],
  }),
  role: one(role, {
    fields: [userRole.roleId],
    references: [role.roleId],
  }),
  assignedBy: one(appUser, {
    fields: [userRole.assignedByUserId],
    references: [appUser.userId],
    relationName: "userRoleAssignedBy",
  }),
}));

export type AppUser = typeof appUser.$inferSelect;
export type AppUserInsert = typeof appUser.$inferInsert;
export type Role = typeof role.$inferSelect;
export type RoleInsert = typeof role.$inferInsert;
export type Permission = typeof permission.$inferSelect;
export type PermissionInsert = typeof permission.$inferInsert;
export type UserRole = typeof userRole.$inferSelect;
export type UserRoleInsert = typeof userRole.$inferInsert;

// MIGRATION NOTE: the DB-level FK constraints for app_user.employee_party_id
// and app_user.contact_id are declared here as raw SQL because the Drizzle
// `references()` lambdas were removed to break the app_user↔party /
// app_user↔contact mutual-FK type-inference cycle (see the comment on
// `employeePartyId` above). Add these in a migration:
//
//   ALTER TABLE app_user
//     ADD CONSTRAINT app_user_employee_party_id_party_party_id_fk
//     FOREIGN KEY (employee_party_id) REFERENCES party(party_id)
//     ON DELETE SET NULL;
//   ALTER TABLE app_user
//     ADD CONSTRAINT app_user_contact_id_contact_contact_id_fk
//     FOREIGN KEY (contact_id) REFERENCES contact(contact_id)
//     ON DELETE SET NULL;
//
// The Drizzle `relations()` below (appUserRelations.employeeParty / .contact)
// still describe the joins for the relational query API - they are independent
// of the DB FK constraint.
