import Link from "next/link";
import {
  ChatsCircle,
  EnvelopeSimple,
  Phone,
  UsersThree,
  WhatsappLogo,
} from "@phosphor-icons/react/ssr";

import { requireUser, can } from "@/lib/rbac";
import { listInteractions } from "@/features/interactions/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { ListSearch } from "@/console/patterns/list-search";
import { NewInteractionForm } from "./new-form";

function ChannelIcon({ channel }: { channel: string | null | undefined }) {
  const c = (channel ?? "").toLowerCase();
  const cls = "size-4 shrink-0";
  if (c === "whatsapp")
    return <WhatsappLogo className={cls} weight="fill" />;
  if (c === "call" || c === "phone")
    return <Phone className={cls} weight="fill" />;
  if (c === "email")
    return <EnvelopeSimple className={cls} weight="fill" />;
  if (c === "meeting")
    return <UsersThree className={cls} weight="fill" />;
  return <ChatsCircle className={cls} weight="fill" />;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Interactions" };

export default async function ConsoleInteractionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!can(user, "read", "interaction") && !can(user, "create", "interaction")) {
    return (
      <CEmpty
        title="No interactions access"
        body="You need interaction:read."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const { rows, total } = await listInteractions({
    user,
    page: 1,
    pageSize: 40,
    filters: q ? { q } : undefined,
  });

  return (
    <div>
      <CPageHeader
        eyebrow="Workspace"
        title="Interactions"
        description={`${total} logged touches in scope.`}
      />
      <ListSearch
        action="/console/interactions"
        q={q}
        placeholder="Search subject, party, next action…"
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {rows.length === 0 ? (
            <CEmpty title="No interactions" body="Log a call, meeting, or WhatsApp." />
          ) : (
            rows.map((r) => (
              <Link
                key={r.interactionId}
                href={`/console/interactions/${r.interactionId}`}
                className="block"
              >
                <CCard className="p-3 transition-colors hover:bg-[var(--c-surface)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <CBadge tone="info" className="inline-flex items-center gap-1">
                      <ChannelIcon channel={r.channel} />
                      {r.channel}
                    </CBadge>
                    <CBadge tone="neutral">{r.direction}</CBadge>
                    <span className="text-[11px] text-[var(--c-ink-3)]">
                      {r.occurredAt
                        ? new Date(r.occurredAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                          })
                        : "—"}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-[var(--c-ink)]">
                    {r.subject ?? "Untitled"}
                  </p>
                  <p className="text-[12px] text-[var(--c-ink-3)]">
                    {r.partyName ?? "—"}
                    {r.dealCode ? ` · ${r.dealCode}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--c-accent)]">
                    Open interaction →
                  </p>
                </CCard>
              </Link>
            ))
          )}
        </div>
        {can(user, "create", "interaction") ? (
          <CCard>
            <h2 className="mb-3 text-[13px] font-semibold">Log interaction</h2>
            <NewInteractionForm />
          </CCard>
        ) : null}
      </div>
    </div>
  );
}
