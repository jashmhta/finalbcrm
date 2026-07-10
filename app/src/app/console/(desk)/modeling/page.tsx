import Link from "next/link";

import { requireUser, can } from "@/lib/rbac";
import { listModels } from "@/features/modeling/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modeling" };

export default async function ConsoleModelingPage() {
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

  const { rows, total } = await listModels({ user, limit: 40 });

  return (
    <div>
      <CPageHeader
        eyebrow="Workspace"
        title="Financial models"
        description={`${total} models · bond, LBO, M&A, scenario.`}
      />
      {rows.length === 0 ? (
        <CEmpty title="No models" body="Saved models appear when analysts create them." />
      ) : (
        <div className="space-y-2">
          {rows.map((m) => (
            <Link
              key={m.financialModelId}
              href={`/console/modeling/${m.financialModelId}`}
              className="block"
            >
              <CCard className="flex items-center justify-between gap-2 p-3 transition-colors hover:bg-[var(--c-surface)]">
                <div>
                  <p className="text-[13px] font-semibold text-[var(--c-ink)]">
                    {m.dealName ?? m.partyName ?? m.modelType}
                  </p>
                  <p className="text-[12px] text-[var(--c-ink-3)]">
                    {m.modelType}
                    {m.dealCode ? ` · ${m.dealCode}` : ""}
                    {m.version != null ? ` · v${m.version}` : ""}
                  </p>
                </div>
                {m.scenarioTag ? (
                  <CBadge tone="neutral">{m.scenarioTag}</CBadge>
                ) : null}
              </CCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
