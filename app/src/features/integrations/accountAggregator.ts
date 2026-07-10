// Account Aggregator (AA) adapter.
//
// §11: open architecture; Binary onboards as a Financial Information User
// (FIU) via Sahamati. ~17 AAs, ~179 FIPs, ~955 FIUs as of 2026. ReBIT +
// Sahamati Central Registry govern API standards. Highest-value, most
// feasible credit-analysis feed - Phase-1 priority.
//
// Real flow: Binary (FIU) requests a consent handle from an AA; the customer
// approves via the AA app; the FIU fetches Financial Information (FI) from
// one or more Financial Information Providers (FIPs) - banks, NBFCs, mutual
// funds, GST, etc. - as linked lists of FI types (deposit, term-deposit,
// recurring-deposit, sip, cp, demat, insurance, gst, ...).
//
// Access to swap for real: Sahamati membership + per-AA transaction fees +
// FIU certification (5 steps). Vendor integrates on Binary's behalf as
// processor under Binary's credentials.
//
// Env (see .env.example): AA_CLIENT_ID, AA_CLIENT_SECRET, AA_ENV
// ("sandbox" | "production"). When `USE_MOCK_INTEGRATIONS` is false (prod
// default) AND the AA creds are present, `status` flips to "ready" and `run`
// dispatches to `AccountAggregatorClient`; otherwise the mock sample payload
// is returned.

import {
  ADAPTER_CREDENTIALS,
  IntegrationError,
  HttpClient,
  bearerAuth,
  credentialsPresent,
  isMockMode,
  optionalEnv,
  requireEnv,
  resolveAdapterStatus,
} from "./env";
import type { AdapterId } from "./env";
import { errorResult, type AdapterInput, type AdapterResult, type IntegrationAdapter } from "./types";

const ADAPTER: AdapterId = "accountAggregator";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface AccountAggregatorConsentRequest {
  /** Customer reference (PAN / investor id) the consent is raised against. */
  customerRef: string;
  /** AA id (e.g. "anumati-aa-001"). */
  aaId: string;
  /** FI types to consent to (deposit, term-deposit, sip, ...). */
  fiTypes: string[];
  /** Consent validity in minutes. */
  expiryMinutes?: number;
}

export interface FipFi {
  fipId: string;
  fipName: string;
  fiType: string;
  linkReferenceNumber: string;
  maskedAccount: string;
  summary: Record<string, string | number>;
}

export interface AccountAggregatorData {
  consentHandle: string;
  aaId: string;
  fiuId: string;
  customerRef: string;
  consentStatus: "APPROVED" | "PENDING" | "EXPIRED";
  consentExpiry: string;
  fips: FipFi[];
}

interface AccountAggregatorFetchResponse {
  consentHandle: string;
  aaId: string;
  fiuId: string;
  customerRef: string;
  consentStatus: AccountAggregatorData["consentStatus"];
  consentExpiry: string;
  fips: FipFi[];
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildAccountAggregatorSample(
  input: Record<string, string | undefined>,
): AccountAggregatorData {
  const customerRef = input.identifier ?? "BCA-INVESTOR-00017";
  return {
    consentHandle: "CHandle-AA0192-2026-" + customerRef.slice(-4),
    aaId: "anumati-aa-001",
    fiuId: "binarycapital-fiu-001",
    customerRef,
    consentStatus: "APPROVED",
    consentExpiry: "2026-09-26T18:30:00+05:30",
    fips: [
      {
        fipId: "hdfc-bank-fip",
        fipName: "HDFC Bank",
        fiType: "deposit",
        linkReferenceNumber: "LRN-HDFC-8841221",
        maskedAccount: "XXXXXX4421",
        summary: {
          currentBalance: 1845000,
          currency: "INR",
          asOn: "2026-06-20",
          branch: "Mumbai-Fort",
        },
      },
      {
        fipId: "icici-bank-fip",
        fipName: "ICICI Bank",
        fiType: "term-deposit",
        linkReferenceNumber: "LRN-ICICI-7712003",
        maskedAccount: "XXXXXX0091",
        summary: {
          principal: 5000000,
          maturityValue: 6112000,
          currency: "INR",
          maturityDate: "2028-06-19",
          rate: 7.1,
        },
      },
      {
        fipId: "cams-fip",
        fipName: "CAMS (MF)",
        fiType: "sip",
        linkReferenceNumber: "LRN-CAMS-5520118",
        maskedAccount: "XXXXXX7741",
        summary: {
          scheme: "ICICI Prudential Corporate Bond Fund",
          folio: "99001122",
          currentValue: 3220400,
          currency: "INR",
          asOn: "2026-06-21",
        },
      },
    ],
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const AA_SANDBOX_URL = "https://api.sandbox.sahamati.org.in";
const AA_PRODUCTION_URL = "https://api.sahamati.org.in";

/**
 * Real Account Aggregator client (Sahamati / per-AA ReBIT API).
 *
 * Credential-away: constructed from `AA_CLIENT_ID` / `AA_CLIENT_SECRET` /
 * `AA_ENV`. Methods build the real request envelope and dispatch via the
 * shared `HttpClient` (timeout + exponential-backoff retry + structured
 * errors). Not invoked in mock mode.
 */
export class AccountAggregatorClient {
  private readonly http: HttpClient;
  private readonly clientId: string;
  private readonly fiuId: string;

  constructor() {
    this.clientId = requireEnv("AA_CLIENT_ID", ADAPTER);
    const clientSecret = requireEnv("AA_CLIENT_SECRET", ADAPTER);
    const env = optionalEnv("AA_ENV") ?? "sandbox";
    const baseUrl = env === "production" ? AA_PRODUCTION_URL : AA_SANDBOX_URL;
    this.fiuId = optionalEnv("AA_FIU_ID") ?? "binarycapital-fiu-001";
    this.http = new HttpClient({
      baseUrl,
      adapter: ADAPTER,
      defaultHeaders: {
        ...bearerAuth(`${this.clientId}:${clientSecret}`),
        "x-fi-id": this.fiuId,
      },
      timeoutMs: 20_000,
      maxRetries: 3,
    });
  }

  /** Request a consent handle from the AA. */
  async createConsent(req: AccountAggregatorConsentRequest): Promise<{ consentHandle: string }> {
    return this.http.request<{ consentHandle: string }>({
      method: "POST",
      path: "/Consent",
      body: {
        ver: "1.1.0",
        txnid: `BCA-${Date.now()}`,
        customer: { id: req.customerRef },
        consent: {
          customer: { id: req.customerRef },
          fipIds: [],
          fiTypes: req.fiTypes,
          expiry: req.expiryMinutes ?? 43200,
        },
      },
    });
  }

  /** Fetch Financial Information for an approved consent handle. */
  async fetchFi(consentHandle: string): Promise<AccountAggregatorFetchResponse> {
    return this.http.request<AccountAggregatorFetchResponse>({
      method: "GET",
      path: `/Fi/fetch/${encodeURIComponent(consentHandle)}`,
    });
  }

  /** High-level: resolve consent + fetch FI for a customer reference. */
  async fetchConsentFi(input: AdapterInput): Promise<AccountAggregatorData> {
    const customerRef = input.identifier ?? "BCA-INVESTOR-00017";
    const aaId = input.context?.aaId ?? "anumati-aa-001";
    const { consentHandle } = await this.createConsent({
      customerRef,
      aaId,
      fiTypes: ["deposit", "term-deposit", "sip"],
    });
    const fi = await this.fetchFi(consentHandle);
    return {
      consentHandle: fi.consentHandle,
      aaId: fi.aaId,
      fiuId: fi.fiuId ?? this.fiuId,
      customerRef: fi.customerRef,
      consentStatus: fi.consentStatus,
      consentExpiry: fi.consentExpiry,
      fips: fi.fips,
    };
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const accountAggregator: IntegrationAdapter = {
  id: ADAPTER,
  name: "Account Aggregator (Sahamati)",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "financial_data",
  description:
    "Consented financial-data fetch from FIPs via Account Aggregators for credit analysis.",
  accessRequirements: [
    "Binary onboards as FIU with Sahamati (5-step certification)",
    "Sahamati Technical Services integration + test/certify/go-live",
    "Per-AA transaction fees (TO CONFIRM)",
    "Vendor integrates as processor under Binary's FIU credentials",
  ],
  apiAvailability:
    "OPEN architecture; ReBIT + Sahamati Central Registry API standards. ~17 AAs, ~179 FIPs, ~955 FIUs (2026).",
  costRisk:
    "Build ~4-6 PM (consent UI, multi-AA fallback, FIP parsing, retries). HIGHEST-VALUE, MOST FEASIBLE credit feed.",
  phase: "Phase 1",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const ctx = input?.context ?? {};
    const data = buildAccountAggregatorSample({
      identifier: input?.identifier,
      ...ctx,
    });
    const result: AdapterResult<AccountAggregatorData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `Consent ${data.consentStatus}; ${data.fips.length} FIPs returned (deposit, term-deposit, sip).`,
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
          message: "AA_CLIENT_ID / AA_CLIENT_SECRET not set",
          retryable: false,
        });
      }
      const client = new AccountAggregatorClient();
      const data = await client.fetchConsentFi(input ?? {});
      const result: AdapterResult<AccountAggregatorData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `Consent ${data.consentStatus}; ${data.fips.length} FIPs returned (live).`,
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
