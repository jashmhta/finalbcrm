import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { Badge } from "@/components/brand/badge";
import { Button } from "@/components/brand/button";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
import { ScenarioDesk } from "./scenario-lazy";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/modeling"
        backLabel="Modeling"
        crumb="Scenario"
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/modeling">Library</Link>
          </Button>
        }
      />
      <PageHeader
        title="Scenario desk"
        description="Best / base / worst drivers with a two-variable sensitivity grid."
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
          <Badge variant="neutral">5 model types</Badge>
          <Badge variant="neutral">Best / Base / Worst</Badge>
          <Badge variant="neutral">Sensitivity</Badge>
      </div>
      <ScenarioDesk />
    </PageShell>
  );
}
