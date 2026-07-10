import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getLeadDetail } from "@/features/leads/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { formatCrorePlain } from "@/lib/money";
import { ContactActions } from "@/console/primitives/contact-actions";
import { LeadActions } from "./lead-actions";

export const dynamic = "force-dynamic";

export default async function ConsoleLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getLeadDetail(id, user);
  if (!detail) {
    if (!can(user, "read", "lead") && !can(user, "read", "party")) {
      return (
        <CEmpty
          title="No access"
          body="You cannot view this lead."
          actionLabel="Leads"
          actionHref="/console/leads"
        />
      );
    }
    notFound();
  }

  const bant = detail.lead.bant;
  const bantScore = ["budget", "authority", "need", "timeline"].filter(
    (k) => bant?.[k as keyof typeof bant],
  ).length;

  return (
    <div>
      <CPageHeader
        eyebrow={`Lead · ${detail.lead.stage}`}
        title={detail.legalName}
        description={
          detail.lead.dealType
            ? detail.lead.dealType.replace(/_/g, " ")
            : "Prospect"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ContactActions
              phone={detail.lead.contactPhone}
              email={detail.lead.contactEmail}
              partyName={detail.legalName}
              showEmpty
            />
            <Link
              href="/console/leads"
              className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] bg-[var(--c-surface)] px-4 text-[13px] font-medium ring-1 ring-[var(--c-line-strong)]"
            >
              Back
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <CCard className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap gap-2">
            <CBadge tone="accent">{detail.lead.stage}</CBadge>
            <CBadge tone="neutral">
              {detail.lead.source?.replace(/_/g, " ") ?? "source"}
            </CBadge>
            {detail.lead.estSizeCr != null ? (
              <CBadge tone="info">
                {formatCrorePlain(detail.lead.estSizeCr)}
              </CBadge>
            ) : null}
          </div>
          <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-[var(--c-ink-3)]">Probability</dt>
              <dd className="font-mono font-medium">
                {detail.lead.probability ?? "—"}%
              </dd>
            </div>
            <div>
              <dt className="text-[var(--c-ink-3)]">BANT</dt>
              <dd className="font-medium">{bantScore}/4</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[var(--c-ink-3)]">Contact</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-3 font-medium">
                <span>
                  {detail.lead.contactName ?? "—"}
                  {detail.lead.contactTitle
                    ? ` · ${detail.lead.contactTitle}`
                    : ""}
                  {detail.lead.contactEmail
                    ? ` · ${detail.lead.contactEmail}`
                    : ""}
                  {detail.lead.contactPhone
                    ? ` · ${detail.lead.contactPhone}`
                    : ""}
                </span>
                <ContactActions
                  phone={detail.lead.contactPhone}
                  email={detail.lead.contactEmail}
                  partyName={detail.legalName}
                  size="sm"
                />
              </dd>
            </div>
            <div>
              <dt className="text-[var(--c-ink-3)]">RM</dt>
              <dd className="font-medium">
                {detail.assignedRmEmail ?? detail.lead.assignedRm ?? "Unassigned"}
              </dd>
            </div>
          </dl>
          {detail.lead.notes ? (
            <p className="text-[13px] leading-relaxed text-[var(--c-ink-2)]">
              {detail.lead.notes}
            </p>
          ) : null}
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold">Workflow</h2>
          <LeadActions
            partyId={detail.partyId}
            stage={detail.lead.stage}
            convertedDealId={detail.lead.convertedDealId}
            canWrite={
              can(user, "update", "lead") ||
              can(user, "create", "lead") ||
              can(user, "create", "deal")
            }
          />
          {detail.lead.convertedDealId ? (
            <p className="mt-3 text-[13px]">
              <Link
                className="text-[var(--c-accent)] hover:underline"
                href={`/console/deals/${detail.lead.convertedDealId}`}
              >
                Open converted mandate →
              </Link>
            </p>
          ) : null}
        </CCard>
      </div>
    </div>
  );
}
