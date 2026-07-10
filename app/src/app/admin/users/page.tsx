// Admin → Users - list all app_user records with email, roles, desk, active
// status, last login. Create / edit / deactivate actions live in the client
// view (useActionState forms). Gated to user:manage (admin role).

import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/rbac";
import {
  listUsers,
  listRoles,
  DESKS,
  type AdminUserRow,
} from "@/features/admin/queries";
import { Reveal } from "@/components/brand";
import { UsersManagerView } from "./users-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Users · Admin · Binary Capital CRM",
};

export default async function AdminUsersPage() {
  const user = await requireUser();
  if (!can(user, "manage", "user")) redirect("/parties");

  const [users, roles] = await Promise.all([listUsers(), listRoles()]);

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
        title="Users"
        description="The firm's app_user accounts - email, desk, barrier clearance, active role grants, and login posture. Create a user with a bcrypt-hashed password, edit their desk/roles/clearance, or deactivate. Self-deactivation is refused."
      />
      </Reveal>

      <UsersManagerView
        users={users}
        roles={roles.map((r) => ({ roleId: r.roleId, name: r.name }))}
        desks={[...DESKS]}
        currentUserId={user.appUserId ?? ""}
      />
    </PageShell>
  );
}
