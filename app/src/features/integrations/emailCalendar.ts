// Email / Calendar adapter (Microsoft Graph / Google Workspace).
//
// §11: SELF-SERVE for the customer's tenant via OAuth2. Well-documented APIs
// (Google Workspace Gmail+Calendar API, Microsoft Graph). Binary consents via
// OAuth2 (vendor acts as processor); restricted-scope verification for Gmail
// API. Customer-tenant admin consent. Communication retention/archive needed
// for SEBI/RBI record-keeping.
//
// Access to swap for real: OAuth2 tenant admin consent (Microsoft Graph or
// Google Workspace). Vendor acts as processor. LOW risk.
//
// Env (see .env.example): GRAPH_CLIENT_ID / GRAPH_CLIENT_SECRET (Microsoft),
// GOOGLE_WORKSPACE_CLIENT_ID / GOOGLE_WORKSPACE_CLIENT_SECRET (Google).
// Provider selected via `input.context.provider`. When mock mode is off AND
// at least one provider's creds are present, `status` flips to "ready" and
// `run` uses `EmailCalendarClient`.

import {
  ADAPTER_CREDENTIALS,
  IntegrationError,
  HttpClient,
  credentialsPresent,
  isMockMode,
  optionalEnv,
  resolveAdapterStatus,
} from "./env";
import type { AdapterId } from "./env";
import { errorResult, type AdapterInput, type AdapterResult, type IntegrationAdapter } from "./types";

const ADAPTER: AdapterId = "emailCalendar";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  to: string[];
  receivedAt: string;
  snippet: string;
  dealRef: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees: string[];
  location: string;
  dealRef: string | null;
}

export interface EmailCalendarData {
  provider: "microsoft-graph" | "google-workspace";
  tenant: string;
  emails: EmailMessage[];
  events: CalendarEvent[];
}

interface GraphEmailsResponse { emails: EmailMessage[] }
interface GraphEventsResponse { events: CalendarEvent[] }

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildEmailCalendarSample(provider: EmailCalendarData["provider"]): EmailCalendarData {
  return {
    provider,
    tenant: "binarycapital.in",
    emails: [
      {
        id: "AAMkAGY2MWE3Zj=" + "LWYy",
        subject: "Re: HDFC Bank NCD 2028 - allocation confirmation",
        from: "syndicate@hdfcbank.com",
        to: ["deals@binarycapital.in"],
        receivedAt: "2026-06-25T14:22:11+05:30",
        snippet:
          "Dear Binary team, confirming allocation of 50 cr to your investor roster for the HDFC NCD 2028 issue…",
        dealRef: "DEAL-2026-0018",
      },
      {
        id: "AAMkAGY2MWE3Zj=" + "LWYz",
        subject: "KYC docs: Rohit Mehta (PAN ABCDE1234F)",
        from: "kyc@binarycapital.in",
        to: ["compliance@binarycapital.in"],
        receivedAt: "2026-06-25T09:11:48+05:30",
        snippet: "Uploading CKYC-linked KYC pack for investor onboarding.",
        dealRef: null,
      },
    ],
    events: [
      {
        id: "evt-2026-06-27-001",
        title: "HDFC NCD 2028 investor call",
        start: "2026-06-27T11:00:00+05:30",
        end: "2026-06-27T11:45:00+05:30",
        attendees: ["deals@binarycapital.in", "syndicate@hdfcbank.com"],
        location: "MS Teams",
        dealRef: "DEAL-2026-0018",
      },
    ],
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const GRAPH_BASE_URL = "https://graph.microsoft.com";
const GOOGLE_BASE_URL = "https://www.googleapis.com";

/**
 * Real Email/Calendar client (Microsoft Graph / Google Workspace via OAuth2).
 * Credential-away: `GRAPH_CLIENT_ID` / `GRAPH_CLIENT_SECRET` (Microsoft) or
 * `GOOGLE_WORKSPACE_CLIENT_ID` / `GOOGLE_WORKSPACE_CLIENT_SECRET` (Google).
 * Token acquisition + refresh handled by the in-region worker; this client
 * makes the authenticated list calls. Provider is selected per `input`.
 */
export class EmailCalendarClient {
  private readonly graphHttp: HttpClient | undefined;
  private readonly googleHttp: HttpClient | undefined;

  constructor() {
    const graphId = optionalEnv("GRAPH_CLIENT_ID");
    const graphSecret = optionalEnv("GRAPH_CLIENT_SECRET");
    const googleId = optionalEnv("GOOGLE_WORKSPACE_CLIENT_ID");
    const googleSecret = optionalEnv("GOOGLE_WORKSPACE_CLIENT_SECRET");
    if (graphId && graphSecret) {
      // The token is acquired out-of-band by the in-region OAuth2 worker and
      // surfaced via GRAPH_ACCESS_TOKEN; here we just attach it when present.
      const token = optionalEnv("GRAPH_ACCESS_TOKEN") ?? "";
      this.graphHttp = new HttpClient({
        baseUrl: GRAPH_BASE_URL,
        adapter: ADAPTER,
        defaultHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        timeoutMs: 15_000,
        maxRetries: 3,
      });
    }
    if (googleId && googleSecret) {
      const token = optionalEnv("GOOGLE_WORKSPACE_ACCESS_TOKEN") ?? "";
      this.googleHttp = new HttpClient({
        baseUrl: GOOGLE_BASE_URL,
        adapter: ADAPTER,
        defaultHeaders: token ? { Authorization: `Bearer ${token}` } : {},
        timeoutMs: 15_000,
        maxRetries: 3,
      });
    }
  }

  async syncEmailCalendar(input: AdapterInput): Promise<EmailCalendarData> {
    const provider = (input.context?.provider as EmailCalendarData["provider"]) ?? "microsoft-graph";
    const tenant = input.context?.tenant ?? "binarycapital.in";
    const http = provider === "google-workspace" ? this.googleHttp : this.graphHttp;
    if (!http) {
      throw new IntegrationError({
        adapter: ADAPTER,
        code: "not_configured",
        message: `${provider === "google-workspace" ? "GOOGLE_WORKSPACE" : "GRAPH"}_CLIENT_ID/SECRET not set`,
        retryable: false,
      });
    }
    const path = provider === "google-workspace" ? "/gmail/v1/users/me/messages" : "/v1.0/me/messages";
    const emails = (await http.request<GraphEmailsResponse>({ method: "GET", path })).emails ?? [];
    const evPath = provider === "google-workspace" ? "/calendar/v3/calendars/primary/events" : "/v1.0/me/events";
    const events = (await http.request<GraphEventsResponse>({ method: "GET", path: evPath })).events ?? [];
    return { provider, tenant, emails, events };
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const emailCalendar: IntegrationAdapter = {
  id: ADAPTER,
  name: "Email / Calendar (Microsoft Graph / Google Workspace)",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "communication",
  description:
    "Sync email + calendar for activity logging and SEBI/RBI communication-record retention.",
  accessRequirements: [
    "OAuth2 tenant admin consent (Microsoft Graph or Google Workspace)",
    "Restricted-scope verification for Gmail API",
    "Vendor acts as processor under Binary's tenant",
  ],
  apiAvailability: "SELF-SERVE via OAuth2. Well-documented Microsoft Graph + Google Workspace APIs.",
  costRisk: "Build ~3 PM. LOW risk. Communication retention/archive needed for SEBI/RBI record-keeping.",
  phase: "Phase 1",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const provider =
      (input?.context?.provider as EmailCalendarData["provider"]) ?? "microsoft-graph";
    const data = buildEmailCalendarSample(provider);
    const result: AdapterResult<EmailCalendarData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `${provider} tenant ${data.tenant}: ${data.emails.length} emails, ${data.events.length} events (synced for retention).`,
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
          message: "Microsoft Graph or Google Workspace OAuth2 creds not set",
          retryable: false,
        });
      }
      const client = new EmailCalendarClient();
      const data = await client.syncEmailCalendar(input ?? {});
      const result: AdapterResult<EmailCalendarData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${data.provider} tenant ${data.tenant}: ${data.emails.length} emails, ${data.events.length} events (live).`,
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
