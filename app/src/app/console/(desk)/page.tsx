import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "@phosphor-icons/react/ssr";

import { requireUser } from "@/lib/rbac";
import {
  brandLabel,
  homeQuestion,
  resolveConsoleBrand,
} from "@/console/rbac/nav";
import {
  CONSOLE_BRAND_COOKIE,
  parseBrandPref,
} from "@/console/lib/brand-pref";
import { getDashboardData } from "@/features/dashboard/queries";
import { CPageHeader } from "@/console/patterns/page-header";
import { CCard, CKpi } from "@/console/primitives/card";
import { CBadge } from "@/console/primitives/badge";
import { CEmpty } from "@/console/primitives/empty";
import { formatCrorePlain } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Home" };

function greetingIst(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function ConsoleHomePage() {
  const user = await requireUser();
  const jar = await cookies();
  const brandPref = parseBrandPref(jar.get(CONSOLE_BRAND_COOKIE)?.value);
  const brand = resolveConsoleBrand({
    brandScope: user.brandScope,
    roles: user.roles,
    brandPref,
  });
  const data = await getDashboardData({ user });
  const kpis = data.kpis;

  const openDeals = kpis.openDealByStage.reduce((n, s) => n + s.count, 0);
  const openExposure = kpis.openDealByStage.reduce(
    (n, s) => n + (s.exposure || 0),
    0,
  );

  const primaryCtas =
    brand === "binarybonds"
      ? [
          { href: "/console/matching", label: "Open matching" },
          { href: "/console/deals", label: "Pipeline" },
        ]
      : brand === "shared"
        ? [
            { href: "/console/parties", label: "All parties" },
            { href: "/console/admin", label: "Admin" },
          ]
        : [
            { href: "/console/parties", label: "Client book" },
            { href: "/console/leads", label: "Leads" },
          ];

  return (
    <div>
      <CPageHeader
        eyebrow={brandLabel(brand)}
        title={`${greetingIst()}${user.name ? `, ${user.name.split(" ")[0]}` : ""}`}
        description={homeQuestion(brand)}
        actions={
          <div className="flex flex-wrap gap-2">
            {primaryCtas.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex h-10 items-center gap-2 rounded-[var(--c-radius-pill)] bg-[var(--c-accent)] px-4 text-[13px] font-medium text-[var(--c-on-accent)] transition-transform active:scale-[0.98]"
              >
                {a.label}
                <ArrowRight className="size-3.5" weight="bold" />
              </Link>
            ))}
          </div>
        }
      />

      <section
        aria-label="Key metrics"
        data-testid="console-home-kpis"
        className="mb-6 grid grid-cols-2 gap-3 md:mb-8 md:grid-cols-4 md:gap-4"
      >
        <div data-testid="kpi-parties" data-kpi-value={kpis.totalParties}>
          <CKpi
            label="Parties in view"
            value={String(kpis.totalParties)}
            hint={`${kpis.issuerCount} issuers · ${kpis.investorCount} investors`}
          />
        </div>
        <div data-testid="kpi-open-mandates" data-kpi-value={openDeals}>
          <CKpi
            label="Open mandates"
            value={String(openDeals)}
            hint={
              openExposure > 0
                ? `~${formatCrorePlain(openExposure)} exposure`
                : "Across active stages"
            }
          />
        </div>
        <div data-testid="kpi-credit" data-kpi-value={kpis.creditInProgress}>
          <CKpi
            label="Credit in progress"
            value={String(kpis.creditInProgress)}
            hint="Analyses open on book"
          />
        </div>
        <div data-testid="kpi-kyc" data-kpi-value={kpis.kycExpiring}>
          <CKpi
            label="KYC soon / due"
            value={String(kpis.kycExpiring)}
            delta="Next 30 days"
            hint="Act before re-KYC window slips"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <CCard className="lg:col-span-3" as="section">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-semibold text-[var(--c-ink)]">
              What needs you now
            </h2>
            <CBadge tone="accent">Live book</CBadge>
          </div>
          <ul className="divide-y divide-[var(--c-line)]">
            {kpis.kycExpiring > 0 ? (
              <QueueRow
                href="/console/compliance/kyc"
                title="KYC re-verification due"
                meta={`${kpis.kycExpiring} records in the next 30 days`}
                tone="warn"
              />
            ) : null}
            {openDeals > 0 ? (
              <QueueRow
                href="/console/deals"
                title="Open mandates to progress"
                meta={`${openDeals} deals still pre-settlement`}
                tone="info"
              />
            ) : null}
            {kpis.creditInProgress > 0 ? (
              <QueueRow
                href="/console/credit"
                title="Credit analyses in flight"
                meta={`${kpis.creditInProgress} need analyst or committee attention`}
                tone="neutral"
              />
            ) : null}
            {kpis.kycExpiring === 0 &&
            openDeals === 0 &&
            kpis.creditInProgress === 0 ? (
              <li className="py-6">
                <CEmpty
                  title="Queue is clear"
                  body="No urgent KYC, open deals, or credit items in your current view. Start with your primary book."
                  actionLabel={primaryCtas[0].label}
                  actionHref={primaryCtas[0].href}
                />
              </li>
            ) : null}
          </ul>
        </CCard>

        <CCard className="lg:col-span-2" as="section">
          <h2 className="mb-3 text-[14px] font-semibold text-[var(--c-ink)]">
            Pipeline by stage
          </h2>
          <PipelineStageChart stages={kpis.openDealByStage} />
          <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
            {kpis.openDealByStage.length === 0 ? (
              <li className="text-[13px] text-[var(--c-ink-3)]">No open deals</li>
            ) : (
              kpis.openDealByStage.slice(0, 8).map((s) => (
                <li
                  key={String(s.status)}
                  className="flex items-center justify-between gap-2 text-[13px]"
                >
                  <span className="text-[var(--c-ink-2)]">
                    {(s.status ?? "unknown").replace(/_/g, " ")}
                  </span>
                  <span className="font-mono tabular-nums font-medium text-[var(--c-ink)]">
                    {s.count}
                  </span>
                </li>
              ))
            )}
          </ul>
          <Link
            href="/console/deals"
            className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--c-accent)]"
          >
            Open pipeline
            <ArrowRight className="size-3.5" />
          </Link>
        </CCard>
      </div>

      {kpis.monthly.length > 0 ? (
        <CCard className="mt-4" as="section">
          <h2 className="mb-3 text-[14px] font-semibold text-[var(--c-ink)]">
            Mandate flow (monthly)
          </h2>
          <MonthlySeriesChart series={kpis.monthly} />
        </CCard>
      ) : null}
    </div>
  );
}

/** Data-driven SVG bar chart from live openDealByStage KPIs. */
function PipelineStageChart({
  stages,
}: {
  stages: { status: string | null; count: number; exposure: number }[];
}) {
  const data = stages.slice(0, 8);
  if (data.length === 0) {
    return (
      <p className="text-[12px] text-[var(--c-ink-3)]">No stage series yet.</p>
    );
  }
  const max = Math.max(...data.map((d) => d.count), 1);
  const w = 320;
  const h = 120;
  const pad = 8;
  const barW = (w - pad * 2) / data.length - 4;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-28 w-full"
      role="img"
      aria-label="Open deals by pipeline stage"
      data-testid="chart-pipeline-stage"
      data-series-count={data.length}
    >
      {data.map((s, i) => {
        const bh = ((s.count / max) * (h - pad * 2 - 16)) | 0;
        const x = pad + i * (barW + 4);
        const y = h - pad - 14 - bh;
        return (
          <g key={String(s.status)}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(bh, 2)}
              rx={3}
              fill="var(--c-accent)"
              opacity={0.85}
              data-stage={String(s.status ?? "unknown")}
              data-count={s.count}
            />
            <text
              x={x + barW / 2}
              y={h - 4}
              textAnchor="middle"
              fontSize="8"
              fill="var(--c-ink-3)"
            >
              {(s.status ?? "?").slice(0, 4)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MonthlySeriesChart({
  series,
}: {
  series: { monthKey: string; deals: number; exposure: number }[];
}) {
  const data = series.slice(-12);
  const max = Math.max(...data.map((d) => d.deals), 1);
  const w = 640;
  const h = 140;
  const pad = 16;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const points = data
    .map((d, i) => {
      const x = pad + i * step;
      const y = h - pad - (d.deals / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-36 w-full"
      role="img"
      aria-label="Monthly deal count series"
      data-testid="chart-monthly-flow"
      data-point-count={data.length}
    >
      <polyline
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth="2.5"
        points={points}
      />
      {data.map((d, i) => {
        const x = pad + i * step;
        const y = h - pad - (d.deals / max) * (h - pad * 2);
        return (
          <circle
            key={d.monthKey}
            cx={x}
            cy={y}
            r={3.5}
            fill="var(--c-accent)"
            data-month={d.monthKey}
            data-deals={d.deals}
          />
        );
      })}
    </svg>
  );
}

function QueueRow({
  href,
  title,
  meta,
  tone,
}: {
  href: string;
  title: string;
  meta: string;
  tone: "warn" | "info" | "neutral";
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 py-3.5 transition-colors hover:bg-[var(--c-surface-2)]/60 -mx-2 px-2 rounded-[var(--c-radius)]"
      >
        <CBadge tone={tone === "warn" ? "warn" : tone === "info" ? "info" : "neutral"}>
          Action
        </CBadge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-[var(--c-ink)]">
            {title}
          </p>
          <p className="truncate text-[12px] text-[var(--c-ink-3)]">{meta}</p>
        </div>
        <ArrowRight className="size-4 shrink-0 text-[var(--c-ink-3)]" />
      </Link>
    </li>
  );
}
