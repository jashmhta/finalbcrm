import { requireUser, can } from "@/lib/rbac";
import { listIntegrations } from "@/features/integrations/registry";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { RunIntegrationButton } from "./run-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Integrations" };

export default async function ConsoleIntegrationsPage() {
  const user = await requireUser();
  const allowed =
    can(user, "read", "integration") ||
    can(user, "run", "integration") ||
    can(user, "manage", "user");
  if (!allowed) {
    return (
      <CEmpty
        title="No integrations access"
        body="Ask an admin for integration:read or integration:run."
        actionLabel="Home"
        actionHref="/console"
      />
    );
  }

  const items = listIntegrations();
  const canRun = can(user, "run", "integration") || can(user, "manage", "user");

  return (
    <div>
      <CPageHeader
        eyebrow="Platform"
        title="Integrations"
        description="India market adapters - mock by default; live when credentials present."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((a) => (
          <CCard key={a.id} className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[14px] font-semibold">{a.name}</p>
                <p className="mt-1 text-[12px] text-[var(--c-ink-3)]">
                  {a.description}
                </p>
              </div>
              <CBadge tone={a.status === "ready" ? "ok" : "neutral"}>
                {a.status}
              </CBadge>
            </div>
            <p className="text-[11px] text-[var(--c-ink-3)]">
              {a.category} · {a.phase}
            </p>
            {canRun ? <RunIntegrationButton id={a.id} /> : null}
          </CCard>
        ))}
      </div>
    </div>
  );
}
