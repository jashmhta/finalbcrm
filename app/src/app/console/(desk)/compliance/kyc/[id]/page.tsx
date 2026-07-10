import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getKycDetail } from "@/features/compliance/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "KYC record" };

export default async function ConsoleKycDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const detail = await getKycDetail(id, user);
  if (!detail) notFound();

  const r = detail.record;
  const partyName = detail.party?.legalName ?? r.partyId;

  return (
    <div>
      <CPageHeader
        eyebrow={`KYC · ${r.kycType ?? "CDD"}`}
        title={partyName}
        description={`Status ${r.status}${r.riskRating ? ` · risk ${r.riskRating}` : ""}`}
        actions={
          <Link
            href="/console/compliance/kyc"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            Queue
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
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
        {r.riskRating ? <CBadge tone="neutral">{r.riskRating}</CBadge> : null}
        {r.kycType ? <CBadge tone="accent">{r.kycType}</CBadge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CCard className="lg:col-span-2 space-y-3">
          <h2 className="text-[13px] font-semibold">Record</h2>
          <dl className="grid gap-2 sm:grid-cols-2 text-[13px]">
            <Row k="Party nature" v={detail.party?.partyNature ?? "—"} />
            <Row k="Risk rating" v={r.riskRating ?? "—"} />
            <Row
              k="Approved by"
              v={detail.approver?.email ?? r.approvedByUserId ?? "—"}
            />
            <Row
              k="Contact"
              v={detail.contact?.fullName ?? r.contactId ?? "—"}
            />
          </dl>

          <h2 className="pt-2 text-[13px] font-semibold">
            Beneficial owners ({detail.beneficialOwners?.length ?? 0})
          </h2>
          {(detail.beneficialOwners?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-[var(--c-ink-3)]">None declared.</p>
          ) : (
            <ul className="divide-y divide-[var(--c-line)] text-[13px]">
              {detail.beneficialOwners!.map((bo) => (
                <li
                  key={bo.kycBeneficialOwnerId}
                  className="flex justify-between gap-2 py-2"
                >
                  <span>{bo.contactFullName}</span>
                  <span className="font-mono text-[var(--c-ink-3)]">
                    {bo.ownershipPct != null ? `${bo.ownershipPct}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="pt-2 text-[13px] font-semibold">
            Documents ({detail.documents?.length ?? 0})
          </h2>
          {(detail.documents?.length ?? 0) === 0 ? (
            <p className="text-[13px] text-[var(--c-ink-3)]">No KYC docs linked.</p>
          ) : (
            <ul className="divide-y divide-[var(--c-line)] text-[13px]">
              {detail.documents!.map((d) => (
                <li key={d.documentId} className="py-2">
                  <span className="font-medium">{d.fileName ?? d.documentType}</span>
                  <span className="ml-2 text-[var(--c-ink-3)]">
                    {d.documentType}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold">Next actions</h2>
          <ul className="space-y-2 text-[13px]">
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href={`/console/parties/${r.partyId}`}
              >
                Open party
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href={`/console/onboarding/${r.partyId}`}
              >
                Onboarding case
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/documents">
                Documents desk
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href="/console/compliance/kyc"
              >
                Full KYC queue
              </Link>
            </li>
          </ul>
        </CCard>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[var(--c-line)] pb-2 last:border-0">
      <dt className="text-[var(--c-ink-3)]">{k}</dt>
      <dd className="text-right font-medium text-[var(--c-ink)]">{v}</dd>
    </div>
  );
}
