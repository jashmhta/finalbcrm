// BSE / NSE debt-segment trade reporting adapter.
//
// §11: MEMBER-ONLY; NO public open API. Member-access terminals + member-
// portal files (NSE Member/CM Download, Bhavcopy) rather than generic REST.
// Binary's membership UNVERIFIED - likely acts as arranger/advisory, not
// member. If NOT a member (likely), rely on licensed delayed feeds or manual
// entry - scope OUT.
//
// Access to swap for real: Binary must be a SEBI-registered broker/dealer
// with BSE/NSE debt-segment membership. ADVERSARIAL CHECK: membership
// UNVERIFIED. Likely OUT of scope for an arranger/advisory.
//
// Env (see .env.example): BSE_API_KEY, NSE_API_KEY. Exchange is selected via
// `input.context.exchange` ("BSE" | "NSE"). When mock mode is off AND at
// least one exchange key is present, `status` flips to "ready" and `run` uses
// `BseNseClient`.

import {
  ADAPTER_CREDENTIALS,
  IntegrationError,
  HttpClient,
  bearerAuth,
  credentialsPresent,
  isMockMode,
  optionalEnv,
  resolveAdapterStatus,
} from "./env";
import type { AdapterId } from "./env";
import { errorResult, type AdapterInput, type AdapterResult, type IntegrationAdapter } from "./types";

const ADAPTER: AdapterId = "bseNse";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface DebtTrade {
  tradeId: string;
  isin: string;
  securityName: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  yield: number;
  settlementDate: string;
  counterparty: string;
  tradeTime: string;
}

export interface DebtTradeReport {
  exchange: "BSE" | "NSE";
  segment: string;
  reportDate: string;
  memberCode: string;
  trades: DebtTrade[];
  totals: { trades: number; valueInr: number };
}

interface BseNseDownloadResponse {
  trades: DebtTrade[];
  memberCode: string;
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildBseNseSample(input: {
  exchange?: DebtTradeReport["exchange"];
  reportDate?: string;
}): DebtTradeReport {
  const exchange = input.exchange ?? "NSE";
  const reportDate = input.reportDate ?? "2026-06-25";
  const trades: DebtTrade[] = [
    {
      tradeId: "NSE-DEBT-2026-00441192",
      isin: "INE002A07170",
      securityName: "HDFC Bank Ltd 7.45% NCD 2028",
      side: "BUY",
      quantity: 5000,
      price: 101.42,
      yield: 6.98,
      settlementDate: "2026-06-27",
      counterparty: "Edelweiss Securities",
      tradeTime: "2026-06-25T10:42:11+05:30",
    },
    {
      tradeId: "NSE-DEBT-2026-00441207",
      isin: "INE234A08AB1",
      securityName: "Tata Capital 7.30% NCD 2029",
      side: "SELL",
      quantity: 3000,
      price: 100.88,
      yield: 7.18,
      settlementDate: "2026-06-27",
      counterparty: "JM Financial",
      tradeTime: "2026-06-25T11:18:55+05:30",
    },
  ];
  const valueInr = trades.reduce((s, t) => s + (t.quantity * t.price * 1_000_000) / 100, 0);
  return {
    exchange,
    segment: "DEBT",
    reportDate,
    memberCode: "90011 (mock)",
    trades,
    totals: { trades: trades.length, valueInr: Math.round(valueInr) },
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const BSE_MEMBER_URL = "https://member.bseindia.com";
const NSE_MEMBER_URL = "https://www.nseindia.com";

/**
 * Real BSE/NSE debt-segment member-portal client. Credential-away: BSE calls
 * use `BSE_API_KEY`, NSE calls use `NSE_API_KEY`. Member-only; Binary's
 * membership UNVERIFIED - likely scope-OUT for an arranger/advisory.
 */
export class BseNseClient {
  private readonly bseHttp: HttpClient | undefined;
  private readonly nseHttp: HttpClient | undefined;

  constructor() {
    const bseKey = optionalEnv("BSE_API_KEY");
    const nseKey = optionalEnv("NSE_API_KEY");
    if (bseKey) {
      this.bseHttp = new HttpClient({
        baseUrl: optionalEnv("BSE_API_BASE_URL") ?? BSE_MEMBER_URL,
        adapter: ADAPTER,
        defaultHeaders: bearerAuth(bseKey),
        timeoutMs: 20_000,
        maxRetries: 3,
      });
    }
    if (nseKey) {
      this.nseHttp = new HttpClient({
        baseUrl: optionalEnv("NSE_API_BASE_URL") ?? NSE_MEMBER_URL,
        adapter: ADAPTER,
        defaultHeaders: bearerAuth(nseKey),
        timeoutMs: 20_000,
        maxRetries: 3,
      });
    }
  }

  async downloadTrades(exchange: DebtTradeReport["exchange"], reportDate: string): Promise<DebtTradeReport> {
    const http =
      exchange === "BSE" ? this.bseHttp : exchange === "NSE" ? this.nseHttp : undefined;
    if (!http) {
      throw new IntegrationError({
        adapter: ADAPTER,
        code: "not_configured",
        message: `${exchange}_API_KEY not set`,
        retryable: false,
      });
    }
    const res = await http.request<BseNseDownloadResponse>({
      method: "GET",
      path: `/member/debt/download/${exchange.toLowerCase()}`,
      query: { reportDate },
    });
    const valueInr = res.trades.reduce((s, t) => s + (t.quantity * t.price * 1_000_000) / 100, 0);
    return {
      exchange,
      segment: "DEBT",
      reportDate,
      memberCode: res.memberCode,
      trades: res.trades,
      totals: { trades: res.trades.length, valueInr: Math.round(valueInr) },
    };
  }

  async fetchReport(input: AdapterInput): Promise<DebtTradeReport> {
    const exchange = (input.context?.exchange as DebtTradeReport["exchange"]) ?? "NSE";
    const reportDate = input.context?.reportDate ?? "2026-06-25";
    return this.downloadTrades(exchange, reportDate);
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const bseNse: IntegrationAdapter = {
  id: ADAPTER,
  name: "BSE / NSE Debt-Segment Trade Reporting",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "market_data",
  description:
    "Debt-segment trade reporting from BSE/NSE member portal (member-only; scope-uncertain).",
  accessRequirements: [
    "Binary must be a SEBI-registered broker/dealer with BSE/NSE debt-segment membership",
    "Membership UNVERIFIED (likely arranger/advisory, not member)",
    "If not a member: rely on licensed delayed feeds or manual entry (scope OUT)",
  ],
  apiAvailability:
    "MEMBER-ONLY; NO public open API. Member-access terminals + member-portal files (Bhavcopy, CM Download).",
  costRisk:
    "Build ~2-3 PM IF member. If NOT a member (likely), rely on licensed delayed feeds or manual entry: scope OUT.",
  phase: "Phase 3",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const exchange = (input?.context?.exchange as DebtTradeReport["exchange"]) ?? "NSE";
    const reportDate = input?.context?.reportDate ?? "2026-06-25";
    const data = buildBseNseSample({ exchange, reportDate });
    const result: AdapterResult<DebtTradeReport> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `${exchange} debt segment ${reportDate}: ${data.totals.trades} trades, ₹${(data.totals.valueInr / 10_000_000).toFixed(2)} Cr (member-only; membership UNVERIFIED).`,
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
          message: "BSE_API_KEY or NSE_API_KEY not set",
          retryable: false,
        });
      }
      const client = new BseNseClient();
      const data = await client.fetchReport(input ?? {});
      const result: AdapterResult<DebtTradeReport> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${data.exchange} debt segment ${data.reportDate}: ${data.totals.trades} trades, ₹${(data.totals.valueInr / 10_000_000).toFixed(2)} Cr (live).`,
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
