// CDSL / NSDL depository (demat) adapter.
//
// §11: DP-system access ONLY for SEBI-registered Depository Participants +
// empaneled software vendors (NSDL SPEED-e, CDSL easi/easiest, STP
// segments). NO open demat API for non-DP. Binary's DP registration
// UNVERIFIED - likely NOT a DP.
//
// Access to swap for real: Binary must be a SEBI-registered DP (or work
// through one). ADVERSARIAL CHECK: DP registration UNVERIFIED - likely NOT a
// DP. If not a DP (likely), store demat details as REFERENCE DATA only -
// scope OUT.
//
// Env (see .env.example): DP_API_USER, DP_API_KEY. Depository selected via
// `input.context.depository` ("CDSL" | "NSDL"). When mock mode is off AND the
// DP creds are present, `status` flips to "ready" and `run` uses
// `DematClient`.

import {
  ADAPTER_CREDENTIALS,
  IntegrationError,
  HttpClient,
  basicAuth,
  credentialsPresent,
  isMockMode,
  optionalEnv,
  requireEnv,
  resolveAdapterStatus,
} from "./env";
import type { AdapterId } from "./env";
import { errorResult, type AdapterInput, type AdapterResult, type IntegrationAdapter } from "./types";

const ADAPTER: AdapterId = "demat";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface DematHolding {
  isin: string;
  securityName: string;
  quantity: number;
  faceValue: number;
  holdingMode: string;
  pledgeStatus: string;
}

export interface DematAccount {
  depository: "CDSL" | "NSDL";
  dpId: string;
  clientId: string;
  boId: string;
  holderName: string;
  status: "ACTIVE" | "SUSPENDED";
  kycLinked: boolean;
  holdings: DematHolding[];
  lastValueDate: string;
}

type DematLookupResponse = DematAccount;

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildDematSample(input: {
  identifier?: string;
  depository?: DematAccount["depository"];
}): DematAccount {
  const depository = input.depository ?? "CDSL";
  const boId = input.identifier ?? "1203300000441098";
  return {
    depository,
    dpId: "120330",
    clientId: "00441098",
    boId,
    holderName: "ROHIT MEHTA",
    status: "ACTIVE",
    kycLinked: true,
    holdings: [
      { isin: "INE002A07170", securityName: "HDFC Bank Ltd 7.45% NCD 2028", quantity: 5000, faceValue: 1000, holdingMode: "SINGLE", pledgeStatus: "UNPLEDGED" },
      { isin: "INE234A08AB1", securityName: "Tata Capital 7.30% NCD 2029", quantity: 3000, faceValue: 1000, holdingMode: "SINGLE", pledgeStatus: "UNPLEDGED" },
    ],
    lastValueDate: "2026-06-25",
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const CDSL_DP_URL = "https://api.cdslindia.com";
const NSDL_DP_URL = "https://api.nsdl.co.in";

/**
 * Real CDSL/NSDL DP client. Credential-away: constructed from `DP_API_USER` /
 * `DP_API_KEY`. DP-only; Binary's DP registration UNVERIFIED - likely
 * scope-OUT for a non-DP.
 */
export class DematClient {
  private readonly http: HttpClient;

  constructor() {
    const user = requireEnv("DP_API_USER", ADAPTER);
    const key = requireEnv("DP_API_KEY", ADAPTER);
    const depository = (optionalEnv("DP_DEPOSITORY") as DematAccount["depository"] | undefined) ?? "CDSL";
    const baseUrl = depository === "NSDL" ? NSDL_DP_URL : CDSL_DP_URL;
    this.http = new HttpClient({
      baseUrl: optionalEnv("DP_API_BASE_URL") ?? baseUrl,
      adapter: ADAPTER,
      defaultHeaders: basicAuth(user, key),
      timeoutMs: 15_000,
      maxRetries: 3,
    });
  }

  async lookupAccount(
    depository: DematAccount["depository"],
    boId: string,
  ): Promise<DematAccount> {
    return this.http.request<DematLookupResponse>({
      method: "GET",
      path: `/dp/${depository.toLowerCase()}/account`,
      query: { boId },
    });
  }

  async fetchDemat(input: AdapterInput): Promise<DematAccount> {
    const depository = (input.context?.depository as DematAccount["depository"]) ?? "CDSL";
    const boId = input.identifier ?? "1203300000441098";
    return this.lookupAccount(depository, boId);
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const demat: IntegrationAdapter = {
  id: ADAPTER,
  name: "CDSL / NSDL Demat",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "registry",
  description:
    "Depository (demat) holdings lookup: DP-only; scope-uncertain for a non-DP.",
  accessRequirements: [
    "Binary must be a SEBI-registered DP (or work through one)",
    "ADVERSARIAL CHECK: DP registration UNVERIFIED; likely NOT a DP",
    "If not a DP: store demat details as REFERENCE DATA only (scope OUT)",
  ],
  apiAvailability:
    "DP-system access ONLY for SEBI-registered DPs + empaneled vendors (NSDL SPEED-e, CDSL easi/easiest, STP). NO open demat API.",
  costRisk: "Build ~3-4 PM IF DP connectivity in scope. If NOT a DP (likely), reference-data only: scope OUT.",
  phase: "Phase 3",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const depository = (input?.context?.depository as DematAccount["depository"]) ?? "CDSL";
    const data = buildDematSample({ identifier: input?.identifier, depository });
    const result: AdapterResult<DematAccount> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `${depository} BO ${data.boId} ${data.status}; ${data.holdings.length} NCD holdings (DP-only; DP registration UNVERIFIED).`,
      data,
    };
    return result;
  },
  async runReal(input) {
    try {
      if (!credentialsPresent(ADAPTER)) {
        throw new IntegrationError({
          adapter: ADAPTER,
          code: "not_configured",
          message: "DP_API_USER / DP_API_KEY not set",
          retryable: false,
        });
      }
      const client = new DematClient();
      const data = await client.fetchDemat(input ?? {});
      const result: AdapterResult<DematAccount> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${data.depository} BO ${data.boId} ${data.status}; ${data.holdings.length} NCD holdings (live).`,
        data,
      };
      return result;
    } catch (err) {
      return errorResult(this.id, this.name, "ready", err);
    }
  },
  async run(input) {
    if (isMockMode(ADAPTER)) return this.runMock(input);
    return this.runReal(input);
  },
};
