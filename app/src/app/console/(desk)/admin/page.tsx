import { redirect } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { brandFromDesk, isFirmWide } from "@/lib/org";
import { listUsers, listRoles } from "@/features/admin/queries";
import { listParties } from "@/features/parties/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import {
  AssignPartyForm,
  CreateUserForm,
  EditRolesForm,
  ResetPasswordForm,
} from "./admin-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function ConsoleAdminPage() {
  const user = await requireUser();
  const canManage = can(user, "manage", "user");
  if (!canManage && !can(user, "read", "audit")) {
    redirect("/console");
  }

  const [users, roles, partiesPage] = await Promise.all([
    listUsers(),
    listRoles(),
    canManage
      ? listParties({ user, page: 1, pageSize: 80 })
      : Promise.resolve({ rows: [] as { partyId: string; legalName: string }[] }),
  ]);

  const roleNames = roles.map((r) => r.name);
  const partyOptions = (partiesPage.rows ?? []).map((p) => ({
    partyId: p.partyId,
    legalName: p.legalName ?? p.partyId,
  }));
  // Brand Chinese wall: brand-scoped admins only assign within their desk.
  const assignableUsers = isFirmWide(user.brandScope)
    ? users
    : users.filter((u) => {
        const b = brandFromDesk(u.desk as string | null);
        return b === user.brandScope || b === "shared";
      });
  const userOptions = assignableUsers.map((u) => {
    const b = brandFromDesk(u.desk as string | null);
    const tag =
      b === "binarycapital"
        ? " · Capital"
        : b === "binarybonds"
          ? " · Bonds"
          : "";
    return {
      userId: u.userId,
      email: `${u.email}${tag}`,
    };
  });

  return (
    <div className="space-y-6">
      <CPageHeader
        eyebrow="Administration"
        title="Users, roles & client assignment"
        description="Super-admin firm control: create credentials, grant roles, assign clients. Employees without user:manage never see this page."
      />

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <CCard>
            <h2 className="mb-3 text-[13px] font-semibold">Create user</h2>
            <CreateUserForm roleNames={roleNames} />
          </CCard>
          <CCard>
            <h2 className="mb-3 text-[13px] font-semibold">
              Direct assign (super)
            </h2>
            <p className="mb-3 text-[12px] text-[var(--c-ink-3)]">
              Immediate ownership change. Blocks assigning a client to staff who
              already own it. Employees use{" "}
              <a href="/console/assignments" className="text-[var(--c-accent)]">
                Assignments
              </a>{" "}
              (approval queue).
            </p>
            <AssignPartyForm users={userOptions} parties={partyOptions} />
          </CCard>
          <CCard className="max-h-[70vh] overflow-y-auto">
            <h2 className="mb-3 text-[13px] font-semibold">
              Credentials &amp; roles
            </h2>
            <ul className="space-y-5">
              {users.slice(0, 12).map((u) => (
                <li
                  key={u.userId}
                  className="border-b border-[var(--c-line)] pb-4 last:border-0"
                >
                  <ResetPasswordForm userId={u.userId} email={u.email} />
                  <EditRolesForm
                    userId={u.userId}
                    email={u.email}
                    allRoleNames={roleNames}
                    currentRoleNames={(u.roles ?? []).map((r) => r.name)}
                  />
                </li>
              ))}
            </ul>
          </CCard>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <CCard className="p-0 md:p-0">
          <div className="border-b border-[var(--c-line)] px-4 py-3 text-[13px] font-semibold">
            Users ({users.length})
          </div>
          <ul className="max-h-[60vh] divide-y divide-[var(--c-line)] overflow-y-auto">
            {users.map((u) => (
              <li key={u.userId} className="px-4 py-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{u.email}</span>
                  <CBadge tone={u.isActive ? "ok" : "bad"}>
                    {u.isActive ? "active" : "inactive"}
                  </CBadge>
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--c-ink-3)]">
                  {u.desk ?? "no desk"} ·{" "}
                  {(u.roles ?? []).map((r) => r.name).join(", ") || "no roles"}
                </p>
              </li>
            ))}
          </ul>
        </CCard>
        <CCard className="p-0 md:p-0">
          <div className="border-b border-[var(--c-line)] px-4 py-3 text-[13px] font-semibold">
            Roles ({roles.length})
          </div>
          <ul className="max-h-[60vh] divide-y divide-[var(--c-line)] overflow-y-auto">
            {roles.map((r) => (
              <li key={r.roleId} className="px-4 py-3 text-[13px]">
                <p className="font-medium">{r.name}</p>
                <p className="text-[12px] text-[var(--c-ink-3)]">
                  {r.desk ?? "—"} · {r.permissions.length} perms ·{" "}
                  {r.userCount} users
                </p>
              </li>
            ))}
          </ul>
        </CCard>
      </div>
    </div>
  );
}
