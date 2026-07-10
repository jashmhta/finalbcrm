// Lead & Opportunity Management - feature barrel.
//
// Re-exports the domain types/constants, the icon resolver, the server data
// access, and the server actions so app routes import from one path.

export * from "./types";
export { LeadDealTypeIcon, LeadSourceIcon, leadDealTypeTone } from "./lead-icons";
export {
  listRms,
  fetchAllLeads,
  getLeadsPipeline,
  getLeadDetail,
  getConversionAnalytics,
  normalizeLead,
  type RmOption,
  type LeadRow,
  type LeadPipelineGroup,
  type LeadContact,
  type LeadTask,
  type LeadDetail,
  type ConversionAnalytics,
  type SourceBreakdown,
  type DealTypeBreakdown,
  type RmBreakdown,
  type MonthBucket,
} from "./queries";
export {
  createLead,
  updateBant,
  convertToOpportunity,
  updateProbability,
  updateExpectedClose,
  updateAssignedRm,
  winLead,
  loseLead,
  addLeadNote,
  deleteLead,
  type CreateLeadState,
  type UpdateBantState,
  type ConvertState,
  type FieldState,
  type WinState,
  type LoseState,
  type NoteState,
  type DeleteState,
} from "./actions";
