import { PageHeader, PageShell } from "@/components/brand/page-shell";
import { requireUser } from "@/lib/rbac";
import {
  listConsentRecords,
  listDataSubjectRequests,
} from "@/features/compliance/queries";
import { Reveal } from "@/components/brand";
import { ConsentView } from "./consent-view";

// DB-backed - never prerender. searchParams opt into dynamic rendering
// anyway, but force-dynamic is explicit so the build never tries to execute
// the queries at build time.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const PURPOSES = [
  "marketing",
  "advisory_engagement",
  "kyc_processing",
  "credit_analysis",
  "data_sharing_with_rating_agency",
  "data_sharing_with_investors",
  "regulatory_reporting",
  "portfolio_management",
  "secondary_trading_contact",
];

const DSR_TYPES = [
  "access",
  "erasure",
  "rectification",
  "restriction",
  "portability",
  "withdraw_consent",
];

const DSR_STATUSES = [
  "received",
  "in_review",
  "fulfilled",
  "rejected",
  "cancelled",
];

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    purpose?: string;
    active?: string;
    dsrStatus?: string;
    dsrType?: string;
    tab?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = sp.q?.trim() || undefined;
  const purpose = sp.purpose || undefined;
  const activeOnly = sp.active === "1";
  const dsrStatus = sp.dsrStatus || undefined;
  const dsrType = sp.dsrType || undefined;
  const tab = sp.tab ?? "consent";

  const [consent, dsrs] = await Promise.all([
    listConsentRecords({
      q,
      purpose,
      activeOnly,
      user,
      page: 1,
      pageSize: PAGE_SIZE,
    }),
    listDataSubjectRequests({
      status: dsrStatus,
      requestType: dsrType,
      user,
      page: 1,
      pageSize: PAGE_SIZE,
    }),
  ]);

  return (
    <PageShell>
      <PageHeader title="Consent" description="DPDP consent ledger." />

      <ConsentView
        consent={consent}
        dsrs={dsrs}
        q={q}
        purpose={purpose}
        activeOnly={activeOnly}
        dsrStatus={dsrStatus}
        dsrType={dsrType}
        tab={tab}
        purposes={PURPOSES}
        dsrTypes={DSR_TYPES}
        dsrStatuses={DSR_STATUSES}
      />
    </PageShell>
  );
}
