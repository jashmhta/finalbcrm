import type { ReactNode } from "react";

import { requireUser } from "@/lib/rbac";
import { PortfolioSubNav } from "./_components/portfolio-sub-nav";
import { PageShell, PageHeader } from "@/components/brand/page-shell";

/**
 * Portfolio & Exposure Analytics - shared layout.
 * Stripe-day shell + sub-nav; child pages own KPIs/charts.
 */
export const dynamic = "force-dynamic";

export default async function PortfolioLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();

  return (
    <PageShell>
      <PageHeader
        title="Portfolio"
        description="Exposure by sector, issuer, rating, and tenor — concentration, limits, and risk."
      />
      <PortfolioSubNav />
      <div className="mt-6">{children}</div>
    </PageShell>
  );
}
