import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/rbac";
import { getLeadDetail, listRms } from "@/features/leads/queries";
import { listDocuments } from "@/features/documents/queries";
import {
  LEAD_DEAL_TYPE_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_HINTS,
  LEAD_STAGE_LABELS,
  bantScore,
  isQualified,
} from "@/features/leads";
import { LeadDealTypeIcon } from "@/features/leads/lead-icons";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Button,
  Eyebrow,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableEmpty,
  CellEmpty,
  IconTile,
} from "@/components/brand";
import type { BadgeProps } from "@/components/brand";
import { SectionHeading } from "@/components/brand/text";
// CRITICAL (Next 16 / AGENTS.md): phosphor icons are imported through the
// `@/components/brand/icons` "use client" boundary, NEVER directly from
// `@phosphor-icons/react` in a server component. Phosphor calls `createContext`
// at module top-level, which is not a function in the RSC (server) environment
// and crashes the page. Substitutes used where the boundary lacks an exact
// glyph: UserCircle→User, ChatCircleDots→ChatCircle, CheckSquare→ListChecks,
// Trophy→SealCheck.
import {
  ArrowRight,
  ArrowLeft,
  CalendarBlank,
  Coins,
  User,
  EnvelopeSimple,
  Phone,
  ChatCircle,
  ListChecks,
  FileText,
  Handshake,
  SealCheck,
} from "@/components/brand/icons";

import { BantChecklist } from "./bant-checklist";
import {
  ConvertToOpportunity,
  WinLeadButton,
  LoseLeadButton,
  DeleteLeadButton,
  AddNoteForm,
  LossReasonBadge,
} from "./lead-workflow-actions";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

const STAGE_BADGE: Record<string, BadgeProps["variant"]> = {
  new: "info",
  qualified: "neutral",
  opportunity: "gold",
  won: "emerald",
  lost: "down",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeClose(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const days = Math.round((d.getTime() - Date.now()) / 86400000);
  if (days === 0) return "today";
  if (days > 0) return `in ${days}d`;
  return `${Math.abs(days)}d ago`;
}

function bytes(n: number | null): string {
  if (n == null) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Server-safe deal-type tone (mirrors lead-icons.tsx's leadDealTypeTone, a
 *  "use client" export that cannot be invoked from a server component). The
 *  tone map is a pure lookup: bond concepts → gold, G-Sec/secondary → emerald,
 *  the rest → neutral. Kept in sync with DEAL_TYPE_CONCEPTS in lead-icons. */
function dealTypeTone(
  dealType: string,
): "neutral" | "emerald" | "gold" {
  if (
    dealType === "bond_underwriting" ||
    dealType === "high_yield_bond" ||
    dealType === "private_placement_debt"
  ) {
    return "gold";
  }
  if (
    dealType === "gsec_auction" ||
    dealType === "secondary_trading_advisory"
  ) {
    return "emerald";
  }
  return "neutral";
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [lead, rms, { rows: documents }] = await Promise.all([
    getLeadDetail(id, user),
    listRms(),
    listDocuments({ partyId: id, page: 1, pageSize: 50, user }),
  ]);
  if (!lead) notFound();

  const m = lead.lead;
  const stage = m.stage;
  const qualified = isQualified(m.bant);
  const bantScoreVal = bantScore(m.bant);
  const isClosed = stage === "won" || stage === "lost";
  const isOpportunity = stage === "opportunity";
  const dealTone = dealTypeTone(m.dealType);
  const sizeText =
    m.estSizeCr != null
      ? `₹${m.estSizeCr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr`
      : null;
  const close = relativeClose(m.expectedClose);
  const leadName = lead.displayName || lead.legalName;
  const rmOptions = rms.map((r) => ({ userId: r.userId, name: r.name }));

  return (
    <PageShell>
      {/* Header ----------------------------------------------------------- */}
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-4">
          <IconTile
            icon={Handshake}
            size={24}
            tone={dealTone === "neutral" ? "neutral" : dealTone}
            className="mt-1 hidden md:inline-flex"
          />
          <div className="flex min-w-0 flex-col gap-2">
            <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
              <Link href="/leads" className="transition-colors hover:text-foreground">
                Leads
              </Link>
              <span className="text-muted-foreground/50">/</span>
            </nav>
            <div className="flex flex-col gap-1">
              <Eyebrow dot>{LEAD_STAGE_LABELS[stage]} lead</Eyebrow>
              <h1 className="font-display text-[clamp(1.9rem,1.4rem+1.6vw,2.6rem)] font-light leading-[1.05] tracking-[-0.02em] text-foreground">
                {leadName}
              </h1>
              <p className="text-[13.5px] text-muted-foreground">
                {LEAD_DEAL_TYPE_LABELS[m.dealType]} · {LEAD_SOURCE_LABELS[m.source]}
                {lead.countryOfIncorporation ? ` · ${lead.countryOfIncorporation}` : ""}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STAGE_BADGE[stage] ?? "neutral"} dot>
            {LEAD_STAGE_LABELS[stage]}
          </Badge>
          {isClosed ? null : (
            <Button
              asChild
              variant="secondary-hairline"
              size="md"
              className="h-11 md:h-9.5"
              leadingIcon={<ArrowLeft weight="light" className="size-4" />}
            >
              <Link href="/leads">Pipeline</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stage hint strip */}
      <p className="mb-4 max-w-prose text-[13px] italic text-muted-foreground">
        {LEAD_STAGE_HINTS[stage]}
      </p>
      {stage === "lost" && m.lossReason ? (
        <div className="mb-8 flex items-center gap-2">
          <LossReasonBadge reason={m.lossReason} />
        </div>
      ) : null}
      {stage === "won" && m.convertedDealId ? (
        <div className="mb-8">
          <Button
            asChild
            variant="primary-emerald"
            size="md"
            className="h-11 md:h-9.5"
            leadingIcon={<SealCheck weight="light" className="size-4" />}
            trailingIcon={<ArrowRight weight="light" className="size-4" />}
          >
            <Link href={`/deals/${m.convertedDealId}`}>Open mandate</Link>
          </Button>
        </div>
      ) : null}

      {/* KPI row ---------------------------------------------------------- */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {sizeText ? (
          <StatCard
            label="Est. size"
            value={(m.estSizeCr ?? 0) * 1e7}
            tone="gold"
            preset="currency"
            icon={<Coins weight="light" />}
          />
        ) : (
          <StatCard
            label="Est. size"
            value={0}
            display="Not estimated"
            tone="default"
            icon={<Coins weight="light" />}
          />
        )}
        <StatCard
          label="Win probability"
          value={m.probability}
          preset="int"
          suffix="%"
          tone={m.probability >= 50 ? "up" : "default"}
          icon={<Target4 />}
        />
        <StatCard
          label="BANT score"
          value={bantScoreVal}
          preset="int"
          suffix="/4"
          tone={qualified ? "up" : "default"}
          icon={<ListChecks weight="light" />}
        />
        <StatCard
          label="Assigned Relationship Manager"
          value={0}
          display={lead.assignedRmName ?? "Unassigned"}
          icon={<User weight="light" />}
        />
      </div>

      {/* Main grid - qualification + conversion (left), context (right) ----- */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: qualification + conversion */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Qualification checklist */}
          <Card ambient={qualified ? "emerald" : undefined}>
            <CardHeader>
              <Eyebrow dot>Qualification</Eyebrow>
              <CardTitle className="mt-1">BANT checklist</CardTitle>
              <CardDescription>
                Toggle each criterion as you confirm it. Clearing all four
                auto-promotes the lead to <em>Qualified</em>.
              </CardDescription>
            </CardHeader>
            <CardBody>
              <BantChecklist
                partyId={lead.partyId}
                initialBant={m.bant}
                readOnly={isClosed}
              />
            </CardBody>
          </Card>

          {/* Conversion actions */}
          <Card ambient={isOpportunity ? "gold" : undefined}>
            <CardHeader>
              <Eyebrow dot>Workflow</Eyebrow>
              <CardTitle className="mt-1">Convert &amp; close</CardTitle>
              <CardDescription>
                {isClosed
                  ? "This lead is closed."
                  : isOpportunity
                    ? "Pursue the opportunity to a won mandate, or close it lost."
                    : "Promote the qualified lead to an active opportunity, then win or lose it."}
              </CardDescription>
            </CardHeader>
            <CardBody>
              <div className="flex flex-col gap-4">
                <ConvertToOpportunity
                  partyId={lead.partyId}
                  qualified={qualified}
                  isClosed={isClosed}
                  isOpportunity={isOpportunity}
                  rms={rmOptions}
                />
                {!isClosed ? (
                  <div className="flex flex-wrap items-center gap-3 border-t border-hairline/60 pt-4">
                    <WinLeadButton
                      partyId={lead.partyId}
                      eligible={isOpportunity || qualified}
                      alreadyWon={false}
                    />
                    <LoseLeadButton
                      partyId={lead.partyId}
                      eligible={!isClosed}
                    />
                  </div>
                ) : null}
              </div>
            </CardBody>
          </Card>

          {/* Note form */}
          {!isClosed ? (
            <Card>
              <CardHeader>
                <Eyebrow dot>Log</Eyebrow>
                <CardTitle className="mt-1">Add a note</CardTitle>
                <CardDescription>
                  Logged as an outbound interaction on the lead&apos;s party.
                </CardDescription>
              </CardHeader>
              <CardBody>
                <AddNoteForm partyId={lead.partyId} />
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* Right: lead context - contact, deal profile, RM */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <Eyebrow>Lead profile</Eyebrow>
              <CardTitle className="mt-1">Deal potential</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="flex flex-col gap-3.5">
                <Row label="Service line" icon={<LeadDealTypeIcon dealType={m.dealType} size={16} />}>
                  {LEAD_DEAL_TYPE_LABELS[m.dealType]}
                </Row>
                <Row label="Source" icon={<Handshake weight="light" className="size-3.5" />}>
                  {LEAD_SOURCE_LABELS[m.source]}
                </Row>
                <Row label="Est. size" icon={<Coins weight="light" className="size-3.5" />}>
                  {sizeText ? (
                    <span className="font-mono tabular-nums">{sizeText}</span>
                  ) : (
                    <span className="text-muted-foreground/60">Not estimated</span>
                  )}
                </Row>
                <Row label="Probability" icon={<Target4 />}>
                  <span className="font-mono tabular-nums">{m.probability}%</span>
                </Row>
                <Row
                  label="Expected close"
                  icon={<CalendarBlank weight="light" className="size-3.5" />}
                >
                  {m.expectedClose ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="font-mono tabular-nums">
                        {fmtDate(m.expectedClose)}
                      </span>
                      {close ? (
                        <span
                          className={
                            new Date(m.expectedClose) < new Date()
                              ? "text-[11px] text-down"
                              : "text-[11px] text-muted-foreground"
                          }
                        >
                          {close}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60">Not set</span>
                  )}
                </Row>
                <Row
                  label="Assigned Relationship Manager"
                  icon={<User weight="light" className="size-3.5" />}
                >
                  {lead.assignedRmName ?? (
                    <span className="text-muted-foreground/60">Unassigned</span>
                  )}
                </Row>
              </dl>
              {m.notes ? (
                <div className="mt-4 rounded-xl bg-foreground/[0.03] p-3.5 ring-1 ring-hairline/60">
                  <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Capture notes
                  </span>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/85">
                    {m.notes}
                  </p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {/* Primary contact */}
          <Card>
            <CardHeader>
              <Eyebrow>Point of contact</Eyebrow>
              <CardTitle className="mt-1">Primary contact</CardTitle>
            </CardHeader>
            <CardBody>
              {m.contactName || lead.contacts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {m.contactName ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-medium text-foreground">
                        {m.contactName}
                      </span>
                      {m.contactTitle ? (
                        <span className="text-[12px] text-muted-foreground">
                          {m.contactTitle}
                        </span>
                      ) : null}
                      <div className="mt-1 flex flex-col gap-1">
                        {m.contactEmail ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/75">
                            <EnvelopeSimple weight="light" className="size-3.5 text-muted-foreground/70" />
                            <span className="font-mono">{m.contactEmail}</span>
                          </span>
                        ) : null}
                        {m.contactPhone ? (
                          <span className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground/75">
                            <Phone weight="light" className="size-3.5 text-muted-foreground/70" />
                            <span className="font-mono">{m.contactPhone}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {lead.contacts.length > 0 ? (
                    <div className="border-t border-hairline/60 pt-3">
                      <span className="text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Linked contacts ({lead.contacts.length})
                      </span>
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {lead.contacts.slice(0, 5).map((c) => (
                          <li
                            key={c.contactId}
                            className="flex items-center justify-between gap-2 text-[12.5px]"
                          >
                            <span className="truncate text-foreground/85">
                              {c.fullName}
                              {c.isPrimary ? (
                                <span className="ml-1.5 text-[10px] text-gold">primary</span>
                              ) : null}
                            </span>
                            {c.primaryEmail ? (
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                {c.primaryEmail}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="py-4 text-center text-[13px] text-muted-foreground">
                  No contact captured yet.
                </p>
              )}
            </CardBody>
          </Card>

          {/* Danger zone */}
          {!isClosed ? (
            <Card>
              <CardHeader>
                <Eyebrow>Admin</Eyebrow>
                <CardTitle className="mt-1 text-[14px]">Stop tracking</CardTitle>
              </CardHeader>
              <CardBody>
                <DeleteLeadButton partyId={lead.partyId} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Activity - interactions, tasks, documents (full width) ----------- */}
      <div className="mt-8 flex flex-col gap-6">
        <SectionHeading
          eyebrow="Activity"
          title="Interaction history, tasks & documents"
          className="mb-2"
        />

        {/* Interactions */}
        <Card>
          <CardHeader>
            <Eyebrow>
              <ChatCircle weight="light" className="size-3.5" /> Interactions
            </Eyebrow>
            <CardTitle className="mt-1">Interaction history</CardTitle>
            <CardDescription>
              {lead.interactions.length} interaction
              {lead.interactions.length === 1 ? "" : "s"} anchored to this lead&apos;s
              party - calls, meetings, notes logged from across the CRM.
            </CardDescription>
          </CardHeader>
          <CardBody className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="hidden md:table-cell">Channel</TableHead>
                  <TableHead className="hidden md:table-cell">Direction</TableHead>
                  <TableHead align="right" className="hidden md:table-cell">Attendees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lead.interactions.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={5} className="p-0">
                      <TableEmpty
                        icon={<ChatCircle weight="light" />}
                        title="No interactions logged yet."
                        hint="Add a note above or log a call from the party record."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  lead.interactions.map((i) => (
                    <TableRow key={i.interactionId}>
                      <TableCell numeric>
                        <span className="nums tabular-nums text-foreground/80">
                          {fmtDateTime(i.occurredAt)}
                        </span>
                      </TableCell>
                      <TableCell primary>
                        {i.subject ? (
                          i.subject
                        ) : (
                          <CellEmpty label="No subject" tooltip="Interaction has no subject" />
                        )}
                        {i.containsMnpi ? (
                          <span className="ml-2 text-[10px] text-gold">MNPI</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {i.channel ? (
                          <Badge variant="neutral">{i.channel}</Badge>
                        ) : (
                          <CellEmpty label="No channel" />
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {i.direction ? (
                          <Badge variant="outline">{i.direction}</Badge>
                        ) : (
                          <CellEmpty label="No direction" />
                        )}
                      </TableCell>
                      <TableCell numeric className="hidden md:table-cell">
                        <span className="nums tabular-nums">{i.attendeeCount}</span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Tasks */}
          <Card>
            <CardHeader>
              <Eyebrow>
                <ListChecks weight="light" className="size-3.5" /> Tasks
              </Eyebrow>
              <CardTitle className="mt-1">Open tasks</CardTitle>
              <CardDescription>
                {lead.tasks.length} task{lead.tasks.length === 1 ? "" : "s"} anchored
                to this lead&apos;s party.
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead className="hidden sm:table-cell">Priority</TableHead>
                    <TableHead align="right">Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lead.tasks.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={3} className="p-0">
                        <TableEmpty
                          icon={<ListChecks weight="light" />}
                          title="No tasks yet."
                          hint="Tasks anchored to this party surface here."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    lead.tasks.map((t) => {
                      const overdue =
                        t.dueDate && !t.completedAt && new Date(t.dueDate) < new Date();
                      return (
                        <TableRow key={t.taskId}>
                          <TableCell primary>
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={cnT(
                                  t.completedAt ? "text-muted-foreground line-through" : "",
                                )}
                              >
                                {t.title}
                              </span>
                              {t.assigneeName ? (
                                <span className="text-[11px] text-muted-foreground">
                                  {t.assigneeName}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {t.priority ? (
                              <Badge
                                variant={
                                  t.priority === "high"
                                    ? "down"
                                    : t.priority === "low"
                                      ? "neutral"
                                      : "info"
                                }
                              >
                                {t.priority}
                              </Badge>
                            ) : (
                              <CellEmpty label="No priority" />
                            )}
                          </TableCell>
                          <TableCell numeric>
                            {t.dueDate ? (
                              <span
                                className={cnT(
                                  "nums tabular-nums",
                                  overdue ? "text-down" : "text-foreground/80",
                                )}
                              >
                                {fmtDate(t.dueDate)}
                              </span>
                            ) : (
                              <CellEmpty label="No due date" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader>
              <Eyebrow>
                <FileText weight="light" className="size-3.5" /> Documents
              </Eyebrow>
              <CardTitle className="mt-1">Documents</CardTitle>
              <CardDescription>
                {documents.length} document{documents.length === 1 ? "" : "s"} attached
                to this lead&apos;s party.
              </CardDescription>
            </CardHeader>
            <CardBody className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead align="right">Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow className="hover:bg-transparent before:hidden">
                      <TableCell colSpan={3} className="p-0">
                        <TableEmpty
                          icon={<FileText weight="light" />}
                          title="No documents attached."
                          hint="Upload from the party record to attach supporting material."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((d) => (
                      <TableRow key={d.documentId}>
                        <TableCell primary>
                          <div className="flex flex-col gap-0.5">
                            <span className="truncate">
                              {d.fileName ? (
                                d.fileName
                              ) : (
                                <CellEmpty label="No filename" />
                              )}
                            </span>
                            {d.isMnpi ? (
                              <span className="text-[10px] text-gold">MNPI</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {d.documentType ? (
                            <Badge variant="neutral">
                              {d.documentType.replace(/_/g, " ")}
                            </Badge>
                          ) : (
                            <CellEmpty label="No type" />
                          )}
                        </TableCell>
                        <TableCell numeric>
                          <span className="nums tabular-nums text-foreground/80">
                            {bytes(d.sizeBytes)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Footer spacer for the mobile bottom nav */}
      <div className="h-6 md:h-2" />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ *
 * Row - a definition-list row in the lead-profile panel.
 * ------------------------------------------------------------------ */
function Row({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-2 text-[11.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {icon ? (
          <span className="text-muted-foreground/70 [&_svg]:size-3.5">{icon}</span>
        ) : null}
        {label}
      </dt>
      <dd className="text-right text-[13px] text-foreground/90">{children}</dd>
    </div>
  );
}

/** Tiny inline target icon for the probability KPI (avoids an extra import). */
function Target4() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1" opacity="0.8" />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}

/** Lightweight conditional-classnames helper (keeps the table rows terse). */
function cnT(...parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}
