// Shared types for integration adapters.
//
// Every adapter in this directory implements `IntegrationAdapter`. Each adapter
// ships BOTH a real API client class (typed request/response, env-credential
// loading, fetch with timeout + retry + structured errors) AND a mock
// implementation that returns the realistic sample data the UI screens use.
//
// Which one the registry/Server Actions invoke is driven by env (see env.ts):
//   • `USE_MOCK_INTEGRATIONS` (default: true in dev, false in prod when
//     credentials are present) plus per-adapter `USE_MOCK_<ADAPTER_ID>` pins.
//   • `status` is resolved from env so the /integrations page shows real vs
//     mock based on the deployed configuration.
//
// The contract uses plain JSON-serializable shapes so a Server Action can
// return an `AdapterResult` directly to the UI without bespoke serialization.
// The one string-payload exception is the FIU-IND adapter, which returns a
// FINnet-style XML string in `raw`.

import type { AdapterId } from "./env";

export type AdapterStatus = "mock" | "ready";

/** Result of a single adapter invocation (mock or real). */
export interface AdapterResult<TData = unknown> {
  /** Adapter id, e.g. "accountAggregator". */
  adapter: string;
  /** Human-readable adapter name. */
  name: string;
  /** Whether the call succeeded (mocks always succeed unless input is invalid). */
  ok: boolean;
  /** Current implementation status (env-resolved at call time). */
  status: AdapterStatus;
  /** ISO timestamp of the call. */
  fetchedAt: string;
  /** One-line human summary for the UI status row. */
  summary: string;
  /** Realistic sample payload (JSON-serializable). */
  data: TData;
  /** Optional raw string payload (e.g. FINnet XML). */
  raw?: string;
  /** Optional error message when `ok` is false. */
  error?: string;
  /** Structured error code when `ok` is false (see IntegrationError). */
  errorCode?: string;
}

/** Input passed to adapter runs - a small, zod-validated argument bag. */
export interface AdapterInput {
  /** PAN / GSTIN / CKYC id / party id / consent handle, depending on adapter. */
  identifier?: string;
  /** Free-form context (deal id, party name, mode, etc.) for richer output. */
  context?: Record<string, string>;
}

/**
 * Common interface every adapter implements. The registry iterates over these.
 *
 * `runMock` always returns the realistic sample payload (used by the UI mock
 * flows). `runReal` calls the typed upstream client (throws/returns an error
 * result when credentials are absent). `run` dispatches between the two based
 * on the env mock-mode flag - this is the production entry point. The metadata
 * (accessRequirements / apiAvailability / costRisk / phase) drives the status
 * page and is independent of mock/real mode.
 */
export interface IntegrationAdapter {
  id: AdapterId;
  name: string;
  /**
   * Env-resolved status: "ready" when the real client is wired (mock mode off
   * AND credentials present), otherwise "mock". Implemented as a getter on each
   * adapter so the registry reflects the deployed configuration.
   */
  status: AdapterStatus;
  category:
    | "financial_data"
    | "kyc"
    | "registry"
    | "market_data"
    | "reporting"
    | "communication";
  description: string;
  /** What Binary must obtain before the real adapter can go live. */
  accessRequirements: string[];
  apiAvailability: string;
  costRisk: string;
  /** Roadmap phase (per §17): "Phase 1" | "Phase 2" | "Phase 3". */
  phase: string;
  /** Env var names the real client reads (for the registry/UI display). */
  requiredEnvKeys: string[];
  /** True when the real client has enough credentials to attempt a call. */
  credentialsPresent(): boolean;
  /** Run the mock implementation and return a realistic sample result. */
  runMock(input?: AdapterInput): Promise<AdapterResult>;
  /** Run the real upstream client. Returns an error result when not configured. */
  runReal(input?: AdapterInput): Promise<AdapterResult>;
  /** Production entry point: dispatch to mock or real based on env. */
  run(input?: AdapterInput): Promise<AdapterResult>;
}

/** Wrap a thrown unknown into a stable AdapterResult error payload. */
export function errorResult(
  adapter: string,
  name: string,
  status: AdapterStatus,
  err: unknown,
): AdapterResult<null> {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string"
      ? ((err as { code: string }).code)
      : undefined;
  return {
    adapter,
    name,
    ok: false,
    status,
    fetchedAt: new Date().toISOString(),
    summary: "Call failed",
    data: null,
    error: msg,
    errorCode: code,
  };
}
