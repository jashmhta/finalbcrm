"use client";

// Admin → Users - client view layer.
//
// A premium data table of every app_user with their roles / desk / active /
// last-login, plus a "Create user" dialog and per-row "Edit user" +
// "Deactivate user" actions. All mutations submit to the admin server actions
// via useActionState; the dialog closes + revalidates on success.
//
// The forms use the project's BezelInput / BezelSelect helpers (a11y +
// 44px mobile tap targets + the double-bezel field treatment). Role
// multi-select is a checkbox grid (the role catalogue is small - 6 roles - so
// a checkbox grid is faster + more legible than a multi-select dropdown).
// Barrier-clearance tags are a comma-separated text input (free-form UUID
// list; the RLS predicate compares barrier_id::text against app.wall text[]).
//
// Mount-based motion; primary content renders VISIBLE on first paint.

import * as React from "react";
import { useActionState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  X,
  Plus,
  ArrowRight,
  CircleNotch,
  PencilSimple,
  LockSimple,
  ShieldCheck,
  ShieldWarning,
  Users as UsersIcon,
  Fingerprint,
  EnvelopeSimple,
  ArrowFatDown,
  SealCheck,
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type { AdminUserRow } from "@/features/admin/queries";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CommandBar,
  Eyebrow,
  EmptyState,
  IconTile,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type Density,
} from "@/components/brand";
import {
  createUser,
  updateUser,
  deactivateUser,
  type CreateUserState,
  type UpdateUserState,
  type DeactivateUserState,
} from "@/features/admin/actions";

const EASE = [0.32, 0.72, 0, 1] as const;

export interface UsersManagerViewProps {
  users: AdminUserRow[];
  roles: { roleId: string; name: string }[];
  desks: string[];
  currentUserId: string;
}

export function UsersManagerView({
  users,
  roles,
  desks,
  currentUserId,
}: UsersManagerViewProps) {
  const [search, setSearch] = React.useState("");
  const [deskFilter, setDeskFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [density, setDensity] = React.useState<Density>("comfortable");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        const hay = `${u.email} ${u.roles.map((r) => r.name).join(" ")} ${u.desk ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (deskFilter && u.desk !== deskFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "inactive" && u.isActive) return false;
      if (statusFilter === "locked" && !(u.lockedUntil && u.lockedUntil > new Date())) return false;
      if (statusFilter === "mfa" && !u.mfaEnabled) return false;
      return true;
    });
  }, [users, search, deskFilter, statusFilter]);

  const activeCount = users.filter((u) => u.isActive).length;
  const mfaCount = users.filter((u) => u.mfaEnabled).length;

  return (
    <div className="flex flex-col gap-4">
      <CommandBar
        label={`${users.length} users`}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by email, role, desk…"
        density={density}
        onDensityChange={setDensity}
        filters={
          <>
            <FilterSelect
              value={deskFilter}
              onChange={setDeskFilter}
              options={[{ value: "", label: "All desks" }, ...desks.map((d) => ({ value: d, label: prettify(d) }))]}
              ariaLabel="Filter by desk"
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "All status" },
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
                { value: "locked", label: "Locked" },
                { value: "mfa", label: "MFA enrolled" },
              ]}
              ariaLabel="Filter by status"
            />
          </>
        }
        actions={
          <>
            <span className="hidden items-center gap-3 text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:inline-flex">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck weight="light" className="size-3.5 text-emerald-500" />
                <span className="nums tabular-nums">{activeCount} active</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint weight="light" className="size-3.5" />
                <span className="nums tabular-nums">{mfaCount} MFA</span>
              </span>
            </span>
            <CreateUserDialog roles={roles} desks={desks} />
          </>
        }
      />

      <Card>
        <CardBody className="p-0">
          <Table density={density}>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="hidden md:table-cell">Desk</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Last login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={<UsersIcon weight="light" />}
                      title="No users match."
                      hint={users.length === 0 ? "Create the first user to get started." : "Adjust the filters or search."}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const isLocked = !!(u.lockedUntil && u.lockedUntil > new Date());
                  const isSelf = u.userId === currentUserId;
                  return (
                    <TableRow key={u.userId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <IconTile size={20} tone="neutral" icon={EnvelopeSimple} />
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{u.email}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {isSelf ? "you" : u.mfaEnabled ? "MFA on" : "MFA off"}
                              {isLocked ? " · locked" : ""}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.length === 0 ? (
                            <span className="text-[12px] italic text-muted-foreground">no role</span>
                          ) : (
                            u.roles.map((r) => (
                              <Badge key={r.roleId} variant={r.name === "admin" ? "gold" : "neutral"}>
                                {r.name}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {u.desk ? prettify(u.desk) : "-"}
                      </TableCell>
                      <TableCell>
                        <UserStatusBadge active={u.isActive} locked={isLocked} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell nums tabular-nums text-muted-foreground">
                        {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <EditUserDialog
                            user={u}
                            roles={roles}
                            desks={desks}
                            isSelf={isSelf}
                          />
                          <DeactivateUserButton
                            userId={u.userId}
                            email={u.email}
                            isActive={u.isActive}
                            isSelf={isSelf}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function UserStatusBadge({ active, locked }: { active: boolean; locked: boolean }) {
  if (locked) {
    return (
      <Badge variant="down">
        <LockSimple weight="light" className="size-3" />
        Locked
      </Badge>
    );
  }
  if (active) {
    return (
      <Badge variant="emerald">
        <ShieldCheck weight="light" className="size-3" />
        Active
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      <ShieldWarning weight="light" className="size-3" />
      Inactive
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Create user dialog
// ---------------------------------------------------------------------------

function CreateUserDialog({
  roles,
  desks,
}: {
  roles: { roleId: string; name: string }[];
  desks: string[];
}) {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(
    createUser,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [desk, setDesk] = React.useState<string>(desks[0] ?? "");
  const [isActive, setIsActive] = React.useState<string>("true");
  const [barrierCsv, setBarrierCsv] = React.useState("");
  const [selectedRoles, setSelectedRoles] = React.useState<Set<string>>(new Set());

  // Close on success (userId returned).
  React.useEffect(() => {
    if (state?.userId && open) {
      setOpen(false);
      setEmail("");
      setBarrierCsv("");
      setSelectedRoles(new Set());
      setDesk(desks[0] ?? "");
      setIsActive("true");
    }
  }, [state, open, desks]);

  function toggleRole(name: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="primary-gold"
            size="md"
            leadingIcon={<Plus weight="light" className="size-4" />}
          >
            Create user
          </Button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[560px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
        )}
      >
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Identity</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light leading-tight tracking-[-0.02em] text-foreground">
                    Create user
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Provision an app_user with a bcrypt-hashed password and role grants. The new user can sign in immediately.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]"
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              <Field label="Email" htmlFor="email" required>
                <BezelInput
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="firstname@binarycapital.in"
                />
              </Field>

              <Field label="Password" htmlFor="password" required hint="min 8 chars">
                <BezelInput
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Desk" htmlFor="desk">
                  <BezelSelect
                    id="desk"
                    name="desk"
                    value={desk}
                    onChange={setDesk}
                    options={desks}
                  />
                </Field>
                <Field label="Active" htmlFor="isActive">
                  <BezelSelect
                    id="isActive"
                    name="isActive"
                    value={isActive}
                    onChange={setIsActive}
                    options={["true", "false"]}
                    renderOption={(o) => (o === "true" ? "Active" : "Inactive")}
                  />
                </Field>
              </div>

              <Field
                label="Barrier clearance"
                htmlFor="barrierClearance"
                hint="comma-separated UUIDs (optional)"
              >
                <BezelInput
                  id="barrierClearance"
                  name="barrierClearance"
                  value={barrierCsv}
                  onChange={(e) => setBarrierCsv(e.target.value)}
                  placeholder="uuid,uuid,…"
                />
                {/* Hidden inputs - one per tag (the action reads getAll). */}
                {barrierCsv
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((tag, i) => (
                    <input key={i} type="hidden" name="barrierClearance" value={tag} />
                  ))}
              </Field>

              <RoleCheckboxGrid
                roles={roles}
                selected={selectedRoles}
                onToggle={toggleRole}
              />
              {/* Hidden inputs - one per selected role name. */}
              {Array.from(selectedRoles).map((name) => (
                <input key={name} type="hidden" name="roleNames" value={name} />
              ))}

              {state?.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
                >
                  {state.error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 border-t border-hairline pt-5">
                <DialogClose
                  render={
                    <Button variant="ghost" size="md" type="button">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-gold"
                  size="md"
                  disabled={pending}
                  leadingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-4 animate-spin" />
                    ) : undefined
                  }
                  trailingIcon={
                    pending ? undefined : (
                      <ArrowRight weight="light" className="size-4" />
                    )
                  }
                >
                  {pending ? "Creating…" : "Create user"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Edit user dialog
// ---------------------------------------------------------------------------

function EditUserDialog({
  user,
  roles,
  desks,
  isSelf,
}: {
  user: AdminUserRow;
  roles: { roleId: string; name: string }[];
  desks: string[];
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState<UpdateUserState, FormData>(
    updateUser,
    undefined,
  );
  const [open, setOpen] = React.useState(false);
  const [desk, setDesk] = React.useState<string>(user.desk ?? desks[0] ?? "");
  const [isActive, setIsActive] = React.useState<string>(user.isActive ? "true" : "false");
  const [barrierCsv, setBarrierCsv] = React.useState<string>(
    (user.barrierClearance ?? []).join(", "),
  );
  const [selectedRoles, setSelectedRoles] = React.useState<Set<string>>(
    new Set(user.roles.map((r) => r.name)),
  );

  // Reset state when the dialog opens (so re-opening after a stale session
  // shows the user's current profile, not the last-edited draft).
  React.useEffect(() => {
    if (open) {
      setDesk(user.desk ?? desks[0] ?? "");
      setIsActive(user.isActive ? "true" : "false");
      setBarrierCsv((user.barrierClearance ?? []).join(", "));
      setSelectedRoles(new Set(user.roles.map((r) => r.name)));
    }
  }, [open, user, desks]);

  React.useEffect(() => {
    if (state?.ok && open) setOpen(false);
  }, [state, open]);

  function toggleRole(name: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Edit ${user.email}`}
            className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]"
          >
            <PencilSimple weight="light" className="size-4" />
          </button>
        }
      />
      <DialogContent
        className={cn(
          "max-h-[90vh] max-w-[560px] gap-0 overflow-y-auto rounded-[1.5rem] border-0 bg-transparent p-0 ring-0",
        )}
      >
        <div className="rounded-[1.5rem] bg-white/[0.02] p-1.5 ring-1 ring-hairline shadow-floating">
          <div className="bezel-hi overflow-hidden rounded-[calc(1.5rem-0.375rem)] bg-surface">
            <form action={action} className="flex flex-col gap-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <Eyebrow dot>Edit user</Eyebrow>
                  <DialogTitle className="text-[1.5rem] font-light leading-tight tracking-[-0.02em] text-foreground">
                    {user.email}
                  </DialogTitle>
                  <DialogDescription className="text-[13px] text-muted-foreground">
                    Update desk, barrier clearance, active state, password, or role grants. Leave password blank to keep the current hash.
                  </DialogDescription>
                </div>
                <DialogClose
                  render={
                    <button
                      type="button"
                      aria-label="Close"
                      className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-foreground/5 hover:text-foreground active:scale-[0.96]"
                    />
                  }
                >
                  <X weight="light" className="size-4" />
                </DialogClose>
              </div>

              <input type="hidden" name="userId" value={user.userId} />
              {/* Sentinels for updateUser omit-if-absent parser — full desk edit
                  always intends to sync roles + barriers (even when empty). */}
              <input type="hidden" name="rolesSync" value="1" />
              <input type="hidden" name="barriersSync" value="1" />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Desk" htmlFor="desk">
                  <BezelSelect
                    id="desk"
                    name="desk"
                    value={desk}
                    onChange={setDesk}
                    options={desks}
                  />
                </Field>
                <Field label="Active" htmlFor="isActive">
                  <BezelSelect
                    id="isActive"
                    name="isActive"
                    value={isActive}
                    onChange={setIsActive}
                    options={["true", "false"]}
                    renderOption={(o) => (o === "true" ? "Active" : "Inactive")}
                    disabled={isSelf ? ["false"] : []}
                  />
                  {isSelf ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      You cannot deactivate your own account.
                    </p>
                  ) : null}
                </Field>
              </div>

              <Field
                label="Barrier clearance"
                htmlFor="barrierClearance"
                hint="comma-separated UUIDs"
              >
                <BezelInput
                  id="barrierClearance"
                  name="barrierClearanceCsv"
                  value={barrierCsv}
                  onChange={(e) => setBarrierCsv(e.target.value)}
                  placeholder="uuid,uuid,…"
                />
                {barrierCsv
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((tag, i) => (
                    <input key={i} type="hidden" name="barrierClearance" value={tag} />
                  ))}
              </Field>

              <Field label="New password" htmlFor="password" hint="leave blank to keep current">
                <BezelInput
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
              </Field>

              <RoleCheckboxGrid
                roles={roles}
                selected={selectedRoles}
                onToggle={toggleRole}
              />
              {Array.from(selectedRoles).map((name) => (
                <input key={name} type="hidden" name="roleNames" value={name} />
              ))}

              {state?.error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-down/10 px-3.5 py-2.5 text-[12.5px] font-medium text-down ring-1 ring-down/25"
                >
                  {state.error}
                </p>
              ) : state?.ok ? (
                <p className="rounded-xl bg-emerald-500/10 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400">
                  User updated.
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 border-t border-hairline pt-5">
                <DialogClose
                  render={
                    <Button variant="ghost" size="md" type="button">
                      Cancel
                    </Button>
                  }
                />
                <Button
                  type="submit"
                  variant="primary-emerald"
                  size="md"
                  disabled={pending}
                  leadingIcon={
                    pending ? (
                      <CircleNotch weight="light" className="size-4 animate-spin" />
                    ) : undefined
                  }
                  trailingIcon={
                    pending ? undefined : (
                      <ArrowRight weight="light" className="size-4" />
                    )
                  }
                >
                  {pending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Deactivate user - inline confirmation form (no dialog; a second-tap confirm
// pattern keeps the row action a single click for the common case).
// ---------------------------------------------------------------------------

function DeactivateUserButton({
  userId,
  email,
  isActive,
  isSelf,
}: {
  userId: string;
  email: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState<DeactivateUserState, FormData>(
    deactivateUser,
    undefined,
  );
  const [confirming, setConfirming] = React.useState(false);
  const disabled = !isActive || isSelf;

  React.useEffect(() => {
    if (state?.ok) setConfirming(false);
  }, [state]);

  if (disabled) {
    return (
      <span
        title={
          isSelf
            ? "You cannot deactivate your own account"
            : "User is already inactive"
        }
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground/40 ring-1 ring-hairline/50"
      >
        <LockSimple weight="light" className="size-4" />
      </span>
    );
  }

  if (!confirming) {
    return (
      <button
        type="button"
        aria-label={`Deactivate ${email}`}
        title="Deactivate"
        onClick={() => setConfirming(true)}
        className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground ring-1 ring-hairline transition-all duration-200 ease-soft hover:bg-down/10 hover:text-down active:scale-[0.96]"
      >
        <ShieldWarning weight="light" className="size-4" />
      </button>
    );
  }

  return (
    <form action={action} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-full px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground ring-1 ring-hairline transition-colors hover:text-foreground"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-full bg-down/10 px-3 py-1.5 text-[11px] font-medium text-down ring-1 ring-down/30 transition-all hover:bg-down/20 active:scale-[0.96] disabled:opacity-60"
      >
        {pending ? (
          <CircleNotch weight="light" className="size-3.5 animate-spin" />
        ) : (
          <LockSimple weight="light" className="size-3.5" />
        )}
        Confirm
      </button>
      {state?.error ? (
        <span className="ml-1 text-[11px] text-down">{state.error}</span>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function RoleCheckboxGrid({
  roles,
  selected,
  onToggle,
}: {
  roles: { roleId: string; name: string }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Roles
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {roles.map((r) => {
          const checked = selected.has(r.name);
          const isAdmin = r.name === "admin";
          return (
            <label
              key={r.roleId}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-xl bg-foreground/[0.02] px-3 py-2.5 ring-1 ring-hairline/70 transition-all duration-200 ease-soft",
                checked && "bg-gold/[0.06] ring-gold/40",
              )}
            >
              <span className="relative inline-flex size-4 items-center justify-center">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(r.name)}
                  className={cn(
                    "peer size-4 appearance-none rounded-[5px] bg-foreground/[0.06] ring-1 ring-hairline transition-all duration-200 ease-soft",
                    isAdmin ? "checked:bg-gold checked:ring-gold/60" : "checked:bg-emerald-500 checked:ring-emerald-500/60",
                  )}
                />
                <SealCheck
                  weight="light"
                  className="pointer-events-none absolute size-3 text-on-emerald opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
                />
              </span>
              <span className="flex flex-col">
                <span className="text-[12.5px] font-medium text-foreground">{r.name}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
      >
        {label}
        {required ? <span className="text-gold">*</span> : null}
        {hint ? (
          <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground/70">
            {hint}
          </span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function BezelInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <input
        {...props}
        className={cn(
          "h-10 w-full rounded-[calc(0.75rem-1px)] bg-surface px-3.5 text-[13.5px] text-foreground",
          "placeholder:text-muted-foreground/60 focus:outline-none",
          className,
        )}
      />
    </div>
  );
}

function BezelSelect({
  id,
  name,
  value,
  onChange,
  options,
  renderOption,
  disabled = [],
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  renderOption?: (o: string) => string;
  disabled?: string[];
}) {
  return (
    <div className="group/field rounded-xl bg-foreground/[0.02] p-px ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus-within:ring-hairline">
      <div className="relative flex items-center rounded-[calc(0.75rem-1px)] bg-surface">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled.includes(value)}
          className={cn(
            "h-10 w-full appearance-none rounded-[calc(0.75rem-1px)] bg-transparent px-3.5 pr-8 text-[13.5px] text-foreground",
            "focus:outline-none disabled:opacity-60",
          )}
        >
          {options.map((o) => (
            <option key={o} value={o} disabled={disabled.includes(o)}>
              {renderOption ? renderOption(o) : o.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <ArrowFatDown
          aria-hidden
          weight="light"
          className="pointer-events-none absolute right-3 size-3 text-muted-foreground"
        />
      </div>
      {name ? <input type="hidden" name={name} value={value} /> : null}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="relative flex items-center">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 appearance-none rounded-full bg-foreground/[0.04] px-3.5 pr-8 text-[12px] font-medium text-foreground",
          "ring-1 ring-hairline/70 transition-all duration-200 ease-soft focus:outline-none focus:ring-hairline",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ArrowFatDown
        aria-hidden
        weight="light"
        className="pointer-events-none absolute right-2.5 size-3 text-muted-foreground"
      />
    </div>
  );
}

function prettify(s: string): string {
  return s.replace(/_/g, " ");
}

function relativeTime(v: string | Date | null): string {
  if (!v) return "never";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "never";
  const diff = Math.max(0, Date.now() - d.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}