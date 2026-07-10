// MCA21 company master + financials adapter.
//
// §11: NO official open API. Access via MCA portal paid downloads (per-company
// fee) or third-party aggregators (Tofler, Zauba, Perfins). MCA API URLs
// returned 403 in research. Portal-scraping is legally risky - avoid.
//
// Access to swap for real: licensed third-party aggregator API subscription
// (per-call or bulk). Vendor integrates against the aggregator's REST API.
//
// Env (see .env.example): MCA_API_KEY (aggregator API key). When mock mode is
// off AND the key is present, `status` flips to "ready" and `run` uses
// `McaClient`.

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

const ADAPTER: AdapterId = "mca";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface McaLookupRequest {
  /** CIN or company name. */
  identifier: string;
  /** "CIN" | "NAME" - how to interpret `identifier`. */
  lookupType: "CIN" | "NAME";
}

export interface McaData {
  cin: string;
  companyName: string;
  companyStatus: string;
  companyClass: string;
  category: string;
  incorporationDate: string;
  registeredOffice: string;
  directors: { din: string; name: string; designation: string; appointmentDate: string }[];
  financials: {
    financialYear: string;
    paidUpCapital: number;
    revenue: number;
    netWorth: number;
    currency: string;
  }[];
  charges: { chargeId: string; chargeHolder: string; amount: number; status: string }[];
  source: string;
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildMcaSample(identifier?: string): McaData {
  const cin = identifier ?? "U65929MH2010LLC207381";
  return {
    cin,
    companyName: "BINARY CAPITAL ADVISORS LLP",
    companyStatus: "ACTIVE",
    companyClass: "LLP",
    category: "Limited Liability Partnership",
    incorporationDate: "2010-11-23",
    registeredOffice: "Suite 402, Maker Chambers V, Nariman Point, Mumbai 400021",
    directors: [
      { din: "03120944", name: "JAY SHAH", designation: "Designated Partner", appointmentDate: "2010-11-23" },
      { din: "06771233", name: "ANITA DESAI", designation: "Designated Partner", appointmentDate: "2014-02-18" },
    ],
    financials: [
      { financialYear: "FY2024-25", paidUpCapital: 50_000_000, revenue: 184_200_000, netWorth: 92_300_000, currency: "INR" },
      { financialYear: "FY2023-24", paidUpCapital: 50_000_000, revenue: 162_500_000, netWorth: 78_100_000, currency: "INR" },
    ],
    charges: [
      { chargeId: "CHG-10293847", chargeHolder: "HDFC Bank Limited", amount: 25_000_000, status: "OPEN" },
    ],
    source: "aggregator:tofler (mock)",
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const MCA_AGGREGATOR_URL = "https://api.tofler.in"; // aggregator (Tofler/Zauba/Perfins)

/**
 * Real MCA21-via-aggregator client. Credential-away: constructed from
 * `MCA_API_KEY`. The upstream is a licensed aggregator REST API (per-call or
 * bulk subscription) - swap `MCA_AGGREGATOR_URL` for the chosen vendor.
 */
export class McaClient {
  private readonly http: HttpClient;

  constructor() {
    const key = requireEnv("MCA_API_KEY", ADAPTER);
    const baseUrl = optionalEnv("MCA_API_BASE_URL") ?? MCA_AGGREGATOR_URL;
    this.http = new HttpClient({
      baseUrl,
      adapter: ADAPTER,
      defaultHeaders: bearerAuth(key),
      timeoutMs: 15_000,
      maxRetries: 3,
    });
  }

  async fetchCompany(req: McaLookupRequest): Promise<McaData> {
    return this.http.request<McaData>({
      method: "GET",
      path: "/company/master",
      query: { identifier: req.identifier, lookupType: req.lookupType },
    });
  }

  async fetchMca(input: AdapterInput): Promise<McaData> {
    const identifier = input.identifier ?? "U65929MH2010LLC207381";
    const lookupType: McaLookupRequest["lookupType"] = /^[LU]/i.test(identifier) ? "CIN" : "NAME";
    const data = await this.fetchCompany({ identifier, lookupType });
    return { ...data, source: "aggregator:tofler (live)" };
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const mca: IntegrationAdapter = {
  id: ADAPTER,
  name: "MCA21 Company Master + Financials",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "registry",
  description:
    "Company master data (CIN, directors, charges) + financials via a licensed aggregator.",
  accessRequirements: [
    "Licensed third-party aggregator API subscription (Tofler/Zauba/Perfins)",
    "Per-call or bulk subscription cost",
    "Avoid portal-scraping (legally risky)",
  ],
  apiAvailability:
    "NO official open API. MCA portal paid downloads OR aggregator APIs. MCA API URLs returned 403 in research.",
  costRisk: "Build ~2-3 PM via aggregator. Per-call/subscription cost.",
  phase: "Phase 2",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const data = buildMcaSample(input?.identifier);
    const result: AdapterResult<McaData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `${data.companyName} (${data.cin}): ${data.companyStatus}; ${data.directors.length} partners; ${data.financials.length} FYs.`,
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
          message: "MCA_API_KEY not set",
          retryable: false,
        });
      }
      const client = new McaClient();
      const data = await client.fetchMca(input ?? {});
      const result: AdapterResult<McaData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${data.companyName} (${data.cin}): ${data.companyStatus}; ${data.directors.length} partners; ${data.financials.length} FYs (live).`,
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
