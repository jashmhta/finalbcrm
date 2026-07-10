// Integration adapter registry.
//
// Single source of truth for the set of India-regulatory / financial-data
// integrations the CRM must support (per §11 of
// COMPLIANCE_LEGAL_FEASIBILITY.md). Each adapter ships BOTH a real API client
// class (typed request/response, env-credential loading, fetch with timeout +
// retry + structured errors) AND a mock implementation that returns the
// realistic sample data the UI screens use.
//
// Mock vs real is resolved from env per adapter (see env.ts):
//   • `USE_MOCK_INTEGRATIONS` (default: true in dev, false in prod when
//     credentials present) + per-adapter `USE_MOCK_<ADAPTER_ID>` pins.
//   • `status` is a getter on each adapter → the /integrations page shows
//     real vs mock based on the deployed configuration.
//
// `runAdapterMock` / `runMock` (registry-level) keep returning the mock
// sample payloads - used by the existing /integrations "Run" / "Run all"
// flows (preserved). `runAdapter` / `runAll` dispatch to `adapter.run`, which
// is the production entry point (mock in dev, real when wired).

import type { AdapterInput, AdapterResult, IntegrationAdapter } from "./types";

import { accountAggregator } from "./accountAggregator";
import { kra } from "./kra";
import { ckyc } from "./ckyc";
import { mca } from "./mca";
import { gstinPan } from "./gstinPan";
import { bseNse } from "./bseNse";
import { ccil } from "./ccil";
import { demat } from "./demat";
import { ratingFeed } from "./ratingFeed";
import { fiuInd } from "./fiuInd";
import { emailCalendar } from "./emailCalendar";
import { whatsapp } from "./whatsapp";

/** Ordered registry - drive the status page and any per-adapter lookup. */
export const integrationRegistry: IntegrationAdapter[] = [
  accountAggregator,
  kra,
  ckyc,
  gstinPan,
  mca,
  ratingFeed,
  fiuInd,
  emailCalendar,
  whatsapp,
  bseNse,
  ccil,
  demat,
];

/** Quick id -> adapter map. */
export const integrationsById: Record<string, IntegrationAdapter> =
  Object.fromEntries(integrationRegistry.map((a) => [a.id, a]));

/** Lightweight summary row for the status page (no payloads). */
export interface IntegrationSummary {
  id: string;
  name: string;
  /** Env-resolved status: "ready" when the real client is wired, else "mock". */
  status: "mock" | "ready";
  category: IntegrationAdapter["category"];
  phase: string;
  description: string;
  accessRequirements: string[];
  apiAvailability: string;
  costRisk: string;
  /** Env var names the real client reads (registry/UI display). */
  requiredEnvKeys: string[];
  /** Whether the real client has enough credentials to attempt a call. */
  credentialsPresent: boolean;
}

export function listIntegrations(): IntegrationSummary[] {
  return integrationRegistry.map((a) => ({
    id: a.id,
    name: a.name,
    status: a.status,
    category: a.category,
    phase: a.phase,
    description: a.description,
    accessRequirements: a.accessRequirements,
    apiAvailability: a.apiAvailability,
    costRisk: a.costRisk,
    requiredEnvKeys: a.requiredEnvKeys,
    credentialsPresent: a.credentialsPresent(),
  }));
}

export function getAdapter(id: string): IntegrationAdapter | undefined {
  return integrationsById[id];
}

/**
 * Run a single adapter's mock by id. Throws if the adapter is unknown so the
 * Server Action layer can map it to a 400-style response. Always returns the
 * mock sample payload (preserved for the /integrations UI flows).
 */
export async function runAdapterMock(
  id: string,
  input?: AdapterInput,
): Promise<AdapterResult> {
  const adapter = integrationsById[id];
  if (!adapter) {
    throw new Error(`Unknown integration adapter: ${id}`);
  }
  return adapter.runMock(input);
}

/**
 * Run a single adapter via its production dispatch (`run`): mock in dev / when
 * `USE_MOCK_INTEGRATIONS=true`; real upstream when mock mode is off AND
 * credentials are present. Throws if the adapter is unknown.
 */
export async function runAdapter(
  id: string,
  input?: AdapterInput,
): Promise<AdapterResult> {
  const adapter = integrationsById[id];
  if (!adapter) {
    throw new Error(`Unknown integration adapter: ${id}`);
  }
  return adapter.run(input);
}

/**
 * Demo helper: run every adapter's mock in registry order and return the
 * results. Used by the /integrations "Run all mocks" affordance and by the
 * build-time smoke check (no real network calls - purely in-process).
 */
export async function runMock(): Promise<AdapterResult[]> {
  return Promise.all(integrationRegistry.map((a) => a.runMock()));
}

/**
 * Production helper: run every adapter via its dispatch (`run`) in registry
 * order. In dev this is equivalent to `runMock`; in prod with credentials it
 * hits the real upstreams.
 */
export async function runAll(): Promise<AdapterResult[]> {
  return Promise.all(integrationRegistry.map((a) => a.run()));
}

/** Aggregate status counts for the status-page header. */
export function integrationStatusCounts(): {
  total: number;
  mock: number;
  ready: number;
} {
  const mock = integrationRegistry.filter((a) => a.status === "mock").length;
  return { total: integrationRegistry.length, mock, ready: integrationRegistry.length - mock };
}

export type { IntegrationAdapter, AdapterInput, AdapterResult };
