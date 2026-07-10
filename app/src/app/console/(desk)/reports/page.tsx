import Link from "next/link";

import { requireUser } from "@/lib/rbac";
import { getReportsHubKpis } from "@/features/reports/queries";
import { canUseCsvExport } from "@/features/reports/exportAccess";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard, CKpi } from "@/console/primitives/card";
import { formatCrorePlain, inrToCrore } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

const SUPER_EXPORT_PACKS: {
  title: string;
  desc: string;
  items: { kind: string; label: string }[];
}[] = [
  {
    title: "Clients & book",
    desc: "Master ledger exports (brand-scoped to your super visibility).",
    items: [
      { kind: "clients", label: "Clients (full book)" },
      { kind: "parties", label: "Parties (list view)" },
      { kind: "kyc", label: "KYC records" },
      { kind: "documents", label: "Documents index" },
    ],
  },
  {
    title: "Pipeline & coverage",
    desc: "Mandates, leads-adjacent reports, and touch history.",
    items: [
      { kind: "deals", label: "Mandates / deals" },
      { kind: "pipeline", label: "Pipeline report" },
      { kind: "interactions", label: "Interactions" },
      { kind: "tasks", label: "Tasks" },
    ],
  },
  {
    title: "Finance & compliance",
    desc: "Revenue, credit, and compliance packs.",
    items: [
      { kind: "revenue", label: "Revenue" },
      { kind: "credit-report", label: "Credit report" },
      { kind: "credit", label: "Credit analyses" },
      { kind: "compliance-kyc", label: "Compliance KYC" },
    ],
  },
];

export default async function ConsoleReportsPage() {
  const user = await requireUser();
  const kpis = await getReportsHubKpis(user);
  const canExport = canUseCsvExport(user);

  return (
    <div>
      <CPageHeader
        eyebrow="Insights"
        title="Reports & export"
        description={
          canExport
            ? "Live boards plus organized super-admin CSV packs. Employees never export."
            : "Live boards. CSV export is super_admin only (CEO rule)."
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <CKpi label="Pipeline deals" value={String(kpis.pipelineDealCount)} />
        <CKpi label="Open pipeline" value={String(kpis.pipelineOpenCount)} />
        <CKpi
          label="Target exposure"
          value={formatCrorePlain(
            inrToCrore(kpis.pipelineTargetExposure) ||
              kpis.pipelineTargetExposure,
          )}
        />
        <CKpi label="KYC due soon" value={String(kpis.kycDueSoon)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/console/deals", label: "Mandates board", desc: "Live deal stages" },
          { href: "/console/leads", label: "Leads funnel", desc: "BANT → win" },
          { href: "/console/credit", label: "Credit book", desc: "Analyses & ratings" },
          {
            href: "/console/compliance/kyc",
            label: "KYC queue",
            desc: "Compliance board",
          },
          { href: "/console/portfolio", label: "Portfolio", desc: "Exposure & limits" },
          {
            href: "/console/parties/import",
            label: "Import clients",
            desc: "CSV templates (employees)",
          },
        ].map((x) => (
          <Link key={x.href} href={x.href}>
            <CCard className="h-full transition-transform hover:-translate-y-0.5">
              <p className="text-[14px] font-semibold">{x.label}</p>
              <p className="mt-1 text-[12px] text-[var(--c-ink-3)]">{x.desc}</p>
            </CCard>
          </Link>
        ))}
      </div>

      {canExport ? (
        <div className="mt-6 space-y-4">
          <h2 className="text-[14px] font-semibold text-[var(--c-ink)]">
            Super-admin data export
          </h2>
          <p className="text-[12px] text-[var(--c-ink-3)]">
            Organized packs — download each module as UTF-8 CSV (Excel-safe).
            Scope follows your brand: firm-wide supers see all; Capital/Bonds
            supers export their book + shared.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {SUPER_EXPORT_PACKS.map((pack) => (
              <CCard key={pack.title} className="space-y-3">
                <div>
                  <h3 className="text-[13px] font-semibold">{pack.title}</h3>
                  <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">
                    {pack.desc}
                  </p>
                </div>
                <ul className="space-y-2 text-[13px]">
                  {pack.items.map((item) => (
                    <li key={item.kind}>
                      <a
                        className="font-medium text-[var(--c-accent)] underline-offset-2 hover:underline"
                        href={`/reports/export?kind=${item.kind}`}
                      >
                        ↓ {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </CCard>
            ))}
          </div>
        </div>
      ) : (
        <CCard className="mt-6">
          <p className="text-[13px] text-[var(--c-ink-2)]">
            CSV / bulk export is restricted to <strong>super_admin</strong>. You
            can still import clients into your own book via{" "}
            <Link
              href="/console/parties/import"
              className="text-[var(--c-accent)] underline-offset-2 hover:underline"
            >
              Import clients
            </Link>
            .
          </p>
        </CCard>
      )}
    </div>
  );
}
