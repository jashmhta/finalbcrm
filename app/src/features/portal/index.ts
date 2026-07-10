// Investor & Client Portals - feature barrel.
//
// Re-exports the read-only server queries (data access) + the lazy client
// chart wrappers (recharts) + the shared types so the portal pages import from
// a single path. No server actions live here - both portals are strictly
// read-only.

export {
  // Investor portal
  listInvestors,
  getInvestorDetail,
  // Client portal
  listClients,
  getClientDetail,
  // Display helpers
  PORTAL_ENUM_LABELS,
} from "./queries";

export type {
  InvestorListItem,
  InvestorListSummary,
  InvestorHolding,
  InvestorAllocationHistoryRow,
  InvestorDematAccount,
  InvestorKyc,
  InvestorPartyInfo,
  BreakdownPoint,
  InvestorDetail,
  ClientListItem,
  ClientListSummary,
  ClientDealRow,
  ClientDocumentRow,
  ClientKycRow,
  ClientContactRow,
  ClientDetail,
} from "./queries";

export {
  PortalDonutChart,
  PortalHBarChart,
  PortalVBarChart,
  PORTAL_PALETTE,
} from "./portal-charts";

export type { DonutPoint, LabelValuePoint } from "./portal-charts";
