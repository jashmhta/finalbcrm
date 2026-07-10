// Client Onboarding - feature barrel.
//
// Re-exports the domain types/constants, the icon resolver, the server data
// access, and the server actions so app routes import from one path.

export * from "./types";
export {
  OnboardingDocIcon,
  OnboardingStageIcon,
  onboardingStageTone,
  ONBOARDING_STAGE_ICON_TONE,
  ComplianceScaleIcon,
} from "./onboarding-icons";
export {
  listRms,
  fetchAllOnboarding,
  getOnboardingPipeline,
  getOnboardingDetail,
  getOnboardingAnalytics,
  getLinkedKycStatus,
  normalizeOnboarding,
  type RmOption,
  type OnboardingRow,
  type OnboardingPipelineGroup,
  type OnboardingContact,
  type OnboardingTask,
  type OnboardingDetail,
  type OnboardingKycState,
  type OnboardingAnalytics,
  type OnboardingStageBreakdown,
  type OnboardingClientTypeBreakdown,
  type OnboardingRmBreakdown,
} from "./queries";
export {
  createOnboarding,
  advanceStage,
  startKyc,
  markDocumentUploaded,
  verifyDocument,
  rejectDocument,
  approveCompliance,
  rejectCompliance,
  activateClient,
  updateAssignedRm,
  deleteOnboarding,
  type CreateOnboardingState,
  type AdvanceStageState,
  type StartKycState,
  type DocUploadState,
  type DocVerifyState,
  type ComplianceState,
  type ActivateState,
  type FieldState,
  type DeleteState,
} from "./actions";
