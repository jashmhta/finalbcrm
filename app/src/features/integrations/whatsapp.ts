// WhatsApp Business API adapter.
//
// §11: OPEN via Meta Cloud API or BSPs (solution partners). Self-serve.
// Meta Business account + template approval; BSP if using a solution
// partner. Opt-in/opt-out registry required. Per-24h-conversation pricing by
// category (marketing/utility/authentication), India-specific rates set by
// Meta (TO CONFIRM). Template approval + RBI/SEBI communication-record
// retention rules apply.
//
// Access to swap for real: Meta Business account + template approval; BSP
// optional. Opt-in/opt-out registry. Vendor acts as processor.
//
// Env: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID (Meta Cloud API; NOT in
// .env.example - document as new keys the deploy track should add). When mock
// mode is off AND the creds are present, `status` flips to "ready" and `run`
// uses `WhatsappClient`.

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

const ADAPTER: AdapterId = "whatsapp";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface WhatsappMessage {
  messageId: string;
  direction: "outbound" | "inbound";
  category: "utility" | "marketing" | "authentication";
  templateName: string;
  to: string;
  from: string;
  sentAt: string;
  deliveredAt: string | null;
  status: "sent" | "delivered" | "read" | "failed";
  body: string;
  optIn: boolean;
}

export interface WhatsappData {
  phoneNumberId: string;
  businessAccountId: string;
  messages: WhatsappMessage[];
  optInRegistry: { number: string; optIn: boolean; optInAt: string };
}

export interface WhatsappSendRequest {
  to: string;
  category: "utility" | "marketing" | "authentication";
  templateName: string;
  /** Template language code (e.g. "en_US"). */
  language?: string;
  /** Template component parameters. */
  components?: unknown;
}

interface WhatsappSendResponse {
  messageId: string;
  businessAccountId: string;
  status: WhatsappMessage["status"];
}

interface WhatsappLogResponse {
  messages: WhatsappMessage[];
  optInRegistry: WhatsappData["optInRegistry"];
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildWhatsappSample(to: string): WhatsappData {
  return {
    phoneNumberId: "110245678901",
    businessAccountId: "104210987654321",
    messages: [
      {
        messageId: "wamid.HBgL" + to.slice(1) + "g==",
        direction: "outbound",
        category: "utility",
        templateName: "bond_allocation_confirmation",
        to,
        from: "+912266000000",
        sentAt: "2026-06-25T10:30:00+05:30",
        deliveredAt: "2026-06-25T10:30:08+05:30",
        status: "delivered",
        body:
          "Dear Investor, your allocation of HDFC Bank 7.45% NCD 2028 (ISIN INE002A07170) for 5000 units is confirmed. - Binary Bonds",
        optIn: true,
      },
      {
        messageId: "wamid.HBgL" + to.slice(1) + "h==",
        direction: "inbound",
        category: "utility",
        templateName: "",
        to: "+912266000000",
        from: to,
        sentAt: "2026-06-25T10:31:22+05:30",
        deliveredAt: null,
        status: "read",
        body: "Acknowledged. Please share allotment advice.",
        optIn: true,
      },
    ],
    optInRegistry: {
      number: to,
      optIn: true,
      optInAt: "2026-05-02T12:00:00+05:30",
    },
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const WHATSAPP_API_URL = "https://graph.facebook.com";

/**
 * Real WhatsApp Business Cloud API client. Credential-away: constructed from
 * `WHATSAPP_TOKEN` (Meta Cloud API bearer) + `WHATSAPP_PHONE_NUMBER_ID`.
 * Optional `WHATSAPP_BUSINESS_ACCOUNT_ID` for log lookups.
 */
export class WhatsappClient {
  private readonly http: HttpClient;
  private readonly phoneNumberId: string;
  private readonly businessAccountId: string;

  constructor() {
    const token = requireEnv("WHATSAPP_TOKEN", ADAPTER);
    this.phoneNumberId = requireEnv("WHATSAPP_PHONE_NUMBER_ID", ADAPTER);
    this.businessAccountId = optionalEnv("WHATSAPP_BUSINESS_ACCOUNT_ID") ?? "";
    this.http = new HttpClient({
      baseUrl: optionalEnv("WHATSAPP_API_BASE_URL") ?? WHATSAPP_API_URL,
      adapter: ADAPTER,
      defaultHeaders: bearerAuth(token),
      timeoutMs: 15_000,
      maxRetries: 3,
    });
  }

  /** Send a template message. */
  async sendTemplate(req: WhatsappSendRequest): Promise<WhatsappSendResponse> {
    return this.http.request<WhatsappSendResponse>({
      method: "POST",
      path: `/v21.0/${this.phoneNumberId}/messages`,
      body: {
        messaging_product: "whatsapp",
        to: req.to,
        type: "template",
        template: {
          name: req.templateName,
          language: { code: req.language ?? "en_US" },
          components: req.components ?? [],
        },
      },
    });
  }

  /** Fetch the recent message log for a number (opt-in registry read separately). */
  async fetchLog(to: string): Promise<WhatsappData> {
    const log = await this.http.request<WhatsappLogResponse>({
      method: "GET",
      path: `/v21.0/${this.businessAccountId || this.phoneNumberId}/messages`,
      query: { to },
    });
    return {
      phoneNumberId: this.phoneNumberId,
      businessAccountId: this.businessAccountId,
      messages: log.messages,
      optInRegistry: log.optInRegistry,
    };
  }

  async fetchWhatsapp(input: AdapterInput): Promise<WhatsappData> {
    const to = input.identifier ?? "+919876543210";
    return this.fetchLog(to);
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const whatsapp: IntegrationAdapter = {
  id: ADAPTER,
  name: "WhatsApp Business API",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "communication",
  description:
    "Send/receive WhatsApp Business messages (templates) with opt-in registry for SEBI/RBI retention.",
  accessRequirements: [
    "Meta Business account + template approval (or BSP)",
    "Opt-in/opt-out registry",
    "Per-24h-conversation pricing (TO CONFIRM India rates)",
    "Template approval + RBI/SEBI communication-record retention",
  ],
  apiAvailability: "OPEN via Meta Cloud API or BSPs (solution partners). Self-serve.",
  costRisk: "Build ~2-3 PM. Per-24h-conversation pricing by category. Template approval + retention rules.",
  phase: "Phase 1",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const to = input?.identifier ?? "+919876543210";
    const data = buildWhatsappSample(to);
    const result: AdapterResult<WhatsappData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `WhatsApp ${to}: ${data.messages.length} messages (opt-in ${data.optInRegistry.optIn}).`,
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
          message: "WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set",
          retryable: false,
        });
      }
      const client = new WhatsappClient();
      const data = await client.fetchWhatsapp(input ?? {});
      const result: AdapterResult<WhatsappData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `WhatsApp ${input?.identifier ?? "+919876543210"}: ${data.messages.length} messages (live).`,
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
