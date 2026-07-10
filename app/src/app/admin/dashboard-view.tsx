"use client";

// Admin dashboard client view - count-up KPIs, system-health rail, recent
// audit event table + breakdowns. Mount-based motion (initial→animate), NOT
// whileInView-gated, so the dashboard paints in headless snapshots and above
// the fold on first paint. Only transform/opacity animate; the custom
// cubic-bezier ease token is used throughout.

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Keyhole,
  Handshake,
  Buildings,
  Database,
  ShieldCheck,
  ShieldWarning,
  LockSimple,
  Fingerprint,
  UserCircle,
  ArrowRight,
  SealCheck,
  LinkBreak,
  Hash,
  Lightning,
} from "@phosphor-icons/react";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import type {
  SystemStats,
  SystemHealth,
  AuditLogRow,
} from "@/features/admin/queries";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Eyebrow,
  StatCard,
  Badge,
  ActionBadge,
  actionFromVerb,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  EmptyState,
  IconTile,
} from "@/components/brand";

const EASE = [0.32, 0.72, 0, 1] as const;

export interface AdminDashboardViewProps {
  stats: SystemStats;
  health: SystemHealth;
  recent: AuditLogRow[];
  entityBreak: { entityType: string; n: number }[];
  opBreak: { operation: string; n: number }[];
  topActors: { actorEmail: string | null; n: number }[];
}

/** Relative "2m ago" for the recent-audit rail. */
function relativeTime(v: string | Date | null): string {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (!Number.isFinite(d.getTime())) return "-";
  const diff = Math.max(0, Date.now() - d.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return "just now";
  if (sec < 90) return "1m ago";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-IN", { month: "short", day: "2-digit" });
}

function prettify(s: string): string {
  return s.replace(/_/g, " ");
}

const maxEntity = (rows: { n: number }[]) =>
  rows.reduce((m, r) => Math.max(m, r.n), 0);

export function AdminDashboardView({
  stats,
  health,
  recent,
  entityBreak,
  opBreak,
  topActors,
}: AdminDashboardViewProps) {
  const maxEntityN = maxEntity(entityBreak);
  const maxOpN = maxOp(opBreak);
  const chainPct =
    health.auditTotalRows > 0
      ? Math.round((health.auditChainedRows / health.auditTotalRows) * 100)
      : 0;
  const chainHealthy = chainPct === 100;

  return (
    <div className="flex flex-col gap-8">
      {/* ── KPI bento ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          icon={Users}
          label="Users"
          value={stats.userCount}
          preset="int"
          hint={`${stats.activeUserCount} active`}
          ambient
        />
        <KpiTile
          icon={Keyhole}
          label="Roles"
          value={stats.roleCount}
          preset="int"
          hint={`${stats.permissionCount} permissions`}
        />
        <KpiTile
          icon={Handshake}
          label="Deals"
          value={stats.dealCount}
          preset="int"
        />
        <KpiTile
          icon={Buildings}
          label="Parties"
          value={stats.partyCount}
          preset="int"
        />
        <KpiTile
          icon={Database}
          label="DB size"
          value={stats.dbSizeBytes / (1024 * 1024)}
          preset="decimal1"
          suffix=" MB"
          hint={`${stats.auditLogCount.toLocaleString("en-IN")} audit rows`}
        />
      </div>

      {/* ── System health + audit chain ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <Eyebrow dot>System health</Eyebrow>
            <CardTitle className="mt-1 text-lg">Security posture</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <HealthTile
                icon={ShieldCheck}
                label="Active users"
                value={health.activeUsers}
                tone="good"
              />
              <HealthTile
                icon={ShieldWarning}
                label="Inactive"
                value={health.inactiveUsers}
                tone={health.inactiveUsers > 0 ? "warn" : "neutral"}
              />
              <HealthTile
                icon={LockSimple}
                label="Locked"
                value={health.lockedUsers}
                tone={health.lockedUsers > 0 ? "bad" : "neutral"}
              />
              <HealthTile
                icon={Fingerprint}
                label="MFA enrolled"
                value={health.mfaEnrolledUsers}
                tone="good"
              />
              <HealthTile
                icon={UserCircle}
                label="Never logged in"
                value={health.neverLoggedIn}
                tone={health.neverLoggedIn > 0 ? "warn" : "neutral"}
              />
              <HealthTile
                icon={SealCheck}
                label="Audit chain"
                value={chainPct}
                suffix="%"
                tone={chainHealthy ? "good" : "bad"}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3 text-[12px] ring-1 ring-inset ring-foreground/[0.07]">
              {chainHealthy ? (
                <>
                  <LinkBreak
                    weight="light"
                    className="size-3.5 text-emerald-500"
                  />
                  <span className="text-muted-foreground">
                    Hash chain intact -{" "}
                    <span className="nums tabular-nums text-foreground">
                      {health.auditChainedRows.toLocaleString("en-IN")}
                    </span>{" "}
                    of{" "}
                    <span className="nums tabular-nums text-foreground">
                      {health.auditTotalRows.toLocaleString("en-IN")}
                    </span>{" "}
                    rows carry a verified row_hash.
                  </span>
                </>
              ) : (
                <>
                  <LinkBreak
                    weight="light"
                    className="size-3.5 text-rose-500"
                  />
                  <span className="text-muted-foreground">
                    Chain gap detected -{" "}
                    <span className="nums tabular-nums text-foreground">
                      {health.auditTotalRows - health.auditChainedRows}
                    </span>{" "}
                    rows missing a row_hash. Investigate via the audit log.
                  </span>
                </>
              )}
              {health.lastEventAt ? (
                <span className="ml-auto text-muted-foreground">
                  Last event {relativeTime(health.lastEventAt)}
                </span>
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* Top actors */}
        <Card>
          <CardHeader>
            <Eyebrow dot>Top actors</Eyebrow>
            <CardTitle className="mt-1 text-lg">By event count</CardTitle>
          </CardHeader>
          <CardBody className="pt-0">
            {topActors.length === 0 ? (
              <EmptyState
                icon={<Users weight="light" />}
                title="No actors yet."
                hint="The audit log is empty."
                align="start"
              />
            ) : (
              <ol className="flex flex-col gap-2">
                {topActors.map((a, i) => (
                  <li
                    key={a.actorEmail ?? `anon-${i}`}
                    className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5 ring-1 ring-inset ring-foreground/[0.07]"
                  >
                    <span className="nums grid size-6 place-items-center rounded-full bg-foreground/[0.08] text-[11px] font-medium tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <span
                      className={cn(
                        "truncate text-[13px]",
                        a.actorEmail
                          ? "text-foreground"
                          : "italic text-muted-foreground",
                      )}
                      title={a.actorEmail ?? "System / trigger"}
                    >
                      {a.actorEmail ?? "System / trigger"}
                    </span>
                    <Badge variant="neutral" className="ml-auto nums tabular-nums">
                      {a.n.toLocaleString("en-IN")}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Recent audit + breakdowns ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent audit table - spans 2 cols */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Eyebrow dot>Recent activity</Eyebrow>
                <CardTitle className="mt-1 text-lg">Audit log</CardTitle>
              </div>
              <Link
                href="/admin/audit"
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-muted-foreground ring-1 ring-hairline transition-colors hover:text-foreground"
              >
                Open forensic view
                <ArrowRight weight="light" className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <Table density="compact">
              <TableHeader>
                <TableRow>
                  <TableHead>Operation</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead className="hidden md:table-cell">Actor</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow className="hover:bg-transparent before:hidden">
                    <TableCell colSpan={4} className="p-0">
                      <EmptyState
                        icon={<SealCheck weight="light" />}
                        title="The log is at genesis."
                        hint="No audit events have been recorded yet."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.map((row) => {
                    const verb = actionFromVerb(row.operation);
                    return (
                      <TableRow key={row.auditLogId}>
                        <TableCell>
                          <ActionBadge action={verb}>
                            {row.operation}
                          </ActionBadge>
                        </TableCell>
                        <TableCell>
                          <span className="text-foreground">
                            {prettify(row.entityType)}
                          </span>
                          {row.fieldName ? (
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              · {row.fieldName}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {row.actorEmail ? (
                            <span className="text-muted-foreground">
                              {row.actorEmail}
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground">
                              system
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right nums tabular-nums text-muted-foreground">
                          {relativeTime(row.occurredAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardBody>
        </Card>

        {/* Breakdowns - entity + operation */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <Eyebrow dot>Event mix</Eyebrow>
              <CardTitle className="mt-1 text-lg">By operation</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              {opBreak.length === 0 ? (
                <EmptyState
                  icon={<Hash weight="light" />}
                  title="No events recorded."
                  hint="The operation breakdown is empty."
                  align="start"
                />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {opBreak.map((o) => {
                    const pct = maxOpN > 0 ? (o.n / maxOpN) * 100 : 0;
                    return (
                      <li key={o.operation} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[12px]">
                          <ActionBadge action={actionFromVerb(o.operation)}>
                            {o.operation}
                          </ActionBadge>
                          <span className="nums tabular-nums text-muted-foreground">
                            {o.n.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]">
                          <motion.div
                            className="h-full rounded-full bg-gold/70"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: EASE }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Eyebrow dot>Top entities</Eyebrow>
              <CardTitle className="mt-1 text-lg">By type</CardTitle>
            </CardHeader>
            <CardBody className="pt-0">
              {entityBreak.length === 0 ? (
                <EmptyState
                  icon={<Lightning weight="light" />}
                  title="No entities touched."
                  hint="The entity breakdown is empty."
                  align="start"
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {entityBreak.map((e) => {
                    const pct = maxEntityN > 0 ? (e.n / maxEntityN) * 100 : 0;
                    return (
                      <li
                        key={e.entityType}
                        className="flex items-center gap-3 text-[12px]"
                      >
                        <span className="w-28 shrink-0 truncate text-muted-foreground">
                          {prettify(e.entityType)}
                        </span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                          <motion.div
                            className="h-full rounded-full bg-emerald-500/70"
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: EASE }}
                          />
                        </div>
                        <span className="nums w-12 shrink-0 text-right tabular-nums text-foreground">
                          {e.n.toLocaleString("en-IN")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function maxOp(rows: { n: number }[]): number {
  return rows.reduce((m, r) => Math.max(m, r.n), 0);
}

// ---------------------------------------------------------------------------
// KPI tile - StatCard inside the double-bezel Card with an ambient halo for
// the lead tile.
// ---------------------------------------------------------------------------

function KpiTile({
  icon: Icon,
  label,
  value,
  preset,
  suffix,
  hint,
  ambient,
}: {
  icon: PhosphorIcon;
  label: string;
  value: number;
  preset: "int" | "decimal1" | "decimal3" | "percent1" | "currency" | "raw";
  suffix?: string;
  hint?: string;
  ambient?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Card className="h-full">
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Eyebrow>{label}</Eyebrow>
            <IconTile size={16} tone={ambient ? "gold" : "neutral"} icon={Icon} />
          </div>
          <StatCard
            label={label}
            value={value}
            preset={preset}
            suffix={suffix}
            className="text-2xl"
          />
          {hint ? (
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          ) : null}
        </CardBody>
      </Card>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Health tile - small labeled count with a tone-colored glyph disc.
// ---------------------------------------------------------------------------

function HealthTile({
  icon: Icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: PhosphorIcon;
  label: string;
  value: number;
  suffix?: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-500"
      : tone === "warn"
        ? "text-amber-500"
        : tone === "bad"
          ? "text-rose-500"
          : "text-muted-foreground";
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-3 ring-1 ring-inset ring-foreground/[0.07]">
      <span
        className={cn(
          "grid size-8 place-items-center rounded-full bg-foreground/[0.06]",
          toneClass,
        )}
      >
        <Icon weight="light" className="size-4" />
      </span>
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="nums text-lg font-medium tabular-nums text-foreground">
          {value.toLocaleString("en-IN")}
          {suffix}
        </span>
      </div>
    </div>
  );
}
