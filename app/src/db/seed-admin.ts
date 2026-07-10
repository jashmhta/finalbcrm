// Track B / AUTH - provision the seeded admin user with a REAL bcrypt-hashed
// password and MFA disabled.
//
// Run:  npx tsx src/db/seed-admin.ts
//
// Idempotent: looks up `app_user` by email (citext, case-insensitive) and
//   - if found: sets password_hash, resets failed_login_count/locked_until,
//     keeps MFA disabled, and ensures a current 'admin' role grant exists;
//   - if not found: inserts a minimal active admin app_user row + the admin
//     role grant, so this script is safe to run before src/db/seed.ts.
//
// SECURITY: the password is printed EXACTLY ONCE to stdout so the operator can
// capture it; it is never written to a file, never logged elsewhere, and only
// the bcrypt hash is stored in the database. Rotate the password after first
// login in production.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load .env.local manually (tsx does not load Next env, and `dotenv` is not a
// dependency). MUST run before the `./index` import, which constructs the
// postgres-js client from process.env.DATABASE_URL at module-eval time.
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore - let the db client surface the missing-URL error */
  }
}

const ADMIN_EMAIL = "shray@binarycapital.in";
// One-time password. Change after first prod login.
const ADMIN_PASSWORD = "BinaryCapital@2026";

async function main(): Promise<void> {
  const { db } = await import("./index");
  const { appUser, role, userRole } = await import("./schema");
  const bcrypt = await import("bcryptjs");
  const { and, eq, isNull } = await import("drizzle-orm");

  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

  // Find the existing seeded admin (seed.ts inserts all APP_USER_SEED rows).
  const [existing] = await db
    .select()
    .from(appUser)
    .where(and(eq(appUser.email, ADMIN_EMAIL), isNull(appUser.deletedAt)));

  let userId: string;
  if (existing) {
    // Reset password + clear lockout; keep MFA disabled.
    await db
      .update(appUser)
      .set({
        passwordHash,
        mfaEnabled: false,
        mfaSecret: null,
        failedLoginCount: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(appUser.userId, existing.userId));
    userId = existing.userId;
    console.log(`Updated existing admin app_user ${ADMIN_EMAIL} (${userId}).`);
  } else {
    // Not seeded yet - create a minimal admin row.
    const [inserted] = await db
      .insert(appUser)
      .values({
        email: ADMIN_EMAIL,
        isActive: true,
        desk: "management",
        barrierClearance: ["wall-ib", "wall-credit"],
        passwordHash,
        mfaEnabled: false,
        failedLoginCount: 0,
      })
      .returning({ userId: appUser.userId });
    if (!inserted) throw new Error("Failed to insert admin app_user");
    userId = inserted.userId;
    console.log(`Created admin app_user ${ADMIN_EMAIL} (${userId}).`);
  }

  // Ensure a current 'admin' role grant exists (no-op if already seeded).
  const [adminRole] = await db
    .select()
    .from(role)
    .where(and(eq(role.name, "admin"), isNull(role.deletedAt)));
  if (adminRole) {
    const [grant] = await db
      .select({ userRoleId: userRole.userRoleId })
      .from(userRole)
      .where(
        and(
          eq(userRole.userId, userId),
          eq(userRole.roleId, adminRole.roleId),
          isNull(userRole.validTo),
          isNull(userRole.deletedAt),
        ),
      );
    if (!grant) {
      await db.insert(userRole).values({
        userId,
        roleId: adminRole.roleId,
        validFrom: new Date(),
      });
      console.log("Granted 'admin' role.");
    }
  } else {
    console.log("WARN: 'admin' role not found: run src/db/seed.ts first.");
  }

  // ---- One-time password print ----
  console.log("----------------------------------------------------------");
  console.log("Seeded admin credentials (printed once; capture & rotate):");
  console.log(`  email    : ${ADMIN_EMAIL}`);
  console.log(`  password : ${ADMIN_PASSWORD}`);
  console.log(`  mfa      : disabled`);
  console.log("----------------------------------------------------------");

  // postgres-js pool is lazy-held; exit explicitly so the process terminates
  // (mirrors src/db/seed.ts). The pool is closed by the OS on exit.
  process.exit(0);
}

main().catch((err) => {
  console.error("seed-admin failed:", err);
  process.exit(1);
});
