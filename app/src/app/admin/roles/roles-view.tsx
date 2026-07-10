"use client";

// Admin → Roles - client view layer.
//
// A list of role cards, each showing the role name, desk, user count, and a
// permission toggle grid. Toggling a permission submits to the
// updateRolePermissions server action, which syncs the role's grants to the
// submitted set. The admin role card is rendered read-only (protected).
//
// Permissions are grouped by resource (the part before the ":") so the grid
// reads as "what can this role do to party / deal / credit / kyc / …". This
// is the admin's mental model of RBAC, not a flat alphabetical list.

import * as React from "react";
import { useActionState } from "react";
import {
  Keyhole,
  LockSimple,
  Check,
  SealCheck,
  ShieldCheck,
  CircleNotch,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type {
  AdminRoleRow,
  AdminPermissionRow,
} from "@/features/admin/queries";
import {
  Card,
  CardBody,
  CardHeader,
  Eyebrow,
  Badge,
  IconTile,
  EmptyState,
} from "@/components/brand";
import {
  updateRolePermissions,
  type UpdateRolePermissionsState,
} from "@/features/admin/actions";

export interface RolesManagerViewProps {
  roles: AdminRoleRow[];
  permissions: AdminPermissionRow[];
}

/** Group permission codes by resource (the part before ":"). */
function groupByResource(
  perms: AdminPermissionRow[],
): { resource: string; codes: string[] }[] {
  const map = new Map<string, string[]>();
  for (const p of perms) {
    const idx = p.code.indexOf(":");
    const resource = idx >= 0 ? p.code.slice(0, idx) : p.code;
    const arr = map.get(resource) ?? [];
    arr.push(p.code);
    map.set(resource, arr);
  }
  return Array.from(map.entries())
    .map(([resource, codes]) => ({
      resource,
      codes: codes.sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => a.resource.localeCompare(b.resource));
}

export function RolesManagerView({
  roles,
  permissions,
}: RolesManagerViewProps) {
  const groups = React.useMemo(() => groupByResource(permissions), [permissions]);

  return (
    <div className="flex flex-col gap-4">
      {roles.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<Keyhole weight="light" />}
              title="No roles defined."
              hint="Run the seed script to provision the role catalogue."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {roles.map((role) => (
            <RoleCard
              key={role.roleId}
              role={role}
              groups={groups}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoleCard({
  role,
  groups,
}: {
  role: AdminRoleRow;
  groups: { resource: string; codes: string[] }[];
}) {
  const isAdmin = role.name === "admin";
  const [state, action, pending] = useActionState<UpdateRolePermissionsState, FormData>(
    updateRolePermissions,
    undefined,
  );

  // Local selected set - initialized from the role's current permissions,
  // updated optimistically on toggle, then synced on submit. The action
  // revalidates /admin/roles so the server-rendered grants replace the
  // optimistic state on success.
  const currentCodes = new Set(role.permissions.map((p) => p.code));
  const [selected, setSelected] = React.useState<Set<string>>(currentCodes);

  // Re-sync when the role prop changes (after a revalidate).
  React.useEffect(() => {
    setSelected(new Set(role.permissions.map((p) => p.code)));
  }, [role]);

  function toggle(code: string) {
    if (isAdmin || pending) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const grantedCount = selected.size;
  const totalCount = groups.reduce((n, g) => n + g.codes.length, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconTile
              size={24}
              tone={isAdmin ? "gold" : "neutral"}
              icon={isAdmin ? ShieldCheck : Keyhole}
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                  {role.name}
                </h3>
                {isAdmin ? (
                  <Badge variant="gold">
                    <LockSimple weight="light" className="size-3" />
                    Protected
                  </Badge>
                ) : null}
              </div>
              <span className="text-[12px] text-muted-foreground">
                {role.desk ? prettify(role.desk) : "no desk"} ·{" "}
                <span className="nums tabular-nums">{role.userCount}</span>{" "}
                user{role.userCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="nums text-[12px] tabular-nums text-muted-foreground">
              <span className="text-foreground">{grantedCount}</span> / {totalCount}
            </span>
            <Eyebrow>granted</Eyebrow>
          </div>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        {state?.error ? (
          <p
            role="alert"
            className="mb-3 rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
          >
            {state.error}
          </p>
        ) : state?.ok ? (
          <p className="mb-3 rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
            Permissions updated.
          </p>
        ) : null}

        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="roleId" value={role.roleId} />
          {/* Hidden inputs - one per selected permission code. */}
          {Array.from(selected).map((code) => (
            <input key={code} type="hidden" name="permissionCodes" value={code} />
          ))}

          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <div
                key={g.resource}
                className="rounded-xl bg-foreground/[0.02] p-3 ring-1 ring-inset ring-foreground/[0.07]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {g.resource}
                  </span>
                  <span className="nums text-[10px] tabular-nums text-muted-foreground/70">
                    {g.codes.filter((c) => selected.has(c)).length}/{g.codes.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.codes.map((code) => {
                    const checked = selected.has(code);
                    const action = code.slice(code.indexOf(":") + 1);
                    return (
                      <PermissionToggle
                        key={code}
                        code={code}
                        action={action}
                        checked={checked}
                        disabled={isAdmin || pending}
                        onToggle={() => toggle(code)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {!isAdmin ? (
            <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
              <span className="mr-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {pending ? (
                  <>
                    <CircleNotch weight="light" className="size-3 animate-spin" />
                    Syncing…
                  </>
                ) : (
                  <>
                    <SealCheck weight="light" className="size-3" />
                    Changes save on submit
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setSelected(currentCodes)}
                disabled={pending}
                className="rounded-full px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground ring-1 ring-hairline transition-colors hover:text-foreground disabled:opacity-50"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-4 py-1.5 text-[12px] font-medium text-gold ring-1 ring-gold/30 transition-all hover:bg-gold/25 active:scale-[0.97] disabled:opacity-60"
              >
                {pending ? (
                  <CircleNotch weight="light" className="size-3.5 animate-spin" />
                ) : (
                  <Check weight="light" className="size-3.5" />
                )}
                Save permissions
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 border-t border-hairline pt-3 text-[11.5px] text-muted-foreground">
              <LockSimple weight="light" className="size-3.5" />
              The admin role bypasses all permission checks - its grants are not editable.
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

function PermissionToggle({
  code,
  action,
  checked,
  disabled,
  onToggle,
}: {
  code: string;
  action: string;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title={code}
      aria-pressed={checked}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.08em] transition-all duration-200 ease-soft",
        "ring-1 disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "bg-gold/[0.10] text-gold-deep ring-gold/30"
          : "bg-surface/40 text-muted-foreground ring-hairline hover:text-foreground",
      )}
    >
      {checked ? (
        <Check weight="light" className="size-3" />
      ) : (
        <span className="size-1.5 rounded-full bg-current opacity-40" />
      )}
      {action}
    </button>
  );
}

function prettify(s: string): string {
  return s.replace(/_/g, " ");
}