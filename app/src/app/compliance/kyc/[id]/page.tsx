import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  ArrowLeft,
  ArrowUpRight,
  ShieldCheck,
  ShieldWarning,
  Users,
  FileText,
  Clock,
  CheckCircle,
  Scales,
  Fingerprint,
} from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import { getKycDetail } from "@/features/compliance/queries";
import { db } from "@/db";
import { contact as contactTable, partyContact } from "@/db/schema";
import { cn } from "@/lib/utils";
import type { KycRisk, KycStatus } from "@/features/compliance/kyc";
import { KycActions } from "./kyc-action-forms";
import {
  Card,
  Badge,
  Button,
  Reveal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  PreviewPane,
  KycShieldMark,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import { StatusTimeline } from "./status-timeline";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; dot?: boolean }> = {
  pending: { variant: "outline" },
  in_review: { variant: "info" },
  under_eds_check: { variant: "gold" },
  approved: { variant: "emerald", dot: true },
  rejected: { variant: "down" },
  expired: { variant: "neutral" },
  rekyc_due: { variant: "gold" },
};

const RISK_BADGE: Record<string, BadgeProps["variant"]> = {
  low: "emerald",
  medium: "gold",
  high: "down",
};

const KYC_TYPE_BADGE: Record<string, BadgeProps["variant"]> = {
  CDD: "outline",
  EDD: "gold",
  simplified: "neutral",
};

const OP_TONE: Record<string, "emerald" | "info" | "down" | "gold" | "neutral"> = {
  insert: "emerald",
  update: "info",
  delete: "down",
  merge: "gold",
  approve: "emerald",
  reject: "down",
};

function pretty(s: string): string {
  return s.replace(/_/g, " ");
}

function fmtDate(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtDateTime(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function KycDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getKycDetail(id, user);
  if (!detail) notFound();

  const {
    record,
    party: partyRow,
    contact,
    approver,
    beneficialOwners,
    documents,
    history,
  } = detail;

  // Load the party's current contacts (via party_contact → contact) so the
  // "Add beneficial owner" form has a real selector instead of a free-text
  // UUID. Current = valid_to IS NULL AND deleted_at IS NULL.
  const partyContacts = await db
    .select({
      contactId: contactTable.contactId,
      fullName: contactTable.fullName,
    })
    .from(partyContact)
    .innerJoin(contactTable, eq(contactTable.contactId, partyContact.contactId))
    .where(
      and(
        eq(partyContact.partyId, partyRow.partyId),
        isNull(partyContact.validTo),
        isNull(partyContact.deletedAt),
        isNull(contactTable.deletedAt),
      ),
    )
    .orderBy(asc(contactTable.fullName));

  const sb = STATUS_BADGE[record.status ?? ""] ?? { variant: "outline" };
  const rekycOverdue =
    record.rekycDueDate &&
    new Date(record.rekycDueDate).getTime() <= Date.now();
  const rekycDueSoon =
    record.rekycDueDate &&
    !rekycOverdue &&
    new Date(record.rekycDueDate).getTime() <= Date.now() + 30 * 86_400_000;

  return (
    <PageShell>
      {/* Breadcrumb + back */}
      <Reveal y={8} duration={0.5} noBlur>
        <div className="mb-6 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Link
              href="/compliance/kyc"
              className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-soft hover:text-foreground"
            >
              <ArrowLeft weight="light" className="size-3.5" />
              KYC
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="nums text-foreground/60">
              {record.kycRecordId.slice(0, 8)}
            </span>
          </nav>
          <Button
            asChild
            variant="secondary-hairline"
            size="sm"
            trailingIcon={<ArrowUpRight weight="light" className="size-4" />}
          >
            <Link href={`/parties/${partyRow.partyId}`}>Open party</Link>
          </Button>
        </div>
      </Reveal>

      {/* Header - reimagined as a crafted detail pane. The PreviewPane frames
          the record's identity (eyebrow type + Fraunces name + the bespoke
          KycShieldMark in a hairline disc) with the status/risk/PEP badge
          ladder, then the key-meta grid as its body and the record id as a
          quiet footer. Renders VISIBLE on mount (no whileInView opacity-0
          gate) so the detail's above-the-fold reads in headless captures. */}
      <PreviewPane
        sticky={false}
        className="mb-8"
        type={`KYC record · ${pretty(partyRow.partyNature)}`}
        name={partyRow.legalName}
        mark={
          <span className="inline-flex size-11 items-center justify-center rounded-full ring-1 ring-gold/25 bg-gold/[0.06] text-gold">
            <KycShieldMark size={24} tone="gold" />
          </span>
        }
        badges={
          <>
            {record.kycType ? (
              <Badge variant={KYC_TYPE_BADGE[record.kycType] ?? "outline"}>
                {record.kycType}
              </Badge>
            ) : null}
            <Badge variant={sb.variant} dot={sb.dot}>
              {pretty(record.status ?? "-")}
            </Badge>
            {record.riskRating ? (
              <Badge variant={RISK_BADGE[record.riskRating] ?? "outline"}>
                risk · {record.riskRating}
              </Badge>
            ) : null}
            {contact?.pepStatus && contact.pepStatus !== "none" ? (
              <Badge variant="down" icon={<ShieldWarning weight="light" />}>
                PEP · {contact.pepStatus}
              </Badge>
            ) : null}
          </>
        }
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
            <span className="nums uppercase tracking-[0.1em] text-muted-foreground/70">
              KYC · {record.kycRecordId.slice(0, 8)}
            </span>
            <span className="nums tabular-nums">
              Created {fmtDate(record.createdAt ?? null)}
            </span>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-hairline/60 sm:grid-cols-4">
          <MetaCell
            label="Valid until"
            value={fmtDate(record.validUntil ?? null)}
            icon={<Scales weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="Re-KYC due"
            value={fmtDate(record.rekycDueDate ?? null)}
            tone={rekycOverdue ? "down" : rekycDueSoon ? "gold" : undefined}
            icon={<Clock weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="Approved by"
            value={approver?.email ?? "-"}
            icon={<CheckCircle weight="light" className="size-3.5" />}
          />
          <MetaCell
            label="Highest BO"
            value={
              record.highestBoOwnershipPct
                ? `${Number(record.highestBoOwnershipPct).toLocaleString("en-IN", {
                    maximumFractionDigits: 2,
                  })}%`
                : "-"
            }
            icon={<Users weight="light" className="size-3.5" />}
          />
        </div>
      </PreviewPane>

      {/* Lifecycle actions - advance status, re-rate risk, attach a BO.
          Wired to the compliance server actions (transitionKycStatus /
          setKycRiskRating / addBeneficialOwner). Renders visible on mount. */}
      <Reveal y={16} duration={0.6} className="mb-6">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-5 md:p-6">
            <PageHeader
        title="Lifecycle"
        description="Advance the record through its state machine, re-rate risk, or attach a beneficial owner. Every change is written to the audit trail."
      />
            <KycActions
              kycRecordId={record.kycRecordId}
              currentStatus={(record.status ?? "pending") as KycStatus}
              currentRisk={(record.riskRating ?? null) as KycRisk | null}
              contacts={partyContacts.map((c) => ({
                contactId: c.contactId,
                fullName: c.fullName,
              }))}
            />
          </div>
        </Card>
      </Reveal>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left rail - status timeline (lifecycle) */}
        <Reveal y={16} duration={0.6} className="lg:col-span-1">
          <Card className="h-full overflow-hidden">
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <PageHeader
        title="Status timeline"
      />
              <StatusTimeline history={history} />
            </div>
          </Card>
        </Reveal>

        {/* Right - CDD/EDD + periodic refresh + principal contact */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Reveal y={16} duration={0.6}>
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-5 p-5 md:p-6">
                <PageHeader
        title="CDD / EDD"
        description="PMLA §5.2–5.4 - identity, ownership, source of funds & wealth."
      />
                <DL>
                  <DT>KYC type</DT>
                  <DD>{record.kycType ?? "-"}</DD>
                  <DT>Risk rating</DT>
                  <DD>
                    {record.riskRating ? (
                      <Badge variant={RISK_BADGE[record.riskRating] ?? "outline"}>
                        {record.riskRating}
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </DD>
                  <DT>CDD done at</DT>
                  <DD mono>{fmtDateTime(record.cddDoneAt ?? null)}</DD>
                  <DT>EDD reason</DT>
                  <DD>{record.eddReason ?? "-"}</DD>
                  <DT>Highest BO %</DT>
                  <DD mono>
                    {record.highestBoOwnershipPct
                      ? `${Number(record.highestBoOwnershipPct).toLocaleString(
                          "en-IN",
                          { maximumFractionDigits: 2 },
                        )}%`
                      : "-"}
                  </DD>
                  <DT>Source of funds</DT>
                  <DD>
                    {record.sourceOfFundsVerified ? (
                      <Badge variant="emerald" dot>
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unverified</Badge>
                    )}
                  </DD>
                  <DT>Source of wealth</DT>
                  <DD>
                    {record.sourceOfWealthVerified ? (
                      <Badge variant="emerald" dot>
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline">Unverified</Badge>
                    )}
                  </DD>
                  <DT>Approved by</DT>
                  <DD>{approver?.email ?? "-"}</DD>
                  <DT>Approved at</DT>
                  <DD mono>{fmtDateTime(record.approvedAt ?? null)}</DD>
                </DL>
              </div>
            </Card>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2">
            <Reveal y={16} duration={0.6}>
              <Card className="h-full overflow-hidden">
                <div className="flex flex-col gap-4 p-5 md:p-6">
                  <PageHeader
        title="Re-KYC"
        description="RBI MD on KYC: low 10yr / medium 8yr / high 2yr."
      />
                  <DL>
                    <DT>Valid until</DT>
                    <DD mono>{fmtDate(record.validUntil ?? null)}</DD>
                    <DT>Re-KYC due</DT>
                    <DD>
                      {record.rekycDueDate ? (
                        <span
                          className={cn(
                            "nums tabular-nums",
                            rekycOverdue
                              ? "text-down"
                              : rekycDueSoon
                                ? "text-gold"
                                : "text-foreground",
                          )}
                        >
                          {fmtDate(record.rekycDueDate)}
                        </span>
                      ) : (
                        "-"
                      )}
                    </DD>
                    <DT>Created</DT>
                    <DD mono>{fmtDate(record.createdAt ?? null)}</DD>
                    <DT>Retention</DT>
                    <DD>PMLA s.12 · 5yr from closure</DD>
                  </DL>
                </div>
              </Card>
            </Reveal>

            <Reveal y={16} duration={0.6}>
              <Card className="h-full overflow-hidden">
                <div className="flex flex-col gap-4 p-5 md:p-6">
                  <PageHeader
        title="Contact"
        description="Natural-person principal for individual KYC / BO."
      />
                  {contact ? (
                    <DL>
                      <DT>Name</DT>
                      <DD>{contact.fullName}</DD>
                      <DT>PAN</DT>
                      <DD mono>{contact.pan ?? "-"}</DD>
                      <DT>PEP status</DT>
                      <DD>
                        {contact.pepStatus && contact.pepStatus !== "none" ? (
                          <Badge variant="down">{contact.pepStatus}</Badge>
                        ) : (
                          <span className="text-muted-foreground">none</span>
                        )}
                      </DD>
                      <DT>PEP verified</DT>
                      <DD mono>{fmtDate(contact.pepVerifiedAt ?? null)}</DD>
                    </DL>
                  ) : (
                    <p className="text-[13px] text-muted-foreground">
                      No principal contact linked to this record.
                    </p>
                  )}
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </div>

      {/* Beneficial owners ------------------------------------------------- */}
      <Reveal y={16} duration={0.6} className="mt-8">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
            <PageHeader
        title="Beneficial owners"
        description="Company >10% · partnership >15% · trust >15%; role-based fallback where no natural person meets the threshold."
      />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:px-5">
                <TableHead>Name</TableHead>
                {/* Mobile: key-columns-only - PAN / Declared / Chain are
                    secondary on a phone, dropped below md so the BO table reads
                    Name · Ownership · PEP. md+ restores the full 6-col read. */}
                <TableHead className="hidden md:table-cell">PAN</TableHead>
                <TableHead align="right">Ownership</TableHead>
                <TableHead>PEP</TableHead>
                <TableHead align="right" className="hidden md:table-cell">
                  Declared
                </TableHead>
                <TableHead className="hidden md:table-cell">Chain</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beneficialOwners.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={6} className="p-0">
                    <TableEmpty
                      icon={<Users weight="light" />}
                      title="No beneficial owners recorded."
                      hint="BO junction rows are created during the CDD/EDD collection workflow."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                beneficialOwners.map((bo) => (
                  <TableRow
                    key={bo.kycBeneficialOwnerId}
                    className="[&>td]:px-5 [&>td]:py-4"
                  >
                    <TableCell primary>{bo.contactFullName}</TableCell>
                    <TableCell numeric className="hidden md:table-cell">
                      <span className="text-foreground/75">
                        {bo.contactPan ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell numeric>
                      {bo.ownershipPct
                        ? `${Number(bo.ownershipPct).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}%`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {bo.contactPepStatus &&
                      bo.contactPepStatus !== "none" ? (
                        <Badge variant="down">{bo.contactPepStatus}</Badge>
                      ) : (
                        <span className="text-[12.5px] text-muted-foreground/60">
                          none
                        </span>
                      )}
                    </TableCell>
                    <TableCell numeric className="hidden md:table-cell">
                      <span className="text-foreground/75">
                        {fmtDate(bo.declaredAt ?? null)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-foreground/70">
                        {bo.relationshipPath ?? "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Reveal>

      {/* PEP / sanctions screening ---------------------------------------- */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Reveal y={16} duration={0.6}>
          <Card className="h-full overflow-hidden">
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <PageHeader
        title="PEP screening"
        description="Politically exposed person - domestic / foreign / associate."
      />
              <DL>
                <DT>PEP status</DT>
                <DD>
                  {contact?.pepStatus && contact.pepStatus !== "none" ? (
                    <Badge variant="down" icon={<ShieldWarning weight="light" />}>
                      {contact.pepStatus}
                    </Badge>
                  ) : (
                    <Badge variant="emerald" dot>
                      clear
                    </Badge>
                  )}
                </DD>
                <DT>Verified at</DT>
                <DD mono>{fmtDate(contact?.pepVerifiedAt ?? null)}</DD>
              </DL>
              <p className="text-[12px] text-muted-foreground">
                Live PEP-database screening is a stub pending provider
                integration - see{" "}
                <span className="nums text-foreground/70">
                  src/features/compliance/kyc.ts
                </span>
                .
              </p>
            </div>
          </Card>
        </Reveal>

        <Reveal y={16} duration={0.6}>
          <Card className="h-full overflow-hidden">
            <div className="flex flex-col gap-4 p-5 md:p-6">
              <PageHeader
        title="Sanctions screening"
        description="List-provider match scoring with human disposition."
      />
              <div className="flex items-center gap-3 rounded-xl bg-foreground/[0.03] p-4 ring-1 ring-hairline/60">
                <Fingerprint weight="light" className="size-6 text-gold" />
                <div className="flex flex-col gap-1">
                  <Badge variant="emerald" dot>
                    clear
                  </Badge>
                  <p className="text-[12px] text-muted-foreground">
                    Stub provider returns clear until wired. Matches require
                    analyst disposition before any status change.
                  </p>
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Screening runs on the principal and each beneficial owner; the
                live call is{" "}
                <span className="nums text-foreground/70">screenSanctions()</span>{" "}
                in kyc.ts.
              </p>
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Documents --------------------------------------------------------- */}
      <Reveal y={16} duration={0.6} className="mt-8">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
            <PageHeader
        title="KYC documents"
        description="Identity, address, PAN and BO-declaration docs anchored to this party or contact."
      />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:px-5">
                <TableHead>File</TableHead>
                {/* Mobile: key-columns-only - Category / Type / Confidential are
                    secondary on a phone, dropped below md so the evidence table
                    reads File · MNPI · Uploaded. md+ restores the full read. */}
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Confidential</TableHead>
                <TableHead>MNPI</TableHead>
                <TableHead align="right">Uploaded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={6} className="p-0">
                    <TableEmpty
                      icon={<FileText weight="light" />}
                      title="No KYC documents linked."
                      hint="Documents tagged with a kyc_category appear here once uploaded."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((d) => (
                  <TableRow
                    key={d.documentId}
                    className="[&>td]:px-5 [&>td]:py-4"
                  >
                    <TableCell primary>{d.fileName ?? d.documentId}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {d.kycCategory ? (
                        <Badge variant="info">{d.kycCategory}</Badge>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-foreground/70">
                        {d.documentType ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {d.isConfidential ? (
                        <Badge variant="neutral">confidential</Badge>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {d.isMnpi ? (
                        <Badge variant="down">MNPI</Badge>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </TableCell>
                    <TableCell numeric>
                      <span className="text-foreground/75">
                        {fmtDate(d.createdAt ?? null)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Reveal>

      {/* Audit history (immutable) ---------------------------------------- */}
      <Reveal y={16} duration={0.6} className="mt-8">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-1 px-5 pt-5 md:px-6 md:pt-6">
            <PageHeader
        title="History"
        description="audit_log entries for entity_type = kyc_record. A broken hash chain indicates a row modified outside the trigger."
      />
          </div>
          <Table>
            <TableHeader>
              <TableRow className="[&>th]:px-5">
                <TableHead align="right">When</TableHead>
                <TableHead>Op</TableHead>
                {/* Mobile: key-columns-only - Field / Role are secondary on a
                    phone, dropped below md so the history reads When · Op ·
                    Actor. md+ restores the full 5-col audit read. */}
                <TableHead className="hidden md:table-cell">Field</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow className="hover:bg-transparent before:hidden">
                  <TableCell colSpan={5} className="p-0">
                    <TableEmpty
                      icon={<ShieldCheck weight="light" />}
                      title="No history yet."
                      hint="Audit entries appear as the record moves through its lifecycle."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                history
                  .slice()
                  .reverse()
                  .map((h) => (
                    <TableRow
                      key={h.auditLogId}
                      className="[&>td]:px-5 [&>td]:py-4"
                    >
                      <TableCell numeric>
                        <span className="text-foreground/75">
                          {fmtDateTime(h.occurredAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={OP_TONE[h.operation] ?? "neutral"}>
                          {h.operation}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-foreground/70">
                          {h.fieldName ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-foreground/80">
                          {h.actorEmail ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-muted-foreground">
                          {h.actorRoleAtTime ?? "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </Card>
      </Reveal>
    </PageShell>
  );
}

/* ──────────────────────────────────────────────────────────────────────
   Local presentational helpers - keep the page lean without touching shared
   primitives.
   ────────────────────────────────────────────────────────────────────── */

function MetaCell({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: "down" | "gold" | "emerald";
}) {
  return (
    <div className="flex flex-col gap-1.5 bg-surface px-4 py-3.5">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span className="text-muted-foreground/70 [&_svg]:size-3.5">
          {icon}
        </span>
        {label}
      </span>
      <span
        className={cn(
          "nums tabular-nums text-[13.5px] font-medium text-foreground",
          tone === "down" && "text-down",
          tone === "gold" && "text-gold",
          tone === "emerald" && "text-up",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function DL({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {children}
    </dl>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:pt-0.5">
      {children}
    </dt>
  );
}

function DD({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <dd
      className={cn(
        "text-[13.5px] text-foreground/85",
        mono && "nums tabular-nums",
      )}
    >
      {children}
    </dd>
  );
}
