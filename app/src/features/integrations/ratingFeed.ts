// Rating-agency feed adapter (CRISIL / ICRA / CARE Edge / India Ratings /
// Brickwork).
//
// §11: LICENSED COMMERCIAL DATA, not open. Sold via rating agencies'
// subscription products or redistributors (Bloomberg/Refinitiv). Low technical
// risk; cost is the dominant constraint.
//
// Access to swap for real: commercial license agreement with one or more
// agencies (typical for a bond house). Significant annual license cost (TO
// CONFIRM per agency).
//
// Env (see .env.example): RATING_FEED_API_KEY. Agency selected via
// `input.context.agency`. When mock mode is off AND the key is present,
// `status` flips to "ready" and `run` uses `RatingFeedClient`.

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

const ADAPTER: AdapterId = "ratingFeed";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface RatingAction {
  agency: string;
  ratingId: string;
  instrument: string;
  isin: string;
  issuer: string;
  rating: string;
  outlook: "Stable" | "Positive" | "Negative" | "Developing" | "In Evolving";
  ratingAction: "Assigned" | "Reaffirmed" | "Upgraded" | "Downgraded" | "Withdrawn";
  ratingDate: string;
  amountInrCrore: number;
  longTerm: boolean;
  shortTerm: boolean;
}

export interface RatingFeedData {
  agency: string;
  asOn: string;
  actions: RatingAction[];
}

interface RatingFeedResponse {
  actions: RatingAction[];
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildRatingFeedSample(input: {
  agency?: string;
  asOn?: string;
}): RatingFeedData {
  const agency = input.agency ?? "CRISIL";
  const asOn = input.asOn ?? "2026-06-25";
  const actions: RatingAction[] = [
    {
      agency,
      ratingId: "CRS-AA-44219",
      instrument: "Non-Convertible Debentures",
      isin: "INE002A07170",
      issuer: "HDFC Bank Limited",
      rating: "CRISIL AAA / Stable",
      outlook: "Stable",
      ratingAction: "Reaffirmed",
      ratingDate: "2026-06-20",
      amountInrCrore: 5000,
      longTerm: true,
      shortTerm: false,
    },
    {
      agency,
      ratingId: "CRS-A-88102",
      instrument: "Commercial Paper",
      isin: "INE234A08AB1",
      issuer: "Tata Capital Financial Services",
      rating: "CRISIL A1+",
      outlook: "Stable",
      ratingAction: "Reaffirmed",
      ratingDate: "2026-06-18",
      amountInrCrore: 1500,
      longTerm: false,
      shortTerm: true,
    },
    {
      agency,
      ratingId: "CRS-BB-10443",
      instrument: "Non-Convertible Debentures",
      isin: "INE876A07331",
      issuer: "Acme Infra Projects Ltd",
      rating: "CRISIL BB+ / Negative",
      outlook: "Negative",
      ratingAction: "Downgraded",
      ratingDate: "2026-06-22",
      amountInrCrore: 250,
      longTerm: true,
      shortTerm: false,
    },
  ];
  return { agency, asOn, actions };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const RATING_FEED_URL = "https://feeds.crisil.com"; // swap per licensed agency / redistributor

/**
 * Real rating-agency feed client (licensed). Credential-away: constructed
 * from `RATING_FEED_API_KEY`. Swap `RATING_FEED_URL` for the licensed
 * agency/redistributor endpoint (Bloomberg/Refinitiv/agency direct).
 */
export class RatingFeedClient {
  private readonly http: HttpClient;

  constructor() {
    const key = requireEnv("RATING_FEED_API_KEY", ADAPTER);
    this.http = new HttpClient({
      baseUrl: optionalEnv("RATING_FEED_BASE_URL") ?? RATING_FEED_URL,
      adapter: ADAPTER,
      defaultHeaders: bearerAuth(key),
      timeoutMs: 20_000,
      maxRetries: 3,
    });
  }

  async fetchActions(agency: string, asOn: string): Promise<RatingFeedData> {
    const res = await this.http.request<RatingFeedResponse>({
      method: "GET",
      path: "/ratings/actions",
      query: { agency, asOn },
    });
    return { agency, asOn, actions: res.actions };
  }

  async fetchFeed(input: AdapterInput): Promise<RatingFeedData> {
    const agency = input.context?.agency ?? "CRISIL";
    const asOn = input.context?.asOn ?? "2026-06-25";
    return this.fetchActions(agency, asOn);
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const ratingFeed: IntegrationAdapter = {
  id: ADAPTER,
  name: "Rating-Agency Feed (CRISIL/ICRA/CARE/India Ratings/Brickwork)",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "market_data",
  description:
    "Credit-rating action feed from licensed Indian rating agencies for credit analysis + Indian rating-scale mapping.",
  accessRequirements: [
    "Commercial license agreement with one or more agencies",
    "Significant annual license cost (TO CONFIRM per agency)",
    "Low technical risk; cost is the dominant constraint",
  ],
  apiAvailability:
    "LICENSED COMMERCIAL DATA, not open. Via agency subscription products or redistributors (Bloomberg/Refinitiv).",
  costRisk: "Build ~2 PM per feed. SIGNIFICANT annual license cost (TO CONFIRM). Low technical risk.",
  phase: "Phase 2",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const agency = input?.context?.agency ?? "CRISIL";
    const asOn = input?.context?.asOn ?? "2026-06-25";
    const data = buildRatingFeedSample({ agency, asOn });
    const result: AdapterResult<RatingFeedData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `${agency} feed as on ${asOn}: ${data.actions.length} rating actions (incl. 1 downgrade).`,
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
          message: "RATING_FEED_API_KEY not set",
          retryable: false,
        });
      }
      const client = new RatingFeedClient();
      const data = await client.fetchFeed(input ?? {});
      const result: AdapterResult<RatingFeedData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${data.agency} feed as on ${data.asOn}: ${data.actions.length} rating actions (live).`,
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
