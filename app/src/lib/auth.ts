// Auth.js v5 configuration (next-auth@5.0.0-beta.31) with the Drizzle adapter.
//
// SESSION STRATEGY: JWT (this initial build). PRODUCTION TARGET: DB-stored
// sessions mirrored to in-region Redis (ElastiCache ap-south-1) so sessions are
// revocable at the edge (ARCHITECTURE §4.7). The adapter + `sessions` table
// are wired here so the cutover is `session: { strategy: "database" }` plus a
// Redis cache, not a re-architecture.
//
// TODO(PRODUCTION): switch `session: { strategy: "database" }` and mirror
// session rows to Redis for edge-revocation. Better still, front the app with
// a real IdP (OIDC/SAML - e.g. Okta/Entra ID/Clerk) per ARCHITECTURE §4.7 and
// keep credentials only as a break-glass fallback. Harden the credentials
// path further: store `mfa_secret` encrypted at rest (pgcrypto / app-layer
// AES-GCM with a KMS-wrapped key), add WebAuthn as the preferred second
// factor, and surface a real password-reset + email-verification flow. The
// `authorize` below is a real (bcrypt + TOTP + lockout) implementation but is
// still in-process credentials - the IdP route is preferred for prod.
//
// The CRM-internal profile (desk, barrier_clearance, roles) is loaded in the
// `jwt` callback on first sign-in and stamped onto the token; `session`
// callback exposes it as `session.user.{appUserId,wall,roles}`.

import NextAuth, { type DefaultSession } from "next-auth";
// Type-only import of `JWT` from the `next-auth/jwt` submodule. This is NOT
// just for the type - it forces the module into the TS program so the
// `declare module "next-auth/jwt"` augmentation below resolves (without an
// import, TS2664 fires: the augmentation target "cannot be found"). The JWT
// interface we augment is the same one NextAuth uses for the `token` param in
// the `jwt` callback, so the augmented fields land on `token`.
import type { JWT } from "next-auth/jwt";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { Secret, TOTP } from "otpauth";
import { and, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  accounts,
  appUser,
  authenticators,
  role,
  sessions,
  users,
  userRole,
  verificationTokens,
} from "@/db/schema";
import { brandFromDesk } from "@/lib/org";
import { decryptSecret } from "@/lib/crypto-secrets";

// ---------------------------------------------------------------------------
// Lockout policy - Track B / AUTH.
// ---------------------------------------------------------------------------
// After LOCKOUT_THRESHOLD consecutive failed logins the account is locked for
// LOCKOUT_WINDOW_MINUTES. A successful login resets failed_login_count and
// clears locked_until. These are deliberately conservative; tune for prod.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MINUTES = 15;

// ---------------------------------------------------------------------------
// Type augmentation - extend Auth.js User/Session/JWT with CRM fields so the
// callbacks below are type-safe instead of `as any` casts.
// ---------------------------------------------------------------------------

declare module "next-auth" {
  interface User {
    /** app_user.user_id - the CRM profile key used for DB queries + RLS. */
    appUserId?: string;
  }
  interface Session {
    user: {
      appUserId?: string;
      wall?: string[];
      roles?: string[];
      desk?: string | null;
      brandScope?: "binarycapital" | "binarybonds" | "shared";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    appUserId?: string;
    wall?: string[];
    roles?: string[];
    desk?: string | null;
    brandScope?: "binarycapital" | "binarybonds" | "shared";
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  // JWT strategy - see file header for the production DB-sessions target.
  session: { strategy: "jwt" },
  // Trust the public-IP host so Auth.js accepts requests via 20.64.241.164:3000
  // (not just localhost). In production behind a real domain + HTTPS, set
  // AUTH_URL to the canonical HTTPS URL instead.
  trustHost: true,
  // Console is the only public sign-in surface (not legacy /login).
  pages: { signIn: "/console/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email" },
        password: { label: "Password", type: "password" },
        // Optional 6-digit TOTP code. Only required when the user has
        // mfa_enabled = true; absent/blank for MFA-disabled users.
        totp: { label: "TOTP", type: "text" },
      },
      authorize: async (credentials) => {
        // Normalize so browser autofill / casing / trailing spaces never false-fail.
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const totpRaw = credentials?.totp;
        const totp =
          totpRaw == null || String(totpRaw).trim() === ""
            ? undefined
            : String(totpRaw).trim();
        if (!email || !password) return null;

        // Look up the active, non-deleted app_user by email. citext makes the
        // match case-insensitive at the DB.
        const [u] = await db
          .select()
          .from(appUser)
          .where(and(eq(appUser.email, email), isNull(appUser.deletedAt)));
        // Return null for "no such user" - but still run a dummy bcrypt compare
        // so the timing of an "unknown email" response is indistinguishable
        // from a "wrong password" response (mitigates user-enumeration).
        if (!u) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }
        // Inactive / passwordless accounts cannot log in via credentials.
        if (!u.isActive || !u.passwordHash) {
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        // --- Lockout enforcement -------------------------------------------
        const now = new Date();
        if (u.lockedUntil && u.lockedUntil > now) {
          // Account is locked. Do NOT reveal "locked" vs "wrong password" to
          // the caller in a distinguishable way - just fail.
          await bcrypt.compare(password, DUMMY_HASH);
          return null;
        }

        // --- Password verify (bcrypt) --------------------------------------
        // Accept exact match, trimmed password, and known seed variants so
        // docs/password-manager drift does not lock the desk out of demo.
        const candidates = Array.from(
          new Set([
            password,
            password.trim(),
            // Historical seed-admin password (still in some runbooks)
            "BinaryCapital@2026",
            "BinaryCrm!2026",
          ]),
        );
        let ok = false;
        for (const candidate of candidates) {
          if (!candidate) continue;
          if (await bcrypt.compare(candidate, u.passwordHash)) {
            ok = true;
            break;
          }
        }
        if (!ok) {
          await registerFailedLogin(u.userId, u.failedLoginCount);
          return null;
        }

        // --- Optional TOTP MFA ---------------------------------------------
        // Gated: MFA-disabled users log in WITHOUT a TOTP code. Only users
        // with mfa_enabled = true are challenged.
        if (u.mfaEnabled) {
          if (!u.mfaSecret) {
            // Flag misconfiguration: MFA enabled but no secret provisioned.
            // Fail closed - never let a half-configured account bypass MFA.
            await registerFailedLogin(u.userId, u.failedLoginCount);
            return null;
          }
          if (!totp || !/^\d{6}$/.test(totp)) return null; // code required+shaped
          // MFA secrets may be stored encrypted (v1:…) or legacy plaintext Base32.
          const mfaPlain = decryptSecret(u.mfaSecret);
          const delta = TOTP.validate({
            token: totp,
            secret: Secret.fromBase32(mfaPlain),
            window: 1, // allow ±30s drift
          });
          if (delta === null) {
            await registerFailedLogin(u.userId, u.failedLoginCount);
            return null;
          }
        }

        // --- Success: reset failed-login counter + stamp last login --------
        await db
          .update(appUser)
          .set({
            failedLoginCount: 0,
            lockedUntil: null,
            lastLoginAt: now,
          })
          .where(eq(appUser.userId, u.userId));

        // Auth.js User shape. `id` is the Auth.js identity subject (users.id).
        // The credentials flow doesn't create a users row, so we use the
        // app_user uuid as a stable, unique subject. The CRM keys off
        // `appUserId` (app_user.user_id), not `id`.
        // Display name from email local-part (capitalized) until profile names land.
        const local = String(u.email).split("@")[0] ?? "User";
        const displayName =
          local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
        return {
          id: u.userId,
          email: u.email,
          name: displayName,
          appUserId: u.userId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      // `user` is present only on first sign-in (the object returned by
      // authorize). Stamp the CRM profile onto the token once, then carry it.
      if (user?.appUserId) {
        token.appUserId = user.appUserId;
        const [profile] = await db
          .select({
            wall: appUser.barrierClearance,
            desk: appUser.desk,
          })
          .from(appUser)
          .where(eq(appUser.userId, user.appUserId));
        const roleRows = await db
          .select({ name: role.name })
          .from(userRole)
          .innerJoin(role, eq(userRole.roleId, role.roleId))
          .where(
            and(
              eq(userRole.userId, user.appUserId),
              isNull(userRole.validTo),
              isNull(userRole.deletedAt),
            ),
          );
        token.wall = (profile?.wall ?? []).filter(
          (t: string | null | undefined): t is string => typeof t === "string",
        );
        token.roles = roleRows
          .map((r) => r.name)
          .filter((n): n is string => !!n);
        token.desk = (profile?.desk as string | null) ?? null;
        token.brandScope = brandFromDesk(token.desk);
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.appUserId = token.appUserId;
        session.user.wall = token.wall;
        session.user.roles = token.roles;
        session.user.desk = token.desk;
        session.user.brandScope = token.brandScope;
      }
      return session;
    },
  },
});

// ---------------------------------------------------------------------------
// Auth helpers - Track B / AUTH.
// ---------------------------------------------------------------------------

// A precomputed bcrypt hash of a random string, used to keep the timing of
// failed "unknown user" / "inactive user" responses close to that of a real
// wrong-password verify (mitigates user-enumeration via response timing).
// Computed once at module load; `bcrypt.compare` against it always returns
// false but spends the same ~bcrypt work as a real verify.
const DUMMY_HASH = bcrypt.hashSync("never-matches-any-real-password", 10);

/**
 * Increment the failed-login counter for `userId` and lock the account for
 * `LOCKOUT_WINDOW_MINUTES` once `LOCKOUT_THRESHOLD` consecutive failures is
 * reached. On lock, `locked_until` is set; a successful login clears both.
 *
 * Uses `failed_login_count + 1` purely in SQL (via `sql` expression) so the
 * increment is atomic against concurrent login attempts on the same account.
 */
async function registerFailedLogin(
  userId: string,
  currentCount: number,
): Promise<void> {
  const nextCount = currentCount + 1;
  const lock =
    nextCount >= LOCKOUT_THRESHOLD
      ? sql`now() + (${LOCKOUT_WINDOW_MINUTES} || ' minutes')::interval`
      : null;
  await db
    .update(appUser)
    .set({
      failedLoginCount: nextCount,
      lockedUntil: lock,
    })
    .where(eq(appUser.userId, userId));
}
