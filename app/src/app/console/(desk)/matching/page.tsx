import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { getMatchableIssuers } from "@/features/matching/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CEmpty } from "@/console/primitives/empty";
import { CBadge } from "@/console/primitives/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Investor match" };

export default async function ConsoleMatchingPage() {
  const user = await requireUser();
  const allowed =
    can(user, "read", "matching") ||
    can(user, "read", "deal") ||
    can(user, "run", "matching");

  if (!allowed) {
    return (
      <CEmpty
        title="Matching not available"
        body="Your desk does not have matching access. Ask an admin for matching:read or deal:read."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const issuers = await getMatchableIssuers(user);

  return (
    <div>
      <CPageHeader
        eyebrow="Placement"
        title="Investor match"
        description="Rank institutional investors for an issuer mandate - the Bonds desk USP."
      />

      {issuers.length === 0 ? (
        <CEmpty
          title="No matchable issuers"
          body="Issuers need a role assignment, rating, and an active deal to appear here."
          actionLabel="Open parties"
          actionHref="/console/parties"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {issuers.slice(0, 48).map((iss) => (
            <Link key={iss.partyId} href={`/console/matching/${iss.partyId}`}>
              <CCard className="h-full transition-transform hover:-translate-y-0.5">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h2 className="text-[14px] font-semibold text-[var(--c-ink)]">
                    {iss.legalName}
                  </h2>
                  {iss.ratingValue ? (
                    <CBadge tone="accent">{iss.ratingValue}</CBadge>
                  ) : null}
                </div>
                <p className="text-[12px] text-[var(--c-ink-3)]">
                  {iss.sectorLabel ?? "Sector TBD"}
                  {iss.dealCode ? ` · ${iss.dealCode}` : ""}
                  {iss.targetSizeCrores != null
                    ? ` · ₹${iss.targetSizeCrores} Cr`
                    : ""}
                </p>
                <p className="mt-3 text-[12px] font-medium text-[var(--c-accent)]">
                  Open matrix →
                </p>
              </CCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
