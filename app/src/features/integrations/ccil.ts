// CCIL F-TRAC trade reporting adapter.
//
// §11: MEMBER WORKFLOW, not public API. CCIL acts as Trade Repository via
// F-TRAC (ftrac.co.in); reporting members access via login. Binary is NOT a
// direct CCIL member (membership for banks/PDs/FIs with RBI approval); any
// CCIL-settled trades clear through a sponsoring bank/PD member.
//
// Access to swap for real: Binary must be a CCIL member/reporting entity.
// ADVERSARIAL CHECK: NOT a direct CCIL member. Likely OUT of scope for an
// arranger/advisory. Rely on member-uploaded data.
//
// Env: CCIL_FTRAC_USER, CCIL_FTRAC_PASSWORD (F-TRAC reporting-member login;
// NOT in .env.example - document as a new key the deploy track should add).
// When mock mode is off AND the creds are present, `status` flips to "ready"
// and `run` uses `CcilClient`.

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

const ADAPTER: AdapterId = "ccil";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface FtracRecord {
  tradeRef: string;
  counterparty: string;
  isin: string;
  notional: number;
  rate: number;
  valueDate: string;
  maturityDate: string;
  status: "REPORTED" | "MATCHED" | "REJECTED";
}

export interface FtracReport {
  product: "CB-REPO" | "CP" | "CD" | "NCD";
  reportDate: string;
  reportingMember: string;
  tradeRepository: "CCIL F-TRAC";
  records: FtracRecord[];
  reconciliation: { matched: number; unmatched: number; rejected: number };
}

interface FtracQueryResponse {
  records: FtracRecord[];
  reconciliation: FtracReport["reconciliation"];
  reportingMember: string;
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildCcilSample(input: {
  product?: FtracReport["product"];
  reportDate?: string;
}): FtracReport {
  const product = input.product ?? "NCD";
  const reportDate = input.reportDate ?? "2026-06-25";
  const records: FtracRecord[] = [
    {
      tradeRef: "FTRAC-NCD-2026-0099112",
      counterparty: "HDFC Bank (sponsoring member)",
      isin: "INE002A07170",
      notional: 100_000_000,
      rate: 7.12,
      valueDate: "2026-06-26",
      maturityDate: "2028-06-26",
      status: "MATCHED",
    },
    {
      tradeRef: "FTRAC-NCD-2026-0099113",
      counterparty: "ICICI Bank (sponsoring member)",
      isin: "INE234A08AB1",
      notional: 50_000_000,
      rate: 7.25,
      valueDate: "2026-06-26",
      maturityDate: "2029-06-26",
      status: "MATCHED",
    },
  ];
  return {
    product,
    reportDate,
    reportingMember: "Binary Capital (via sponsoring PD)",
    tradeRepository: "CCIL F-TRAC",
    records,
    reconciliation: { matched: records.length, unmatched: 0, rejected: 0 },
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const FTRAC_URL = "https://ftrac.ccil.co.in";

/**
 * Real CCIL F-TRAC reporting-member client. Credential-away: constructed from
 * `CCIL_FTRAC_USER` / `CCIL_FTRAC_PASSWORD` (F-TRAC login). Member workflow;
 * Binary is NOT a direct CCIL member - likely scope-OUT for an arranger.
 */
export class CcilClient {
  private readonly http: HttpClient;

  constructor() {
    const user = requireEnv("CCIL_FTRAC_USER", ADAPTER);
    const pass = requireEnv("CCIL_FTRAC_PASSWORD", ADAPTER);
    this.http = new HttpClient({
      baseUrl: optionalEnv("CCIL_FTRAC_BASE_URL") ?? FTRAC_URL,
      adapter: ADAPTER,
      defaultHeaders: basicAuth(user, pass),
      timeoutMs: 20_000,
      maxRetries: 3,
    });
  }

  async queryReport(product: FtracReport["product"], reportDate: string): Promise<FtracReport> {
    const res = await this.http.request<FtracQueryResponse>({
      method: "GET",
      path: "/reports/ftrac",
      query: { product, reportDate },
    });
    return {
      product,
      reportDate,
      reportingMember: res.reportingMember,
      tradeRepository: "CCIL F-TRAC",
      records: res.records,
      reconciliation: res.reconciliation,
    };
  }

  async fetchReport(input: AdapterInput): Promise<FtracReport> {
    const product = (input.context?.product as FtracReport["product"]) ?? "NCD";
    const reportDate = input.context?.reportDate ?? "2026-06-25";
    return this.queryReport(product, reportDate);
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const ccil: IntegrationAdapter = {
  id: ADAPTER,
  name: "CCIL F-TRAC Reporting (CB Repo / CP / CD / NCD)",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "reporting",
  description:
    "Trade reporting to CCIL F-TRAC (member workflow; scope-uncertain for an arranger).",
  accessRequirements: [
    "Binary must be a CCIL member/reporting entity",
    "ADVERSARIAL CHECK: NOT a direct CCIL member (banks/PDs/FIs with RBI approval)",
    "Likely OUT of scope: rely on member-uploaded data",
  ],
  apiAvailability:
    "MEMBER WORKFLOW, not public API. Reporting members access via F-TRAC login (ftrac.co.in).",
  costRisk: "Build ~2 PM for uploader + reconciliation IF in scope. Likely OUT of scope for an arranger/advisory.",
  phase: "Phase 3",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const product = (input?.context?.product as FtracReport["product"]) ?? "NCD";
    const reportDate = input?.context?.reportDate ?? "2026-06-25";
    const data = buildCcilSample({ product, reportDate });
    const result: AdapterResult<FtracReport> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `F-TRAC ${product} ${reportDate}: ${data.records.length} trades ${data.reconciliation.matched} matched (NOT a direct CCIL member; via sponsoring PD).`,
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
          message: "CCIL_FTRAC_USER / CCIL_FTRAC_PASSWORD not set",
          retryable: false,
        });
      }
      const client = new CcilClient();
      const data = await client.fetchReport(input ?? {});
      const result: AdapterResult<FtracReport> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `F-TRAC ${data.product} ${data.reportDate}: ${data.records.length} trades ${data.reconciliation.matched} matched (live).`,
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
