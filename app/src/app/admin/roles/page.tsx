// Admin → Roles - list roles + their permissions, assign/revoke permissions.
// Gated to user:manage (admin role). The admin role itself is protected - its
// permissions cannot be edited through this surface (an admin locking
// themselves out of user:manage would brick the panel).

import { redirect } from "next/navigation";
import { requireUser, can } from "@/lib/rbac";
import {
  listRoles,
  listPermissions,
  type AdminRoleRow,
  type AdminPermissionRow,
} from "@/features/admin/queries";
import { Reveal } from "@/components/brand";
import { RolesManagerView } from "./roles-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Roles · Admin · Binary Capital CRM",
};

export default async function AdminRolesPage() {
  const user = await requireUser();
  if (!can(user, "manage", "user")) redirect("/parties");

  const [roles, permissions] = await Promise.all([
    listRoles(),
    listPermissions(),
  ]);

  return (
    <PageShell>
      <Reveal y={10} duration={0.55} noBlur>
        <PageHeader
        title="Roles"
        description="The firm's role catalogue and the permission codes granted to each. Toggle a permission to assign or revoke it - the role's effective permissions update immediately. The admin role is protected; its grants are not editable here."
      />
      </Reveal>

      <RolesManagerView roles={roles} permissions={permissions} />
    </PageShell>
  );
}
