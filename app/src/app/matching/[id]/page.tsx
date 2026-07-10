import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@/components/brand/icons";
import { requireUser } from "@/lib/rbac";
import { getMatchMatrix, type MatchMatrix } from "@/features/matching/queries";
import { Button } from "@/components/brand";
import { SectionHeading } from "@/components/brand/text";
import { MatchMatrixView } from "./match-matrix-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// The detailed match view for a specific issuer: the full match matrix
// (issuer criteria × all matching investors), the warm-intro paths, and the
// Send-to-deal CTA. DB-backed - never prerender.
export const dynamic = "force-dynamic";

export default async function MatchingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const matrix: MatchMatrix | null = await getMatchMatrix(id, user);
  if (!matrix) notFound();

  const { issuer, investorPool } = matrix;

  return (
    <PageShell>
      <div className="mb-6 flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" leadingIcon={<ArrowLeft weight="light" className="size-4" />}>
          <Link href="/matching">Back to workspace</Link>
        </Button>
      </div>

      <SectionHeading
        display
        eyebrow="Match matrix"
        title={issuer.legalName}
        description={`${issuer.ratingValue ?? "Unrated"} · ${issuer.sectorLabel ?? issuer.sectorCode ?? "Unclassified"} · ${issuer.tenorYears != null ? `${issuer.tenorYears.toFixed(1)}y` : "-"} mandate · ${issuer.targetSizeCrores != null ? `₹${issuer.targetSizeCrores.toFixed(0)} Cr target` : "-"}. ${investorPool} investors scanned, ranked by fit across seven criteria.`}
        className="mb-8"
      />

      <MatchMatrixView matrix={matrix} />
    </PageShell>
  );
}
