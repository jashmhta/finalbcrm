// Provision Binary Capital org roster from CEO meeting notes.
//
// Super admins:
//   Shray (both Capital + Bonds), Shahrukh (Capital), Rati (Bonds), Niraj (Bonds)
// Employees:
//   Yash (Capital), Pranjali (Capital), Tashmit (Bonds)
//
// Run:  npx tsx src/db/seed-org-users.ts
// Default password (rotate in prod): BinaryCrm!2026
//
// Safe to re-run: upserts by email, refreshes role grants.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* ignore */
  }
}

type BrandScope = "binarycapital" | "binarybonds" | "shared";
type Level = "super_admin" | "employee";

interface OrgUser {
  email: string;
  name: string;
  level: Level;
  brand: BrandScope;
  desk:
    | "management"
    | "ib_advisory"
    | "bond_underwriting"
    | "credit"
    | "operations"
    | "portfolio_mgmt";
  roleNames: string[];
}

const ORG: OrgUser[] = [
  {
    email: "shray@binarycapital.in",
    name: "Shray Vasudeva",
    level: "super_admin",
    brand: "shared",
    desk: "management",
    roleNames: ["super_admin", "admin"],
  },
  {
    email: "shahrukh@binarycapital.in",
    name: "Shahrukh Sheikh",
    level: "super_admin",
    brand: "binarycapital",
    desk: "ib_advisory",
    roleNames: ["super_admin", "admin"],
  },
  {
    email: "rati@binarybonds.in",
    name: "Rati Ravi Kant",
    level: "super_admin",
    brand: "binarybonds",
    desk: "credit",
    roleNames: ["super_admin", "admin"],
  },
  {
    email: "niraj@binarybonds.in",
    name: "Niraj",
    level: "super_admin",
    brand: "binarybonds",
    desk: "bond_underwriting",
    roleNames: ["super_admin", "admin"],
  },
  {
    email: "yash@binarycapital.in",
    name: "Yash",
    level: "employee",
    brand: "binarycapital",
    desk: "ib_advisory",
    roleNames: ["coverage_rm"],
  },
  {
    email: "pranjali@binarycapital.in",
    name: "Pranjali",
    level: "employee",
    brand: "binarycapital",
    desk: "operations",
    roleNames: ["coverage_rm"],
  },
  {
    email: "tashmit@binarybonds.in",
    name: "Tashmit",
    level: "employee",
    brand: "binarybonds",
    desk: "bond_underwriting",
    roleNames: ["bond_desk"],
  },
];

const DEFAULT_PASSWORD = process.env.SEED_ORG_PASSWORD ?? "BinaryCrm!2026";

async function main() {
  const { db } = await import("./index");
  const { appUser, role, userRole } = await import("./schema");

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  // Ensure super_admin role exists (in addition to admin from main seed).
  for (const roleName of ["super_admin", "admin", "coverage_rm", "bond_desk"]) {
    const [existing] = await db
      .select({ roleId: role.roleId })
      .from(role)
      .where(and(eq(role.name, roleName), isNull(role.deletedAt)));
    if (!existing) {
      await db.insert(role).values({
        name: roleName,
        description:
          roleName === "super_admin"
            ? "Firm super admin - export, assign, merge, full book"
            : roleName === "coverage_rm"
              ? "Coverage RM - assigned parties, leads, interactions"
              : roleName === "bond_desk"
                ? "Bonds desk - assigned investors, interactions, matching"
                : "Admin",
        desk:
          roleName === "bond_desk"
            ? "bond_underwriting"
            : roleName === "coverage_rm"
              ? "ib_advisory"
              : "management",
      });
      console.log(`Created role: ${roleName}`);
    }
  }

  const allRoles = await db
    .select({ roleId: role.roleId, name: role.name })
    .from(role)
    .where(isNull(role.deletedAt));
  const roleByName = new Map(
    allRoles.map((r) => [r.name as string, r.roleId as string]),
  );

  for (const u of ORG) {
    const [existing] = await db
      .select({ userId: appUser.userId })
      .from(appUser)
      .where(and(eq(appUser.email, u.email), isNull(appUser.deletedAt)));

    let userId: string;
    if (existing) {
      userId = existing.userId;
      await db
        .update(appUser)
        .set({
          passwordHash,
          isActive: true,
          desk: u.desk,
          // barrier clearance empty for employees; supers get open wall later via admin
          failedLoginCount: 0,
          lockedUntil: null,
        })
        .where(eq(appUser.userId, userId));
      console.log(`Updated ${u.email}`);
    } else {
      const [inserted] = await db
        .insert(appUser)
        .values({
          email: u.email,
          passwordHash,
          isActive: true,
          desk: u.desk,
          mfaEnabled: false,
          failedLoginCount: 0,
        })
        .returning({ userId: appUser.userId });
      if (!inserted) throw new Error(`Failed to insert ${u.email}`);
      userId = inserted.userId;
      console.log(`Created ${u.email}`);
    }

    // Grant listed roles (idempotent: skip if active grant exists)
    for (const rn of u.roleNames) {
      const roleId = roleByName.get(rn);
      if (!roleId) {
        console.warn(`  skip role ${rn} (not found)`);
        continue;
      }
      const [grant] = await db
        .select({ id: userRole.userRoleId })
        .from(userRole)
        .where(
          and(
            eq(userRole.userId, userId),
            eq(userRole.roleId, roleId),
            isNull(userRole.validTo),
            isNull(userRole.deletedAt),
          ),
        );
      if (!grant) {
        await db.insert(userRole).values({
          userId,
          roleId,
          validFrom: new Date(),
        });
        console.log(`  granted ${rn}`);
      }
    }
  }

  console.log("\nOrg roster ready.");
  console.log(`Password for all (change in prod): ${DEFAULT_PASSWORD}`);
  console.log("\nSuper admins (export allowed):");
  for (const u of ORG.filter((x) => x.level === "super_admin")) {
    console.log(`  ${u.name.padEnd(20)} ${u.email.padEnd(28)} [${u.brand}]`);
  }
  console.log("\nEmployees (assigned book only, no export):");
  for (const u of ORG.filter((x) => x.level === "employee")) {
    console.log(`  ${u.name.padEnd(20)} ${u.email.padEnd(28)} [${u.brand}]`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("seed-org-users failed:", err);
  process.exit(1);
});
