import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "@/components/brand/icons";
import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/rbac";
import { getOnboardingDetail, listRms } from "@/features/onboarding";
import {
  Button,
  Badge,
  PreviewPane,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import {
  ONBOARDING_CLIENT_TYPE_LABELS,
  ONBOARDING_STAGE_FULL_LABELS,
  ONBOARDING_STAGE_TONE,
} from "@/features/onboarding";
import { OnboardingStageIcon } from "@/features/onboarding/onboarding-icons";
import { OnboardingDetailView } from "./onboarding-detail-view";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

// Stage disc tone classes - the hairline ring + faint tint + tone text for the
// header mark. Server-side (page.tsx is a server component, so it cannot CALL
// the client onboardingStageTone() helper - it reads the server-safe
// ONBOARDING_STAGE_TONE map from types.ts instead).
const STAGE_DISC_TONE: Record<string, string> = {
  neutral: "ring-hairline bg-foreground/[0.03] text-muted-foreground",
  info: "ring-info/22 bg-info/[0.06] text-info",
  gold: "ring-gold/22 bg-gold/[0.06] text-gold/85",
  emerald: "ring-emerald/22 bg-emerald/[0.06] text-emerald/85",
};

// The onboarding case detail. DB-backed - never prerender.
export const dynamic = "force-dynamic";

function fmtDate(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function OnboardingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const [detail, rms] = await Promise.all([
    getOnboardingDetail(id, user),
    listRms(),
  ]);
  if (!detail) notFound();

  const { onboarding: m, kyc, sla, partyTypes } = detail;
  const stageTone = ONBOARDING_STAGE_TONE[m.stage];

  const sb: { variant: BadgeProps["variant"]; dot?: boolean } = {
    variant: stageTone,
    dot: stageTone === "emerald",
  };
  const slaBadge: { variant: BadgeProps["variant"]; label: string } =
    sla.status === "overdue"
      ? { variant: "down", label: `${Math.abs(sla.daysRemaining)}d overdue` }
      : sla.status === "due_soon"
        ? { variant: "gold", label: sla.daysRemaining === 0 ? "due today" : `${sla.daysRemaining}d left` }
        : sla.status === "on_track"
          ? { variant: "emerald", label: `${sla.daysRemaining}d left` }
          : { variant: "outline", label: "Active" };

  return (
    <PageShell>
      {/* Breadcrumb + back */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-soft hover:text-foreground"
          >
            <ArrowLeft weight="light" className="size-3.5" />
            Onboarding
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="nums text-foreground/60">{detail.partyId.slice(0, 8)}</span>
        </nav>
        <Button
          asChild
          variant="secondary-hairline"
          size="sm"
          trailingIcon={<ArrowUpRight weight="light" className="size-4" />}
        >
          <Link href={`/parties/${detail.partyId}`}>Open party</Link>
        </Button>
      </div>

      {/* Header - the case identity. Renders VISIBLE on mount. */}
      <PreviewPane
        sticky={false}
        className="mb-8"
        type={`Onboarding · ${ONBOARDING_CLIENT_TYPE_LABELS[m.clientType]}`}
        name={detail.legalName}
        mark={
          <span
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-full ring-1 [&_svg]:size-6",
              STAGE_DISC_TONE[ONBOARDING_STAGE_TONE[m.stage]] ?? STAGE_DISC_TONE.neutral,
            )}
          >
            <OnboardingStageIcon stage={m.stage} />
          </span>
        }
        badges={
          <>
            <Badge variant={sb.variant} dot={sb.dot}>
              {ONBOARDING_STAGE_FULL_LABELS[m.stage]}
            </Badge>
            <Badge variant={slaBadge.variant}>{slaBadge.label}</Badge>
            {kyc ? (
              <Badge variant={kyc.status === "approved" ? "emerald" : kyc.status === "rejected" ? "down" : "info"}>
                KYC · {kyc.status ?? "-"}
              </Badge>
            ) : (
              <Badge variant="outline">No KYC</Badge>
            )}
            {m.complianceRejectedAt ? (
              <Badge variant="down">Compliance rejected</Badge>
            ) : null}
          </>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <span className="nums uppercase tracking-[0.1em] text-muted-foreground/70">
              {partyTypes.join(" · ") || "prospect"}
            </span>
            <span className="nums tabular-nums">
              Initiated {fmtDate(m.createdAt)}
            </span>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline/60 sm:grid-cols-4">
          <MetaCell label="Signatory" value={m.contactName ?? "-"} />
          <MetaCell label="PAN" value={m.pan ?? "-"} mono />
          <MetaCell label="City" value={m.city ?? "-"} />
          <MetaCell label="RM" value={detail.assignedRmName ?? detail.assignedRmEmail ?? "Unassigned"} />
        </div>
      </PreviewPane>

      <OnboardingDetailView detail={detail} rms={rms} />
    </PageShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Local presentational helper - the meta grid cell.
   ────────────────────────────────────────────────────────────────────── */
function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-surface px-4 py-3.5">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span
        className={
          mono
            ? "nums tabular-nums text-[13.5px] font-medium text-foreground truncate"
            : "text-[13.5px] font-medium text-foreground truncate"
        }
        title={value}
      >
        {value}
      </span>
    </div>
  );
}
