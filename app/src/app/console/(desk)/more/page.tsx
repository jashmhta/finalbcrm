import Link from "next/link";
import { cookies } from "next/headers";

import { requireUser, can } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/org";
import {
  buildConsoleNav,
  resolveConsoleBrand,
} from "@/console/rbac/nav";
import {
  CONSOLE_BRAND_COOKIE,
  parseBrandPref,
} from "@/console/lib/brand-pref";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "More" };

/**
 * Mobile "More" hub — every desk destination + superadmin shortcuts.
 * Linked from the bottom dock 5th slot.
 */
export default async function ConsoleMorePage() {
  const user = await requireUser();
  const jar = await cookies();
  const brandPref = parseBrandPref(jar.get(CONSOLE_BRAND_COOKIE)?.value);
  const brand = resolveConsoleBrand({
    brandScope: user.brandScope,
    roles: user.roles,
    brandPref,
  });
  const nav = buildConsoleNav({
    roles: user.roles,
    permissions: user.permissions,
    brandScope: user.brandScope,
    brandPref,
  });
  const superUser = isSuperAdmin(user.roles);
  const canCreate = can(user, "create", "party");

  const superLinks = superUser
    ? [
        {
          href: "/console/assignments",
          label: "Approvals · assign",
          desc: "Approve or reject employee reassignment requests",
          badge: "Approve / Reject",
        },
        {
          href: "/console/settings",
          label: "Settings · data control",
          desc: "Edit / soft-delete clients · clear mock/scale/all with password",
          badge: "Password required",
        },
        {
          href: "/console/admin",
          label: "Admin · users",
          desc: "Create users, roles, direct assign",
        },
        {
          href: "/console/activity",
          label: "Coverage",
          desc: "Firm-wide employee interactions",
        },
        {
          href: "/console/reports",
          label: "Export packs",
          desc: "Super-only CSV downloads",
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <CPageHeader
        eyebrow={brand === "binarybonds" ? "Binary Bonds" : "Binary Capital"}
        title="More"
        description="All modules. Swipe left/right on any desk page to jump tabs."
      />

      {superUser ? (
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
            Super admin
          </h2>
          <ul className="space-y-2">
            {superLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block">
                  <CCard className="p-3 transition-colors active:bg-[var(--c-surface-2)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[14px] font-semibold text-[var(--c-ink)]">
                        {l.label}
                      </p>
                      {"badge" in l && l.badge ? (
                        <CBadge tone="warn">{l.badge}</CBadge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">
                      {l.desc}
                    </p>
                  </CCard>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canCreate ? (
        <Link href="/console/parties?new=1">
          <CCard className="p-3 ring-[var(--c-accent)]/30">
            <p className="text-[14px] font-semibold text-[var(--c-ink)]">
              + Add client
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">
              Create a company in your book — no super approval needed
            </p>
          </CCard>
        </Link>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
          All destinations
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex min-h-[3.25rem] items-center rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] px-3 py-2 text-[13px] font-medium text-[var(--c-ink)] ring-1 ring-[var(--c-line)] active:bg-[var(--c-accent-soft)]"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/console/search"
              className="flex min-h-[3.25rem] items-center rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] px-3 py-2 text-[13px] font-medium text-[var(--c-ink)] ring-1 ring-[var(--c-line)]"
            >
              Search engine
            </Link>
          </li>
        </ul>
      </section>

      <p className="text-center text-[11px] text-[var(--c-ink-3)]">
        Tip: swipe ← / → on the main desk to cycle modules
      </p>
    </div>
  );
}
