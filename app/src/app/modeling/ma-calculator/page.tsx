import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { Badge } from "@/components/brand/badge";
import { Button } from "@/components/brand/button";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
import { MaCalculator } from "./ma-calculator-lazy";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/modeling"
        backLabel="Modeling"
        crumb="M&A calculator"
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/modeling">Library</Link>
          </Button>
        }
      />
      <PageHeader
        title="M&A accretion"
        description="Sources & uses, goodwill bridge, pro-forma EPS, deal IRR."
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
          <Badge variant="neutral">IFRS 3 / Ind AS 103</Badge>
          <Badge variant="neutral">Run-rate accretion</Badge>
          <Badge variant="neutral">Screening</Badge>
      </div>
      <MaCalculator />
    </PageShell>
  );
}
