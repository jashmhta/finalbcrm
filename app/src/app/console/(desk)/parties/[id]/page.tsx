import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getPartyDetail } from "@/features/parties/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { ContactActions } from "@/console/primitives/contact-actions";

export const dynamic = "force-dynamic";

export default async function ConsolePartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "party")) {
    return (
      <CEmpty
        title="No access"
        body="You do not have permission to view parties."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { id } = await params;
  const detail = await getPartyDetail(id, user);
  if (!detail) notFound();

  const p = detail.party;
  const primary =
    detail.contacts.find((c) => c.isPrimary) ?? detail.contacts[0] ?? null;

  return (
    <div>
      <CPageHeader
        eyebrow="Party"
        title={p.legalName ?? "Party"}
        description={p.displayName ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ContactActions
              phone={primary?.primaryPhone}
              email={primary?.primaryEmail}
              partyName={p.legalName}
              showEmpty
            />
            <Link
              href="/console/parties"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              Back to list
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--c-ink)]">
            Profile
          </h2>
          <dl className="space-y-2 text-[13px]">
            <Row k="Status" v={<CBadge tone="neutral">{p.status}</CBadge>} />
            <Row k="Nature" v={p.partyNature ?? "—"} />
            <Row k="Brand" v={String(p.brandOrigin ?? "—")} />
            <Row
              k="KYC"
              v={
                <CBadge tone={p.isKycComplete ? "ok" : "warn"}>
                  {p.isKycComplete ? "Complete" : "Incomplete"}
                </CBadge>
              }
            />
            <Row
              k="Types"
              v={detail.types.map((t) => t.partyType).join(", ") || "—"}
            />
            {p.industrySector ? (
              <Row k="Sector" v={p.industrySector} />
            ) : null}
            {p.turnoverBand ? (
              <Row k="Turnover" v={p.turnoverBand.replace(/_/g, " ")} />
            ) : null}
            {p.latestRating ? (
              <Row
                k="Rating"
                v={`${p.latestRating}${p.latestRatingAgency ? ` · ${p.latestRatingAgency}` : ""}${p.latestRatingYear ? ` · ${p.latestRatingYear}` : ""}`}
              />
            ) : null}
            {p.investorType ? (
              <Row k="Investor type" v={p.investorType.replace(/_/g, " ")} />
            ) : null}
          </dl>
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--c-ink)]">
            Primary contact
          </h2>
          {primary ? (
            <div className="space-y-3">
              <div>
                <p className="text-[15px] font-semibold text-[var(--c-ink)]">
                  {primary.fullName}
                </p>
                <p className="text-[12px] text-[var(--c-ink-3)]">
                  {[primary.designation, primary.role]
                    .filter(Boolean)
                    .join(" · ") || "Contact"}
                </p>
              </div>
              <dl className="space-y-2 text-[13px]">
                <Row k="Phone" v={primary.primaryPhone ?? "—"} />
                <Row k="Email" v={primary.primaryEmail ?? "—"} />
              </dl>
              <ContactActions
                phone={primary.primaryPhone}
                email={primary.primaryEmail}
                partyName={p.legalName}
                showEmpty
              />
            </div>
          ) : (
            <p className="text-[13px] text-[var(--c-ink-3)]">
              No contacts linked yet.
            </p>
          )}

          <h2 className="mb-2 mt-6 text-[13px] font-semibold text-[var(--c-ink)]">
            Next actions
          </h2>
          <ul className="space-y-2 text-[13px]">
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/tasks">
                Create a follow-up task
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href="/console/interactions"
              >
                Log an interaction
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href={`/console/matching/${id}`}
              >
                Run investor matching
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/deals">
                Open pipeline
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href="/console/documents"
              >
                Attach documents
              </Link>
            </li>
            <li>
              <Link
                className="text-[var(--c-accent)]"
                href={`/console/onboarding/${id}`}
              >
                Onboarding case
              </Link>
            </li>
          </ul>
        </CCard>
      </div>

      {detail.contacts.length > 1 ? (
        <CCard className="mt-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--c-ink)]">
            All contacts ({detail.contacts.length})
          </h2>
          <ul className="divide-y divide-[var(--c-line)]">
            {detail.contacts.map((c) => (
              <li
                key={c.partyContactId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--c-ink)]">
                    {c.fullName}
                    {c.isPrimary ? (
                      <CBadge tone="accent" className="ml-2">
                        Primary
                      </CBadge>
                    ) : null}
                  </p>
                  <p className="text-[12px] text-[var(--c-ink-3)]">
                    {[c.designation, c.role].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <ContactActions
                  phone={c.primaryPhone}
                  email={c.primaryEmail}
                  partyName={p.legalName}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        </CCard>
      ) : null}

      {detail.deals.length > 0 ? (
        <CCard className="mt-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--c-ink)]">
            Linked mandates ({detail.deals.length})
          </h2>
          <ul className="divide-y divide-[var(--c-line)] text-[13px]">
            {detail.deals.slice(0, 12).map((d) => (
              <li
                key={d.dealPartyId}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <Link
                  href={`/console/deals/${d.dealId}`}
                  className="font-medium text-[var(--c-accent)]"
                >
                  {d.dealCode ?? d.dealName ?? d.dealId.slice(0, 8)}
                </Link>
                <span className="text-[var(--c-ink-3)]">
                  {d.role}
                  {d.status ? ` · ${d.status}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </CCard>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--c-line)] pb-2 last:border-0">
      <dt className="text-[var(--c-ink-3)]">{k}</dt>
      <dd className="text-right font-medium text-[var(--c-ink)]">{v}</dd>
    </div>
  );
}
