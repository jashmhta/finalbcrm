import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/org";
import {
  listPendingAssignmentRequests,
  listRecentAssignmentRequests,
  listAssignableUsers,
} from "@/features/parties/assignment-queries";
import { listParties } from "@/features/parties/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import {
  AssignmentRequestForm,
  ReviewAssignmentForm,
} from "./assignment-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assignments" };

function isAssignAdmin(user: { roles: string[]; permissions: Set<string> }) {
  return (
    isSuperAdmin(user.roles) ||
    user.roles.includes("admin") ||
    can(user, "assign", "party") ||
    can(user, "manage", "user")
  );
}

export default async function ConsoleAssignmentsPage() {
  const user = await requireUser();
  if (!can(user, "read", "party")) {
    redirect("/console");
  }

  const admin = isAssignAdmin(user);
  const [pending, recent, staff, partiesPage] = await Promise.all([
    admin ? listPendingAssignmentRequests() : Promise.resolve([]),
    listRecentAssignmentRequests(admin ? 40 : 15),
    listAssignableUsers(user),
    listParties({ user, page: 1, pageSize: 80 }),
  ]);

  const parties = partiesPage.rows.map((p) => ({
    partyId: p.partyId,
    legalName: p.legalName,
    assignedUserId: p.assignedUserId,
  }));

  const staffOpts = staff.map((s) => ({
    userId: s.userId,
    email: s.email + (s.brand && s.brand !== "shared" ? ` · ${s.brand === "binarycapital" ? "Capital" : "Bonds"}` : ""),
  }));

  return (
    <div className="space-y-6">
      <CPageHeader
        eyebrow="Coverage handoff"
        title="Client assignments"
        description={
          admin
            ? "Approve employee reassignment requests, or assign directly. Same staff cannot receive a client they already own."
            : "Request reassignment of a client in your book. Super admin must approve before ownership changes."
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <CCard>
          <h2 className="mb-2 text-[13px] font-semibold text-[var(--c-ink)]">
            {admin ? "Request or direct-assign" : "Request reassignment"}
          </h2>
          <p className="mb-3 text-[12px] text-[var(--c-ink-3)]">
            Employees create a pending request. Super admins approve on the
            right (or use Admin for immediate assign).
          </p>
          <AssignmentRequestForm parties={parties} users={staffOpts} />
        </CCard>

        {admin ? (
          <CCard className="max-h-[70vh] overflow-y-auto">
            <h2 className="mb-2 text-[13px] font-semibold text-[var(--c-ink)]">
              Pending approval ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <p className="text-[13px] text-[var(--c-ink-3)]">
                No pending requests.
              </p>
            ) : (
              <ul className="space-y-4">
                {pending.map((r) => (
                  <li
                    key={r.requestId}
                    className="border-b border-[var(--c-line)] pb-4 last:border-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <CBadge tone="warn">pending</CBadge>
                      <Link
                        href={`/console/parties/${r.partyId}`}
                        className="text-[13px] font-semibold text-[var(--c-accent)]"
                      >
                        {r.partyName ?? r.partyId}
                      </Link>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--c-ink-2)]">
                      {r.fromEmail ?? "unassigned"} →{" "}
                      <strong>{r.toEmail ?? r.toUserId}</strong>
                    </p>
                    <p className="text-[11px] text-[var(--c-ink-3)]">
                      Requested by {r.requestedByEmail ?? "—"}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                    <div className="mt-2">
                      <ReviewAssignmentForm requestId={r.requestId} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CCard>
        ) : (
          <CCard>
            <h2 className="mb-2 text-[13px] font-semibold">Your recent requests</h2>
            {recent.filter((r) => r.requestedByUserId === user.appUserId)
              .length === 0 ? (
              <CEmpty
                title="No requests yet"
                body="When you hand off a client, the request appears here until approved."
              />
            ) : (
              <ul className="space-y-2 text-[13px]">
                {recent
                  .filter((r) => r.requestedByUserId === user.appUserId)
                  .map((r) => (
                    <li key={r.requestId}>
                      <CBadge
                        tone={
                          r.status === "approved"
                            ? "ok"
                            : r.status === "pending"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {r.status}
                      </CBadge>{" "}
                      {r.partyName} → {r.toEmail}
                    </li>
                  ))}
              </ul>
            )}
          </CCard>
        )}
      </div>

      {admin ? (
        <section>
          <h2 className="mb-2 text-[13px] font-semibold">Recent decisions</h2>
          <ul className="divide-y divide-[var(--c-line)] rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] ring-1 ring-[var(--c-line)]">
            {recent.map((r) => (
              <li key={r.requestId} className="px-4 py-3 text-[13px]">
                <CBadge
                  tone={
                    r.status === "approved"
                      ? "ok"
                      : r.status === "pending"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {r.status}
                </CBadge>{" "}
                <span className="font-medium">{r.partyName}</span> ·{" "}
                {r.fromEmail ?? "—"} → {r.toEmail} · by {r.requestedByEmail}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
