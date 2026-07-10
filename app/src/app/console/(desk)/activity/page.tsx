import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { isSuperAdmin } from "@/lib/org";
import {
  getCoverageFeed,
  listStaffOptions,
} from "@/features/activity/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coverage activity" };

function fmtWhen(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ConsoleActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    staff?: string;
    channel?: string;
    days?: string;
  }>;
}) {
  const user = await requireUser();
  const allowed =
    isSuperAdmin(user.roles) ||
    user.roles.includes("admin") ||
    can(user, "read_all", "audit") ||
    can(user, "manage", "user");
  if (!allowed) {
    redirect("/console");
  }

  const sp = await searchParams;
  const staff = sp.staff?.trim() || undefined;
  const channel = sp.channel?.trim() || undefined;
  const days = Math.min(Math.max(Number(sp.days) || 30, 1), 365);

  const [feed, staffOpts] = await Promise.all([
    getCoverageFeed(user, {
      ownerUserId: staff,
      channel,
      days,
      pageSize: 50,
    }),
    listStaffOptions(user),
  ]);

  return (
    <div className="space-y-6">
      <CPageHeader
        eyebrow="Supervision"
        title="Coverage activity"
        description="See every employee interaction and audit move across the firm book. Super-admin only."
      />

      <form
        method="get"
        action="/console/activity"
        className="grid gap-2 rounded-[var(--c-radius-lg)] bg-[var(--c-surface)] p-3 ring-1 ring-[var(--c-line)] sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Staff
          <select
            name="staff"
            defaultValue={staff ?? ""}
            className="h-10 rounded-[var(--c-radius)] bg-[var(--c-bg)] px-2 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            <option value="">All staff</option>
            {staffOpts.map((s) => (
              <option key={s.userId} value={s.userId}>
                {s.email}
                {s.desk ? ` · ${s.desk}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Channel
          <select
            name="channel"
            defaultValue={channel ?? ""}
            className="h-10 rounded-[var(--c-radius)] bg-[var(--c-bg)] px-2 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            <option value="">All channels</option>
            <option value="call">Call</option>
            <option value="meeting">Meeting</option>
            <option value="email">Email</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-[11px] font-medium text-[var(--c-ink-2)]">
          Lookback (days)
          <select
            name="days"
            defaultValue={String(days)}
            className="h-10 rounded-[var(--c-radius)] bg-[var(--c-bg)] px-2 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            <option value="7">7</option>
            <option value="30">30</option>
            <option value="90">90</option>
            <option value="180">180</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="h-10 w-full rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)]"
          >
            Apply
          </button>
        </div>
      </form>

      <section>
        <h2 className="mb-2 text-[13px] font-semibold text-[var(--c-ink)]">
          Staff coverage
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {feed.coverage.map((c) => (
            <CCard key={c.userId} className="p-3">
              <p className="truncate text-[13px] font-semibold text-[var(--c-ink)]">
                {c.email}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">
                {c.desk?.replace(/_/g, " ") ?? "no desk"}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-1 text-[12px]">
                <div>
                  <dt className="text-[var(--c-ink-3)]">Interactions</dt>
                  <dd className="font-mono font-semibold">{c.interactionCount}</dd>
                </div>
                <div>
                  <dt className="text-[var(--c-ink-3)]">Assigned parties</dt>
                  <dd className="font-mono font-semibold">{c.assignedParties}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[var(--c-ink-3)]">Last interaction</dt>
                  <dd>{fmtWhen(c.lastInteractionAt)}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[var(--c-ink-3)]">Last login</dt>
                  <dd>{fmtWhen(c.lastLoginAt)}</dd>
                </div>
              </dl>
              <Link
                href={`/console/activity?staff=${c.userId}&days=${days}`}
                className="mt-2 inline-block text-[12px] font-medium text-[var(--c-accent)]"
              >
                View feed →
              </Link>
            </CCard>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-[var(--c-ink)]">
            Interactions ({feed.interactions.total})
          </h2>
          {feed.interactions.rows.length === 0 ? (
            <CEmpty
              title="No interactions in range"
              body="Staff logs appear here as they call, meet, or note clients."
            />
          ) : (
            <ul className="space-y-2">
              {feed.interactions.rows.map((r) => (
                <li key={r.interactionId}>
                  <Link href={`/console/interactions/${r.interactionId}`}>
                    <CCard className="p-3 transition-colors hover:bg-[var(--c-surface-2)]/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <CBadge tone="info">{r.channel ?? "note"}</CBadge>
                        {r.containsMnpi ? (
                          <CBadge tone="bad">MNPI</CBadge>
                        ) : null}
                        <span className="text-[11px] text-[var(--c-ink-3)]">
                          {fmtWhen(r.occurredAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] font-semibold text-[var(--c-ink)]">
                        {r.subject ?? "Untitled interaction"}
                      </p>
                      <p className="text-[12px] text-[var(--c-ink-3)]">
                        {r.ownerEmail ?? "unassigned staff"}
                        {r.partyName ? ` · ${r.partyName}` : ""}
                        {r.dealCode ? ` · ${r.dealCode}` : ""}
                      </p>
                    </CCard>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-[var(--c-ink)]">
            Audit moves ({feed.audit.total})
          </h2>
          {feed.audit.rows.length === 0 ? (
            <CEmpty
              title="No audit events"
              body="Creates, assigns, role changes, and exports are listed here."
            />
          ) : (
            <ul className="space-y-2">
              {feed.audit.rows.map((a) => (
                <li key={a.auditLogId}>
                  <CCard className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CBadge tone="neutral">{a.operation}</CBadge>
                      <CBadge tone="info">{a.entityType}</CBadge>
                      <span className="text-[11px] text-[var(--c-ink-3)]">
                        {fmtWhen(a.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-[var(--c-ink-2)]">
                      {a.actorEmail ?? "system"}
                      {a.fieldName ? ` · ${a.fieldName}` : ""}
                    </p>
                    {a.entityId ? (
                      <p className="mt-0.5 font-mono text-[11px] text-[var(--c-ink-3)]">
                        {a.entityId.slice(0, 13)}…
                      </p>
                    ) : null}
                  </CCard>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
