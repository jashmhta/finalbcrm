import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { redirect } from "next/navigation";

import { can, requireUser } from "@/lib/rbac";
import { listAuditLog } from "@/features/compliance/audit";
import { AuditListView } from "./audit-list-view";

// Immutable log read - never prerender. searchParams opt into dynamic
// rendering anyway, but force-dynamic is explicit.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const ENTITY_TYPES = [
  "party",
  "contact",
  "deal",
  "deal_party",
  "kyc_record",
  "kyc_beneficial_owner",
  "consent_record",
  "data_subject_request",
  "credit_analysis",
  "credit_score",
  "credit_limit",
  "exposure",
  "external_rating",
  "interaction",
  "document",
  "task",
];

const OPERATIONS = ["insert", "update", "delete", "merge", "approve", "reject"];

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    entityType?: string;
    operation?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "audit") && !can(user, "read_all", "audit") && !can(user, "manage", "user")) {
    redirect("/parties");
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const entityType = sp.entityType || undefined;
  const operation = sp.operation || undefined;
  const from = sp.from || undefined;
  const to = sp.to || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const { rows, total, page: curPage, pageSize } = await listAuditLog({
    filter: { q, entityType, operation, from, to },
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      {/* Page title renders visible on mount - NOT whileInView-gated, so the
          heading is present in headless snapshots and above the fold. */}
      <PageHeader title="Audit log" description="Immutable change history." />

      <AuditListView
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
        entityType={entityType}
        operation={operation}
        from={from}
        to={to}
        entityTypes={ENTITY_TYPES}
        operations={OPERATIONS}
      />
    </PageShell>
  );
}
