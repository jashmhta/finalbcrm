import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ChatCircle,
  Phone,
  EnvelopeSimple,
  WhatsappLogo,
  ArrowsLeftRight,
  PresentationChart,
  Handshake,
  Chats,
  SealWarning,
  Clock,
  Users,
  CalendarBlank,
  Buildings,
  User,
  Sparkle,
  ArrowRight,
} from "@/components/brand/icons";

import { requireUser } from "@/lib/rbac";
import { getInteractionDetail } from "@/features/interactions/queries";
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
} from "@/components/brand";
import { Eyebrow, SectionHeading } from "@/components/brand/text";
import { Num } from "@/components/brand/money";
import { PageShell, PageHeader, DetailTopBar } from "@/components/brand/page-shell";

export const dynamic = "force-dynamic";

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  meeting: <ChatCircle weight="light" className="size-4" />,
  call: <Phone weight="light" className="size-4" />,
  email: <EnvelopeSimple weight="light" className="size-4" />,
  whatsapp: <WhatsappLogo weight="light" className="size-4" />,
  rfq: <ArrowsLeftRight weight="light" className="size-4" />,
  ndsom_chat: <Chats weight="light" className="size-4" />,
  site_visit: <Handshake weight="light" className="size-4" />,
  management_presentation: (
    <PresentationChart weight="light" className="size-4" />
  ),
};

export default async function InteractionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const detail = await getInteractionDetail(id, user);
  if (!detail) notFound();

  const {
    interaction: i,
    partyName,
    dealCode,
    dealName,
    contactName,
    primaryContactName,
    attendees,
  } = detail;

  const occurred = i.occurredAt
    ? i.occurredAt.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <PageShell>
      {/* Breadcrumb */}
      <Reveal y={8} duration={0.5} noBlur>
        <div className="mb-6 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Link
              href="/interactions"
              className="inline-flex items-center gap-1.5 transition-colors duration-200 ease-soft hover:text-foreground"
            >
              <ArrowLeft weight="light" className="size-3.5" />
              Interactions
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="nums text-foreground/60">
              {i.interactionId.slice(0, 8)}
            </span>
          </nav>
          <Button
            asChild
            variant="secondary-hairline"
            size="sm"
            trailingIcon={<ArrowUpRight weight="light" className="size-4" />}
          >
            <Link href="/interactions">All interactions</Link>
          </Button>
        </div>
      </Reveal>

      {/* Thread header card */}
      <Reveal y={14} duration={0.6}>
        <Card className="mb-8 overflow-hidden">
          <div className="flex flex-col gap-6 p-6 md:p-8">
            <div className="flex flex-col gap-3">
            <SectionHeading
                display
                eyebrow={i.channel ? i.channel.replace(/_/g, " ") : "Interaction"}
                title={i.subject || "(no subject)"}
              />
            </div>

            {/* Meta rail */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-hairline pt-5 text-[12.5px]">
              <MetaItem icon={CHANNEL_ICON[i.channel ?? ""] ?? <Chats weight="light" className="size-4" />} label="Channel">
                {i.channel ? i.channel.replace(/_/g, " ") : "-"}
              </MetaItem>
              <MetaItem icon={<CalendarBlank weight="light" />} label="Occurred">
                <span className="nums tabular-nums">{occurred ?? "-"}</span>
              </MetaItem>
              <MetaItem icon={<Clock weight="light" />} label="Duration">
                {i.durationMin ? (
                  <span className="nums tabular-nums">
                    <Num value={i.durationMin} /> min
                  </span>
                ) : (
                  "-"
                )}
              </MetaItem>
              <MetaItem icon={<Users weight="light" />} label="Attendees">
                <span className="nums tabular-nums">
                  <Num value={attendees.length} />
                </span>
              </MetaItem>
              {i.barrierId ? (
                <MetaItem icon={<SealWarning weight="light" />} label="Barrier">
                  <span className="nums text-foreground/80">
                    {i.barrierId.slice(0, 8)}
                  </span>
                </MetaItem>
              ) : null}
            </div>
          </div>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Anchors */}
        <Reveal y={14} duration={0.6} delay={0.05}>
          <Card className="h-full">
            <div className="flex flex-col gap-4 p-6">
              <Eyebrow>Anchors</Eyebrow>
              <div className="flex flex-col gap-3.5 text-[13.5px]">
                <AnchorRow icon={<Buildings weight="light" />} label="Party">
                  {partyName && i.partyId ? (
                    <Link
                      href={`/parties/${i.partyId}`}
                      className="transition-colors duration-200 ease-soft hover:text-gold"
                    >
                      {partyName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </AnchorRow>
                <AnchorRow icon={<ArrowsLeftRight weight="light" />} label="Deal">
                  {dealCode ? (
                    <Link
                      href="/deals"
                      className="nums transition-colors duration-200 ease-soft hover:text-gold"
                    >
                      {dealCode}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                  {dealName ? (
                    <span className="ml-2 text-muted-foreground">
                      {dealName}
                    </span>
                  ) : null}
                </AnchorRow>
                <AnchorRow icon={<User weight="light" />} label="Contact">
                  {contactName ?? (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </AnchorRow>
                <AnchorRow icon={<User weight="light" />} label="Primary">
                  {primaryContactName ?? (
                    <span className="text-muted-foreground/60">-</span>
                  )}
                </AnchorRow>
              </div>
            </div>
          </Card>
        </Reveal>

        {/* Follow-up */}
        <Reveal y={14} duration={0.6} delay={0.1}>
          <Card className="h-full">
            <div className="flex h-full flex-col gap-4 p-6">
              <Eyebrow>Follow-up</Eyebrow>
              {i.nextAction ? (
                <div className="flex flex-1 flex-col gap-4">
                  <p className="text-[14px] leading-[1.55] text-foreground/90">
                    {i.nextAction}
                  </p>
                  <div className="mt-auto">
                    <Button
                      asChild
                      variant="secondary-hairline"
                      size="sm"
                      trailingIcon={<ArrowRight weight="light" className="size-4" />}
                    >
                      <Link href="/tasks">Track as task</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center py-6 text-center">
                  <span className="font-display text-[15px] font-light text-muted-foreground">
                    No next action recorded.
                  </span>
                </div>
              )}
            </div>
          </Card>
        </Reveal>
      </div>

      {/* Notes */}
      {i.body ? (
        <Reveal y={14} duration={0.6} delay={0.08} className="mt-6">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 p-6">
              <Eyebrow>Notes</Eyebrow>
              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.65] text-foreground/85">
                {i.body}
              </p>
            </div>
          </Card>
        </Reveal>
      ) : null}

      {/* Attendees */}
      <Reveal y={14} duration={0.6} delay={0.1} className="mt-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-6 pt-6">
            <div className="flex items-center gap-2">
              <Eyebrow dot>Attendees</Eyebrow>
              <span className="nums text-[12.5px] text-muted-foreground/70">
                {attendees.length}
              </span>
            </div>
          </div>
          <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={2} className="p-0">
                      <TableEmpty
                        icon={<Sparkle weight="light" />}
                        title="No attendees on record."
                        hint="This interaction was logged without a participant list."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  attendees.map((a) => (
                    <TableRow key={a.interactionAttendeeId}>
                      <TableCell primary>{a.contactName}</TableCell>
                      <TableCell>
                        {a.roleAtMeeting ? (
                          <Badge variant="neutral">
                            {a.roleAtMeeting.replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/60">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </Reveal>
    </PageShell>
  );
}

function MetaItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="text-foreground/85">{children}</span>
    </div>
  );
}

function AnchorRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline/50 pb-3.5 last:border-0 last:pb-0">
      <span className="inline-flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
        {icon}
        {label}
      </span>
      <span className="text-right text-foreground/85">{children}</span>
    </div>
  );
}
