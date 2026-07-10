// Reports & Export - CSV export Route Handler.
//
// GET /reports/export?type=<kind>[&<filter params...>] runs the matching query
// (reusing the feature `list*` queries for per-module exports so the CSV
// always matches the on-screen filtered list) and returns an RFC 4180 CSV
// attachment. The browser handles the download natively via the
// `Content-Disposition: attachment` header - no client-side blob code, no
// function props crossing the RSC boundary. The on-page "Export CSV" buttons
// are plain anchors to this route with the current filter params forwarded.
//
// `force-dynamic` is explicit so the build never tries to execute the queries
// at build time (no DATABASE_URL at build). Auth is enforced server-side via
// `requireUser` (the proxy does the coarse cookie check; this is the
// authoritative RBAC gate, per ARCHITECTURE §4.6).

import { requireUser } from "@/lib/rbac";
import { writeAudit } from "@/lib/audit-write";
import {
  listParties,
  type PartyListItem,
} from "@/features/parties/queries";
import { getDealPipeline } from "@/features/deals/queries";
import { listCreditAnalyses, type CreditAnalysisListItem } from "@/features/credit/queries";
import { listKycRecords, type KycListItem } from "@/features/compliance/queries";
import { listInteractions, type InteractionListItem } from "@/features/interactions/queries";
import { listTasks, type TaskListItem } from "@/features/tasks/queries";
import { listDocuments, type DocumentListItem } from "@/features/documents/queries";
import {
  getPipelineExportRows,
  getRevenueExportRows,
  getCreditExportRows,
  getComplianceKycExportRows,
  PIPELINE_EXPORT_COLUMNS,
  REVENUE_EXPORT_COLUMNS,
  CREDIT_EXPORT_COLUMNS,
  COMPLIANCE_KYC_EXPORT_COLUMNS,
  inrCr,
  dateStr,
  titleize,
  type ExportColumn,
} from "@/features/reports/queries";
import { rowsToCsv, exportFilename, csvDisposition } from "@/features/reports/export";
import { canUseCsvExport } from "@/features/reports/exportAccess";

export const dynamic = "force-dynamic";

/** High cap so a per-module list export ships the whole filtered set, not
 *  just the 25-row screen page. 5000 comfortably covers the seeded book
 *  (10k parties, 1.5k deals, 1k credit analyses) with headroom. */
const EXPORT_PAGE_SIZE = 5000;

/** The set of export kinds the route accepts. Kept in one place so the
 *  ExportCsvButton `type` prop and the route dispatch stay in sync. */
export type ExportKind =
  | "pipeline"
  | "revenue"
  | "credit-report"
  | "compliance-kyc"
  | "parties"
  | "clients"
  | "deals"
  | "credit"
  | "kyc"
  | "interactions"
  | "tasks"
  | "documents";

// ---------------------------------------------------------------------------
// Per-module LIST export column definitions. Each maps the feature's list-
// item type to a CSV row. Format helpers (inrCr / dateStr / titleize) are
// shared with the report-page tables so the CSV reads like the dashboard.
// ---------------------------------------------------------------------------

const PARTIES_COLUMNS: ExportColumn<PartyListItem>[] = [
  { header: "Legal name", value: (r) => r.legalName },
  { header: "Display name", value: (r) => r.displayName ?? "" },
  { header: "Nature", value: (r) => titleize(r.partyNature) },
  { header: "Status", value: (r) => titleize(r.status) },
  { header: "KYC complete", value: (r) => (r.isKycComplete ? "Yes" : "No") },
  { header: "KYC risk", value: (r) => titleize(r.kycRiskRating) },
  { header: "City", value: (r) => r.city ?? "" },
  { header: "Types", value: (r) => r.types.map(titleize).join("; ") },
  { header: "Sector", value: (r) => r.industrySector ?? "" },
  { header: "Turnover band", value: (r) => r.turnoverBand ?? "" },
  { header: "Rating", value: (r) => r.latestRating ?? "" },
  { header: "Rating agency", value: (r) => r.latestRatingAgency ?? "" },
  { header: "Investor type", value: (r) => r.investorType ?? "" },
  { header: "Relationships", value: (r) => r.relationshipCount },
  { header: "Deals", value: (r) => r.dealCount },
  { header: "Contacts", value: (r) => r.contactCount },
  { header: "Created", value: (r) => dateStr(r.createdAt) },
];

const DEALS_COLUMNS: ExportColumn<{
  dealCode: string | null;
  dealName: string | null;
  dealType: string;
  status: string | null;
  brand: string;
  targetSize: string | null;
  targetCloseDate: string | null;
  targetTenorYears: string | null;
  leadParty: string | null;
}>[] = [
  { header: "Deal code", value: (r) => r.dealCode ?? "" },
  { header: "Deal name", value: (r) => r.dealName ?? "" },
  { header: "Type", value: (r) => titleize(r.dealType) },
  { header: "Status", value: (r) => titleize(r.status) },
  { header: "Brand", value: (r) => titleize(r.brand) },
  { header: "Target size (₹ Cr)", value: (r) => (r.targetSize ? Number(r.targetSize) : "") },
  { header: "Target size", value: (r) => inrCr(r.targetSize ? Number(r.targetSize) : null) },
  { header: "Tenor (yrs)", value: (r) => r.targetTenorYears ?? "" },
  { header: "Target close", value: (r) => dateStr(r.targetCloseDate) },
  { header: "Lead party", value: (r) => r.leadParty ?? "" },
];

const CREDIT_LIST_COLUMNS: ExportColumn<CreditAnalysisListItem>[] = [
  { header: "Issuer", value: (r) => r.legalName },
  { header: "Analysis type", value: (r) => titleize(r.analysisType) },
  { header: "Obligor", value: (r) => titleize(r.obligorType) },
  { header: "Internal rating", value: (r) => r.internalRatingShort ?? "" },
  { header: "Score", value: (r) => r.currentCreditScore ?? "" },
  { header: "Band", value: (r) => r.band ?? "" },
  { header: "Lifecycle", value: (r) => r.lifecycleStatus },
  { header: "Rating action", value: (r) => titleize(r.internalRatingAction) },
  { header: "Watchlist", value: (r) => (r.watchlistFlag ? "Yes" : "No") },
  { header: "Created", value: (r) => dateStr(r.createdAt) },
];

const KYC_COLUMNS: ExportColumn<KycListItem>[] = [
  { header: "Party", value: (r) => r.partyLegalName },
  { header: "Contact", value: (r) => r.contactFullName ?? "" },
  { header: "KYC type", value: (r) => titleize(r.kycType) },
  { header: "Status", value: (r) => titleize(r.status) },
  { header: "Risk", value: (r) => titleize(r.riskRating) },
  { header: "Highest BO %", value: (r) => r.highestBoOwnershipPct ?? "" },
  { header: "PEP status", value: (r) => titleize(r.pepStatus) },
  { header: "Valid until", value: (r) => dateStr(r.validUntil) },
  { header: "Re-KYC due", value: (r) => dateStr(r.rekycDueDate) },
  { header: "Approved at", value: (r) => dateStr(r.approvedAt) },
  { header: "Created", value: (r) => dateStr(r.createdAt) },
];

const INTERACTIONS_COLUMNS: ExportColumn<InteractionListItem>[] = [
  { header: "Subject", value: (r) => r.subject ?? "" },
  { header: "Channel", value: (r) => titleize(r.channel) },
  { header: "Direction", value: (r) => titleize(r.direction) },
  { header: "Occurred at", value: (r) => dateStr(r.occurredAt) },
  { header: "Duration (min)", value: (r) => r.durationMin ?? "" },
  { header: "MNPI", value: (r) => (r.containsMnpi ? "Yes" : "No") },
  { header: "Party", value: (r) => r.partyName ?? "" },
  { header: "Deal code", value: (r) => r.dealCode ?? "" },
  { header: "Contact", value: (r) => r.contactName ?? "" },
  { header: "Attendees", value: (r) => r.attendeeCount },
  { header: "Next action", value: (r) => r.nextAction ?? "" },
];

const TASKS_COLUMNS: ExportColumn<TaskListItem>[] = [
  { header: "Title", value: (r) => r.title },
  { header: "Status", value: (r) => titleize(r.status) },
  { header: "Priority", value: (r) => titleize(r.priority) },
  { header: "Due date", value: (r) => dateStr(r.dueDate) },
  { header: "Assignee", value: (r) => r.assigneeEmail ?? "" },
  { header: "Deal code", value: (r) => r.dealCode ?? "" },
  { header: "Party", value: (r) => r.partyName ?? "" },
  { header: "Blocked by", value: (r) => r.blockedByCount },
  { header: "Created", value: (r) => dateStr(r.createdAt) },
];

const DOCUMENTS_COLUMNS: ExportColumn<DocumentListItem>[] = [
  { header: "File name", value: (r) => r.fileName ?? "" },
  { header: "Type", value: (r) => titleize(r.documentType) },
  { header: "KYC category", value: (r) => titleize(r.kycCategory) },
  { header: "MIME type", value: (r) => r.mimeType ?? "" },
  { header: "Size (bytes)", value: (r) => r.sizeBytes ?? "" },
  { header: "Confidential", value: (r) => (r.isConfidential ? "Yes" : "No") },
  { header: "MNPI", value: (r) => (r.isMnpi ? "Yes" : "No") },
  { header: "Deal code", value: (r) => r.dealCode ?? "" },
  { header: "Party", value: (r) => r.partyName ?? "" },
  { header: "Contact", value: (r) => r.contactName ?? "" },
  { header: "Uploaded by", value: (r) => r.uploadedByEmail ?? "" },
  { header: "Retention until", value: (r) => dateStr(r.retentionUntil) },
  { header: "Created", value: (r) => dateStr(r.createdAt) },
];

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

interface ExportBundle {
  csv: string;
  filename: string;
}

/** Pull the `q` (search) param from the request URL if present. */
function optionalQ(sp: URLSearchParams): string | undefined {
  const q = sp.get("q")?.trim();
  return q ? q : undefined;
}

/**
 * Resolve an export `kind` + the current filter params into the CSV bundle.
 * The per-module branches reuse the feature `list*` queries with a high page
 * size so the export matches the filtered list the user sees on screen. The
 * dispatch rides on the `kind` param (NOT `type`) so it never collides with a
 * module's own `type` filter (e.g. /documents' document-type filter is
 * forwarded as `type` and read by the documents branch below).
 */
async function buildExport(
  kind: string,
  sp: URLSearchParams,
  user: Awaited<ReturnType<typeof requireUser>>,
): Promise<ExportBundle | null> {
  switch (kind) {
    case "pipeline": {
      // Report builders remain firm-wide for supers; list exports are scoped.
      const rows = await getPipelineExportRows();
      return {
        csv: rowsToCsv(rows, PIPELINE_EXPORT_COLUMNS),
        filename: exportFilename("pipeline-report"),
      };
    }
    case "revenue": {
      const rows = await getRevenueExportRows();
      return {
        csv: rowsToCsv(rows, REVENUE_EXPORT_COLUMNS),
        filename: exportFilename("revenue-report"),
      };
    }
    case "credit-report": {
      const lifecycle =
        sp.get("lifecycle") === "current" || sp.get("lifecycle") === "superseded"
          ? (sp.get("lifecycle") as "current" | "superseded")
          : undefined;
      const rows = await getCreditExportRows({
        q: optionalQ(sp),
        band: sp.get("band") || undefined,
        lifecycle,
        watchlist: sp.get("watchlist") === "1",
      });
      return {
        csv: rowsToCsv(rows, CREDIT_EXPORT_COLUMNS),
        filename: exportFilename("credit-report"),
      };
    }
    case "compliance-kyc": {
      const rows = await getComplianceKycExportRows();
      return {
        csv: rowsToCsv(rows, COMPLIANCE_KYC_EXPORT_COLUMNS),
        filename: exportFilename("compliance-kyc"),
      };
    }
    case "parties":
    case "clients": {
      const { rows } = await listParties({
        q: optionalQ(sp),
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        user,
      });
      return {
        csv: rowsToCsv(rows, PARTIES_COLUMNS),
        filename: exportFilename(kind === "clients" ? "clients-book" : "parties"),
      };
    }
    case "deals": {
      // The deals board is grouped by stage; flatten the pipeline (per-stage
      // cap 200 covers the full 1.5k book) into one row per deal with its
      // lead party resolved from the inline parties[].
      const { groups } = await getDealPipeline({ perStage: 200, user });
      const flat = groups.flatMap((g) =>
        g.deals.map((d) => ({
          dealCode: d.dealCode,
          dealName: d.dealName,
          dealType: d.dealType,
          status: d.status,
          brand: d.brand,
          targetSize: d.targetSize,
          targetCloseDate: d.targetCloseDate,
          targetTenorYears: d.targetTenorYears,
          leadParty:
            d.parties.find((p) => p.isLead)?.legalName ??
            d.parties[0]?.legalName ??
            null,
        })),
      );
      return {
        csv: rowsToCsv(flat, DEALS_COLUMNS),
        filename: exportFilename("deals"),
      };
    }
    case "credit": {
      const { rows } = await listCreditAnalyses({
        q: optionalQ(sp),
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        user,
      });
      return {
        csv: rowsToCsv(rows, CREDIT_LIST_COLUMNS),
        filename: exportFilename("credit-analyses"),
      };
    }
    case "kyc": {
      const status = sp.get("status") || undefined;
      const risk = sp.get("risk") || undefined;
      const { rows } = await listKycRecords({
        q: optionalQ(sp),
        status,
        risk,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        user,
      });
      return {
        csv: rowsToCsv(rows, KYC_COLUMNS),
        filename: exportFilename("kyc-records"),
      };
    }
    case "interactions": {
      const mnpiOnly = sp.get("mnpi") === "1";
      const { rows } = await listInteractions({
        mnpiOnly,
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        user,
      });
      return {
        csv: rowsToCsv(rows, INTERACTIONS_COLUMNS),
        filename: exportFilename("interactions"),
      };
    }
    case "tasks": {
      const statusKey = sp.get("status") ?? "all";
      const OPEN_ONLY_KEY = "all";
      const { rows } = await listTasks({
        status: statusKey === OPEN_ONLY_KEY ? undefined : statusKey,
        openOnly: statusKey === OPEN_ONLY_KEY,
        assigneeUserId: sp.get("assignee") || undefined,
        q: optionalQ(sp),
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        user,
      });
      return {
        csv: rowsToCsv(rows, TASKS_COLUMNS),
        filename: exportFilename("tasks"),
      };
    }
    case "documents": {
      const typeKey = sp.get("type") ?? "all";
      const { rows } = await listDocuments({
        documentType: typeKey === "all" ? undefined : typeKey,
        mnpiOnly: sp.get("mnpi") === "1",
        q: optionalQ(sp),
        page: 1,
        pageSize: EXPORT_PAGE_SIZE,
        user,
      });
      return {
        csv: rowsToCsv(rows, DOCUMENTS_COLUMNS),
        filename: exportFilename("documents"),
      };
    }
    default:
      return null;
  }
}

/**
 * GET /reports/export?kind=<kind> - stream the CSV attachment. Returns 400 on
 * an unknown `kind`, 200 + the CSV otherwise. Auth enforced via requireUser
 * (throws/redirects on unauthenticated - the proxy already bounced to
 * /login, this is the authoritative gate). The dispatch param is `kind` (not
 * `type`) so a module's own `type` filter (e.g. /documents) can be forwarded
 * through without collision.
 */
export async function GET(req: Request) {
  const user = await requireUser();
  if (!canUseCsvExport(user)) {
    return new Response("Exports are restricted to super admins.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "";

  const bundle = await buildExport(kind, searchParams, user);
  if (!bundle) {
    return new Response(`Unknown export kind: ${kind || "(missing)"}`, {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Audit every CSV export (who / what kind / brand scope).
  await writeAudit({
    actor: user,
    entityType: "export",
    operation: "insert",
    fieldName: kind,
    newValue: {
      kind,
      filename: bundle.filename,
      brandScope: user.brandScope,
      bytes: bundle.csv.length,
    },
  });

  return new Response(bundle.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": csvDisposition(bundle.filename),
      // No-cache so a filter change always re-runs the query (an export with
      // a stale filter would be misleading for a desk blotter).
      "Cache-Control": "no-store",
    },
  });
}
