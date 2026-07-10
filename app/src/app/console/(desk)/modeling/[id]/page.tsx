import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser, can } from "@/lib/rbac";
import { getModelDetail } from "@/features/modeling/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Model" };

export default async function ConsoleModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "model") && !can(user, "read", "credit")) {
    return (
      <CEmpty
        title="No modeling access"
        body="You need model:read or credit:read."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const { id } = await params;
  const detail = await getModelDetail(id, user);
  if (!detail) notFound();

  const m = detail.model;
  const outputs =
    m.outputs && typeof m.outputs === "object"
      ? (m.outputs as Record<string, unknown>)
      : {};
  const outputEntries = Object.entries(outputs).slice(0, 24);

  return (
    <div>
      <CPageHeader
        eyebrow={`Model · ${m.modelType}`}
        title={detail.dealName ?? detail.partyName ?? m.modelType}
        description={
          detail.dealCode
            ? `${detail.dealCode}${m.version != null ? ` · v${m.version}` : ""}`
            : m.version != null
              ? `v${m.version}`
              : undefined
        }
        actions={
          <Link
            href="/console/modeling"
            className="inline-flex h-10 items-center rounded-[var(--c-radius-pill)] px-4 text-[13px] ring-1 ring-[var(--c-line-strong)]"
          >
            Back
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <CBadge tone="accent">{m.modelType}</CBadge>
        {m.scenarioTag ? <CBadge tone="neutral">{m.scenarioTag}</CBadge> : null}
        {m.currencyCode ? <CBadge tone="info">{m.currencyCode}</CBadge> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CCard className="lg:col-span-2">
          <h2 className="mb-3 text-[13px] font-semibold">Outputs</h2>
          {outputEntries.length === 0 ? (
            <p className="text-[13px] text-[var(--c-ink-3)]">
              No computed outputs stored on this version.
            </p>
          ) : (
            <dl className="grid gap-2 sm:grid-cols-2 text-[13px]">
              {outputEntries.map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between gap-2 border-b border-[var(--c-line)] pb-1.5"
                >
                  <dt className="text-[var(--c-ink-3)]">{k}</dt>
                  <dd className="font-mono text-right">
                    {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CCard>
        <CCard>
          <h2 className="mb-3 text-[13px] font-semibold">Next actions</h2>
          <ul className="space-y-2 text-[13px]">
            {m.partyId ? (
              <li>
                <Link
                  className="text-[var(--c-accent)]"
                  href={`/console/parties/${m.partyId}`}
                >
                  Open party
                </Link>
              </li>
            ) : null}
            {m.dealId ? (
              <li>
                <Link
                  className="text-[var(--c-accent)]"
                  href={`/console/deals/${m.dealId}`}
                >
                  Open deal
                </Link>
              </li>
            ) : null}
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/credit">
                Credit desk
              </Link>
            </li>
            <li>
              <Link className="text-[var(--c-accent)]" href="/console/modeling">
                All models
              </Link>
            </li>
          </ul>
        </CCard>
      </div>
    </div>
  );
}
