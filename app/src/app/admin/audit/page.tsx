// Admin → Audit - the admin's forensic view of the immutable audit log.
// More detailed than the compliance audit page: advanced filters (entity type,
// operation, actor, date range, barrier) + a per-row diff inspector.
//
// Gated to audit:read (admin / compliance / partner roles). The data layer
// reuses the compliance audit query (LEFT JOIN app_user for actor email) with
// the barrier filter exposed.

import { requireUser, can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import {
  listAuditEntries,
  listAuditEntityTypes,
  listAuditBarriers,
  listUsers,
} from "@/features/admin/queries";
import { Reveal } from "@/components/brand";
import { AdminAuditView } from "./audit-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit log · Admin · Binary Capital CRM",
};

const PAGE_SIZE = 50;

const OPERATIONS = ["insert", "update", "delete", "merge", "approve", "reject"];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    entityType?: string;
    operation?: string;
    actorUserId?: string;
    from?: string;
    to?: string;
    barrierId?: string;
    page?: string;
  }>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "audit") && !can(user, "manage", "user")) {
    redirect("/parties");
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const entityType = sp.entityType || undefined;
  const operation = sp.operation || undefined;
  const actorUserId = sp.actorUserId || undefined;
  const from = sp.from || undefined;
  const to = sp.to || undefined;
  const barrierId = sp.barrierId || undefined;
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ rows, total, page: curPage, pageSize }, entityTypes, barriers, users] =
    await Promise.all([
      listAuditEntries({
        filter: { q, entityType, operation, actorUserId, from, to, barrierId },
        page,
        pageSize: PAGE_SIZE,
      }),
      listAuditEntityTypes(),
      listAuditBarriers(),
      listUsers(),
    ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
        title="Audit log"
        description="The admin's forensic view of the immutable event log - advanced filters by entity, operation, actor, date range, and information barrier. The hash chain (prev_hash → row_hash) is tamper-evident; a break indicates a row modified outside the trigger."
      />
      </Reveal>

      <AdminAuditView
        rows={rows}
        total={total}
        page={curPage}
        pageSize={pageSize}
        totalPages={totalPages}
        q={q}
        entityType={entityType}
        operation={operation}
        actorUserId={actorUserId}
        from={from}
        to={to}
        barrierId={barrierId}
        entityTypes={entityTypes}
        operations={OPERATIONS}
        barriers={barriers}
        users={users.map((u) => ({ userId: u.userId, email: u.email }))}
      />
    </PageShell>
  );
}
