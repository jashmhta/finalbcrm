// Workflow Automation - notifications, reminders, escalations.
//
// A notification here is a COMPUTED signal: the engine scans the live data
// (kyc_record, deal, credit_analysis, task, consent_record) for trigger
// conditions and returns a typed Notification[] - nothing is persisted. Read
// state (which notifications the user has dismissed) is stored in a cookie
// (see queries.ts / actions.ts), so the MVP needs no schema change. The set
// is recomputed fresh on every load; a notification disappears when its
// trigger condition clears (e.g. the overdue task is completed, the stuck
// deal advances, the expired KYC is re-run).
//
// Notification IDs are DETERMINISTIC (`${type}-${entityId}`) so the read-cookie
// stays stable across loads: the same overdue task yields the same id until it
// is completed, then the notification (and its cookie entry) simply stops
// being generated.
//
// Domain (Indian bond house / IB - Binary Capital + Binary Bonds):
//   KYC re-KYC due   → RBI PMLA risk-based periodicity (kyc_record.rekyc_due_date).
//   Deal stuck       → a mandate idle past its stage SLA.
//   Credit committee → an internal credit analysis awaiting a committee ruling.
//   Task overdue     → a desk task past its due date.
//   Consent withdrawn→ a DPDP consent revoked (consent_record.consent_withdrawn_at).
//   Duplicate party   → party_duplicate_candidate open for merge review.

/** Severity - maps to the brand Badge variants + the icon by severity. */
export type Severity = "info" | "warning" | "critical";

/** The computed trigger types (single source of truth for filters + icons). */
export type NotificationType =
  | "kyc_expiring"
  | "kyc_expired"
  | "deal_stuck"
  | "credit_committee_pending"
  | "task_overdue"
  | "task_due_soon"
  | "consent_withdrawn"
  | "party_duplicate";

/** A notification stamped with its read flag - the shape the page + bell
 *  render. Defined here (not in queries.ts) so client components can import
 *  it without pulling the `db`-importing queries module into their bundle.
 *  `read` is derived from the read-state cookie's dismissed-entity-id set.
 *  `relative` is the precomputed relative-time string ("3 days ago" / "in 12
 *  days") stamped SERVER-side so the client never calls `Date.now()` (which
 *  would risk an SSR/hydration mismatch at minute boundaries). */
export interface NotificationView extends Notification {
  read: boolean;
  relative: string;
}

/** A computed notification - serializable so it can cross the RSC boundary. */
export interface Notification {
  /** Deterministic id: `${type}:${entityId}`. Stable across loads so the
   *  read-cookie (a set of dismissed ids) matches the same condition over time. */
  id: string;
  type: NotificationType;
  severity: Severity;
  /** One-line headline (e.g. "KYC re-KYC due in 12 days"). */
  title: string;
  /** One-sentence context - what to do / why it fired. */
  description: string;
  /** Internal route to the linked entity (click → navigate). */
  href: string;
  /** The entity's human label (party legal name / deal code / task title). */
  entityLabel: string;
  /** The entity's primary key (uuid) - for the read-cookie + deep links. */
  entityId: string;
  /** ISO timestamp of the trigger's reference instant (the due date / the
   *  last touch / the withdrawal date). Drives the relative timestamp. For
   *  future-dated triggers (e.g. kyc_expiring) this is the upcoming due date. */
  occurredAt: string;
}

/** Per-severity counts for the notification-center StatCards + the bell badge. */
export interface NotificationStats {
  total: number;
  unread: number;
  critical: number;
  warning: number;
  info: number;
}

// ---------------------------------------------------------------------------
// Canonical orderings + display labels (single source of truth for the UI).
// ---------------------------------------------------------------------------

/** Filter order in the command bar - all / critical / warning / info. */
export const SEVERITY_ORDER: Severity[] = ["critical", "warning", "info"];

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

/** Brand Badge variant per severity. `down` is this design system's rose/
 *  destructive token (the `--down` oklch red, aliased to `--destructive`), so
 *  "critical" reads as the loss/escalation signal without a neon red. */
export const SEVERITY_BADGE_VARIANT: Record<
  Severity,
  "down" | "gold" | "info"
> = {
  critical: "down",
  warning: "gold",
  info: "info",
};

export const NOTIFICATION_TYPE_ORDER: NotificationType[] = [
  "kyc_expired",
  "kyc_expiring",
  "task_overdue",
  "task_due_soon",
  "deal_stuck",
  "credit_committee_pending",
  "consent_withdrawn",
  "party_duplicate",
];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  kyc_expired: "KYC expired",
  kyc_expiring: "KYC re-KYC due",
  task_overdue: "Task overdue",
  task_due_soon: "Task due soon",
  deal_stuck: "Deal stuck",
  credit_committee_pending: "Credit committee pending",
  consent_withdrawn: "Consent withdrawn",
  party_duplicate: "Duplicate party",
};

/** Short filter-group label (the command-bar type filter is grouped by domain). */
export const NOTIFICATION_TYPE_GROUP: Record<
  NotificationType,
  "Compliance" | "Tasks" | "Deals" | "Credit" | "Data quality"
> = {
  kyc_expired: "Compliance",
  kyc_expiring: "Compliance",
  consent_withdrawn: "Compliance",
  task_overdue: "Tasks",
  task_due_soon: "Tasks",
  deal_stuck: "Deals",
  credit_committee_pending: "Credit",
  party_duplicate: "Data quality",
};

// ---------------------------------------------------------------------------
// Pure helpers (safe to import from both server + client components).
// ---------------------------------------------------------------------------

/** Build the deterministic id for a trigger. Exported so the engine + the
 *  read-state helpers agree on the key format. */
export function notificationId(
  type: NotificationType,
  entityId: string,
): string {
  return `${type}:${entityId}`;
}

/**
 * Relative-time formatter - "3 days ago", "in 12 days", "just now", "now".
 * Locale-stable (en-IN) so server + client render identically (no hydration
 * mismatch). Pure, no DOM access - safe on the server.
 *
 * For future-dated triggers (kyc_expiring, task_due_soon) the result reads as
 * "in N days" - the natural framing of an upcoming deadline.
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "-";
  const diffMs = t - now;
  const past = diffMs <= 0;
  const abs = Math.abs(diffMs);
  const sec = Math.round(abs / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);

  if (sec < 45) return "just now";
  if (min < 60) return past ? `${min} min ago` : `in ${min} min`;
  if (hr < 24) return past ? `${hr} hr ago` : `in ${hr} hr`;
  if (day === 1) return past ? "yesterday" : "tomorrow";
  if (day < 30) return past ? `${day} days ago` : `in ${day} days`;
  const month = Math.round(day / 30);
  if (month < 12) return past ? `${month} mo ago` : `in ${month} mo`;
  const year = Math.round(month / 12);
  return past ? `${year} yr ago` : `in ${year} yr`;
}
