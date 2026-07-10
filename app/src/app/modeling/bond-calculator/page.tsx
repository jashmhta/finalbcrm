import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { Badge } from "@/components/brand/badge";
import { Button } from "@/components/brand/button";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";
import { BondCalculator } from "./bond-calculator-lazy";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireUser();
  return (
    <PageShell wide>
      <DetailTopBar
        backHref="/modeling"
        backLabel="Modeling"
        crumb="Bond calculator"
        action={
          <Button asChild variant="secondary-hairline" size="sm">
            <Link href="/modeling">Library</Link>
          </Button>
        }
      />
      <PageHeader
        title="Bond pricing"
        description="Indian conventions by default — ACT/365, price↔YTM, duration, DV01, G-spread."
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
          <Badge variant="neutral">ACT/365</Badge>
          <Badge variant="neutral">Annual / Semi-annual</Badge>
          <Badge variant="neutral">T+1</Badge>
          <Badge variant="neutral">FIMMDA</Badge>
      </div>
      <BondCalculator />
    </PageShell>
  );
}
