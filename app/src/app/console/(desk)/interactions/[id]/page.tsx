import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getInteractionDetail } from "@/features/interactions/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Interaction" };

export default async function ConsoleInteractionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "interaction") && !can(user, "create", "interaction")) {
    return (
      <CEmpty
        title="No interaction access"
        body="You need interaction:read to view this log."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { id } = await params;
  const detail = await getInteractionDetail(id, user);
  if (!detail) notFound();

  const i = detail.interaction;

  return (
    <div>
      <CPageHeader
        eyebrow={`Interaction · ${i.channel ?? "log"}`}
        title={i.subject ?? "Interaction"}
        description={
          detail.partyName
            ? `${detail.partyName}${i.occurredAt ? ` · ${new Date(i.occurredAt).toLocaleString("en-IN")}` : ""}`
            : undefined
        }
        actions={
          <Link
            href="/console/interactions"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            Timeline
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {i.channel ? <CBadge tone="accent">{i.channel}</CBadge> : null}
        {i.direction ? <CBadge tone="neutral">{i.direction}</CBadge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CCard className="lg:col-span-2 space-y-3">
          <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
            <Row k="Party" v={detail.partyName ?? "—"} />
            <Row
              k="Deal"
              v={
                detail.dealCode || detail.dealName
                  ? `${detail.dealCode ?? ""} ${detail.dealName ?? ""}`.trim()
                  : "—"
              }
            />
            <Row k="Contact" v={detail.contactName ?? detail.primaryContactName ?? "—"} />
            <Row
              k="When"
              v={
                i.occurredAt
                  ? new Date(i.occurredAt).toLocaleString("en-IN")
                  : "—"
              }
            />
          </dl>
          {i.body ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--c-ink-2)]">
              {i.body}
            </p>
          ) : (
            <p className="text-[13px] text-[var(--c-ink-3)]">No notes body.</p>
          )}
          {detail.attendees.length > 0 ? (
            <>
              <h2 className="pt-2 text-[13px] font-semibold">Attendees</h2>
              <ul className="divide-y divide-[var(--c-line)] text-[13px]">
                {detail.attendees.map((a) => (
                  <li key={a.interactionAttendeeId} className="py-1.5">
                    {a.contactName}
                    {a.roleAtMeeting ? (
                      <span className="text-[var(--c-ink-3)]">
                        {" "}
                        · {a.roleAtMeeting}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </CCard>

        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold">Next actions</h2>
          <ul className="space-y-2 text-[13px]">
            {i.partyId ? (
              <li>
                <Link
                  className="text-[var(--c-accent)]"
                  href={`/console/parties/${i.partyId}`}
                >
                  Open party
                </Link>
              </li>
            ) : null}
            {i.dealId ? (
              <li>
                <Link
                  className="text-[var(--c-accent)]"
                  href={`/console/deals/${i.dealId}`}
                >
                  Open deal
                </Link>
              </li>
            ) : null}
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/tasks">
                Create follow-up task
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/interactions">
                All interactions
              </Link>
            </li>
          </ul>
        </CCard>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-[var(--c-line)] pb-2 last:border-0">
      <dt className="text-[var(--c-ink-3)]">{k}</dt>
      <dd className="text-right font-medium text-[var(--c-ink)]">{v}</dd>
    </div>
  );
}
