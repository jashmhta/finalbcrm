import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { Badge } from "@/components/brand/badge";
import { Button } from "@/components/brand/button";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
import { LboCalculator } from "./lbo-calculator-lazy";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/modeling"
        backLabel="Modeling"
        crumb="LBO calculator"
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/modeling">Library</Link>
          </Button>
        }
      />
      <PageHeader
        title="LBO returns"
        description="Sources & uses, multi-tranche debt, sponsor IRR/MOIC, entry×exit grid."
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
          <Badge variant="neutral">Multi-tranche</Badge>
          <Badge variant="neutral">Cash sweep</Badge>
          <Badge variant="neutral">Hold-to-exit</Badge>
      </div>
      <LboCalculator />
    </PageShell>
  );
}
