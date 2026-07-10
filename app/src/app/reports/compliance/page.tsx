import { requireUser } from "@/lib/rbac";
import { getComplianceReport } from "@/features/reports/queries";
import { ExportCsvButton } from "@/features/reports";
import {
  Card,
  Reveal,
  SectionHeading,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/brand";
import { ChartCard } from "@/components/brand/chart-theme";
import { Num } from "@/components/brand/money";
import {
  CountBarChart,
  HorizontalBarChart,
  StackedBarChart,
  type ConsentStackPoint,
  type LabelCountPoint,
  type LabelValuePoint,
} from "../_components/report-charts";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// DB-backed aggregate - never prerender.
export const dynamic = "force-dynamic";

export default async function ComplianceReportPage() {
  const user = await requireUser();
  const report = await getComplianceReport(user);
  const { kyc, audit, consent } = report;

  const kycStatusData: LabelCountPoint[] = kyc.byStatus.map((r) => ({
    label: r.statusLabel,
    count: r.count,
  }));
  const auditOpData: LabelValuePoint[] = audit.byOperation.map((r) => ({
    label: r.operation,
    value: r.count,
  }));
  const consentData: ConsentStackPoint[] = consent.byPurpose.map((r) => ({
    label: r.purposeLabel,
    active: r.active,
    withdrawn: r.withdrawn,
  }));

  // fmtDate - coerce a Date OR an ISO string (raw `db.execute` timestamp
  // aggregates come back as strings, not Date objects) to a dd Mon yyyy label.
  const fmtDate = (d: Date | string | null | undefined): string => {
    if (!d) return "-";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  return (
    <PageShell>
      <SectionHeading
        eyebrow="Reports · Compliance"
        title="Compliance report"
        description="KYC / AML status breakdown, the immutable audit-log summary by operation and entity, and DPDP consent status by purpose - the compliance officer's monthly pack. Export the KYC breakdown to CSV."
        className="mb-8"
        action={<ExportCsvButton type="compliance-kyc" />}
        display
      />

      <Reveal y={10} duration={0.55} noBlur>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="KYC records" value={kyc.total} preset="int" />
          <StatCard
            label="KYC due ≤30d"
            value={kyc.dueSoon}
            preset="int"
            tone="down"
          />
          <StatCard
            label="Audit events"
            value={audit.total}
            preset="int"
          />
          <StatCard
            label="Active consents"
            value={consent.active}
            preset="int"
            tone="up"
          />
        </div>
      </Reveal>

      {/* KYC status chart + consent stacked chart. */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <Reveal y={14} delay={0.05}>
          <ChartCard
            title="KYC status breakdown"
            description="Customer-due-diligence lifecycle - approved, pending, in review, docs requested."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              <CountBarChart data={kycStatusData} valueLabel="Records" />
            </div>
          </ChartCard>
        </Reveal>
        <Reveal y={14} delay={0.1}>
          <ChartCard
            title="DPDP consent by purpose"
            description="Active vs withdrawn consents grouped by processing purpose (DPDP Act 2023)."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              {consentData.length > 0 ? (
                <StackedBarChart data={consentData} />
              ) : (
                <div className="flex h-[240px] items-center justify-center text-[13px] text-muted-foreground">
                  No consent records on file.
                </div>
              )}
            </div>
          </ChartCard>
        </Reveal>
      </div>

      {/* Audit by operation chart + audit summary card. */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <Reveal y={14} delay={0.05}>
          <ChartCard
            title="Audit events by operation"
            description="The immutable, hash-chained log broken down by mutation type."
          >
            <div className="px-3 pb-4 pt-3 md:px-4">
              {auditOpData.length > 0 ? (
                <HorizontalBarChart
                  data={auditOpData}
                  valueLabel="Events"
                  color="var(--emerald)"
                />
              ) : (
                <div className="flex h-[260px] items-center justify-center text-[13px] text-muted-foreground">
                  The chain is at genesis.
                </div>
              )}
            </div>
          </ChartCard>
        </Reveal>
        <Reveal y={14} delay={0.1}>
          <Card className="h-full">
            <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Audit log summary
              </h3>
              <p className="text-[13px] text-muted-foreground">
                Tamper-evident event log - monthly range-partitioned, hash-chained.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-px bg-hairline">
              <SummaryCell label="Total events" value={audit.total.toLocaleString("en-IN")} />
              <SummaryCell label="First event" value={fmtDate(audit.firstAt)} />
              <SummaryCell label="Last event" value={fmtDate(audit.lastAt)} />
            </div>
            <div className="px-5 pb-5 pt-4 md:px-6">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Top entity types
              </p>
              <div className="flex flex-col gap-1.5">
                {audit.byEntityType.slice(0, 6).map((r) => {
                  const pct =
                    audit.total > 0 ? (r.count / audit.total) * 100 : 0;
                  return (
                    <div
                      key={r.entityType}
                      className="flex items-center justify-between gap-3 text-[13px]"
                    >
                      <span className="text-foreground/80">
                        {r.entityType.replace(/_/g, " ")}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="nums tabular-nums text-muted-foreground">
                          {pct.toFixed(1)}%
                        </span>
                        <span className="nums tabular-nums font-medium">
                          {r.count.toLocaleString("en-IN")}
                        </span>
                      </span>
                    </div>
                  );
                })}
                {audit.byEntityType.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">
                    No audit events recorded.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* KYC by status table + consent by purpose table. */}
      <div className="mt-5 grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <Reveal y={14} delay={0.05}>
          <Card className="h-full overflow-hidden">
            <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                KYC by status
              </h3>
              <p className="text-[13px] text-muted-foreground">
                Records per lifecycle status + re-KYC due within 30 days.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Records</TableHead>
                  <TableHead align="right">Due ≤30d</TableHead>
                  <TableHead align="right">% of book</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kyc.byStatus.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={4} className="p-0">
                      <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                        No KYC records on file.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  kyc.byStatus.map((r) => {
                    const pct =
                      kyc.total > 0 ? (r.count / kyc.total) * 100 : 0;
                    return (
                      <TableRow key={r.status}>
                        <TableCell primary>{r.statusLabel}</TableCell>
                        <TableCell numeric>{r.count}</TableCell>
                        <TableCell numeric>
                          {r.dueSoon > 0 ? (
                            <span className="text-down">{r.dueSoon}</span>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell numeric>
                          <Num value={pct} format={(n) => `${n.toFixed(1)}%`} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </Reveal>

        <Reveal y={14} delay={0.1}>
          <Card className="h-full overflow-hidden">
            <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
              <h3 className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Consent by purpose
              </h3>
              <p className="text-[13px] text-muted-foreground">
                DPDP purpose-bound consents - active vs withdrawn.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Purpose</TableHead>
                  <TableHead align="right">Active</TableHead>
                  <TableHead align="right">Withdrawn</TableHead>
                  <TableHead align="right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consent.byPurpose.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={4} className="p-0">
                      <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                        No consent records on file.
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  consent.byPurpose.map((r) => (
                    <TableRow key={r.purpose}>
                      <TableCell primary>{r.purposeLabel}</TableCell>
                      <TableCell numeric>
                        <span className="text-emerald">{r.active}</span>
                      </TableCell>
                      <TableCell numeric>{r.withdrawn}</TableCell>
                      <TableCell numeric>{r.total}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </Reveal>
      </div>
    </PageShell>
  );
}

/** A single hairline-separated summary cell - label over value, mono nums. */
function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-surface px-4 py-3.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="nums text-[15px] font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  );
}
