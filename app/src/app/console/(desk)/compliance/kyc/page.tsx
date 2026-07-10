import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { listKycRecords } from "@/features/compliance/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "KYC" };

export default async function ConsoleKycPage() {
  const user = await requireUser();
  if (!can(user, "read", "kyc") && !can(user, "approve", "kyc")) {
    return (
      <CEmpty
        title="No KYC access"
        body="Compliance and KYC read grants are required."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { rows, total } = await listKycRecords({
    user,
    page: 1,
    pageSize: 50,
  });

  return (
    <div>
      <CPageHeader
        eyebrow="Compliance"
        title="KYC queue"
        description={`${total} records · CDD/EDD lifecycle.`}
      />
      {rows.length === 0 ? (
        <CEmpty title="No KYC records" body="Records appear as onboarding and CDD start." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.kycRecordId}
              href={`/console/compliance/kyc/${r.kycRecordId}`}
              className="block"
            >
              <CCard className="p-3 transition-colors hover:bg-[var(--c-surface)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--c-ink)]">
                      {r.partyLegalName ?? r.partyId}
                    </p>
                    <p className="text-[12px] text-[var(--c-ink-3)]">
                      {r.kycType ?? "CDD"} · risk {r.riskRating ?? "—"}
                    </p>
                  </div>
                  <CBadge
                    tone={
                      r.status === "approved"
                        ? "ok"
                        : r.status === "rejected"
                          ? "bad"
                          : r.status === "expired" || r.status === "rekyc_due"
                            ? "warn"
                            : "info"
                    }
                  >
                    {r.status}
                  </CBadge>
                </div>
              </CCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
