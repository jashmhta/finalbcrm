// Auth.js v5 identity tables (users / accounts / sessions / verificationTokens
// / authenticators) - the standard @auth/drizzle-adapter shape.
//
// LINKAGE DESIGN (app_user ↔ users): the 1:1 link is `users.app_user_id` →
// `app_user.user_id`. The column is declared here as a plain `uuid` (NOT via
// Drizzle `references()`) and the FK constraint is added via raw SQL in a
// migration - see the MIGRATION NOTE below. Reason: `app_user` participates in
// a mutual FK cycle with `contact` (contact.created_by_user_id → app_user and
// app_user.contact_id → contact) that sits right at TS's circular
// type-inference recursion limit. Having `auth.ts` import `appUser` (even
// one-directionally) to express `references(() => appUser.userId)` changed the
// module evaluation order enough to trip error 7022 on `contact`. Keeping
// `auth.ts` free of any `rbac.ts` import avoids touching that fragile cycle.
// The 1:1 link is still a real DB-level FK; it just isn't declared in Drizzle.
//
// `users` is the Auth.js identity (id / name / email / emailVerified / image);
// `app_user` is the CRM profile (desk / barrier_clearance / employee_party_id /
// contact_id / mfa_enrolled_at). The credentials provider looks up `app_user`
// by email and stamps `app_user.user_id` onto the JWT (see @/lib/auth).
//
// PRODUCTION TARGET (ARCHITECTURE §4.7): DB-stored sessions + in-region Redis
// (ElastiCache ap-south-1) mirroring the `sessions` table for Edge reads, so
// sessions are revocable. This initial build uses the JWT session strategy
// (simpler, no Redis); the adapter + `sessions` table are still wired so the
// cutover is a config flip, not a re-architecture.
//
// Reference: node_modules/@auth/drizzle-adapter/src/lib/pg.ts (defineTables).

import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// users - Auth.js identity (§4.7). `id` is text (Auth.js default) so external
// IdP subject identifiers can be stored verbatim. `appUserId` is the optional
// 1:1 link to the CRM profile (app_user.user_id) - declared as a plain column
// (see linkage note above). Extra columns beyond the adapter's expected
// {id,name,email,emailVerified,image} are fine: the adapter only queries the
// columns it knows about.
//
// MIGRATION NOTE: add the FK in a migration (Drizzle can't express it here
// without re-introducing the rbac↔contact type-cycle):
//   ALTER TABLE users
//     ADD CONSTRAINT users_app_user_id_app_user_user_id_fk
//     FOREIGN KEY (app_user_id) REFERENCES app_user(user_id)
//     ON DELETE SET NULL;
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  // 1:1 link to the CRM profile (app_user.user_id). Nullable: a users row may
  // exist before the app_user row is provisioned (e.g. OAuth sign-in before
  // CRM profile creation). FK added via migration - see file header.
  appUserId: uuid("app_user_id"),
});

// ---------------------------------------------------------------------------
// accounts - OAuth/credential provider linkage. Composite PK (provider,
// providerAccountId). Snake_case JS props (refresh_token, access_token, …)
// are kept as-is because the adapter references them by those exact names.
// ---------------------------------------------------------------------------

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    providerPk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
);

// ---------------------------------------------------------------------------
// sessions - DB session store (production target). Unused while JWT strategy
// is active, but wired so the strategy flip is a one-line change.
// ---------------------------------------------------------------------------

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ---------------------------------------------------------------------------
// verificationTokens - email magic-link / verification flow.
// ---------------------------------------------------------------------------

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => ({
    identifierTokenPk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
);

// ---------------------------------------------------------------------------
// authenticators - WebAuthn passkeys (optional, for director role per §4.7).
// Included for adapter completeness; not exercised by the credentials stub.
// ---------------------------------------------------------------------------

export const authenticators = pgTable(
  "authenticators",
  {
    credentialID: text("credential_id").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("provider_account_id").notNull(),
    credentialPublicKey: text("credential_public_key").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credential_device_type").notNull(),
    credentialBackedUp: boolean("credential_backed_up").notNull(),
    transports: text("transports"),
  },
  (t) => ({
    userCredentialPk: primaryKey({ columns: [t.userId, t.credentialID] }),
  }),
);

export type AuthUser = typeof users.$inferSelect;
export type AuthUserInsert = typeof users.$inferInsert;
export type AuthAccount = typeof accounts.$inferSelect;
export type AuthAccountInsert = typeof accounts.$inferInsert;
export type AuthSession = typeof sessions.$inferSelect;
export type AuthSessionInsert = typeof sessions.$inferInsert;
export type AuthVerificationToken = typeof verificationTokens.$inferSelect;
export type AuthVerificationTokenInsert = typeof verificationTokens.$inferInsert;
export type Authenticator = typeof authenticators.$inferSelect;
export type AuthenticatorInsert = typeof authenticators.$inferInsert;
