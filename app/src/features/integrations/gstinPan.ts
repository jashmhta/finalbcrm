// GSTIN + PAN verification adapter.
//
// §11: GSTIN - free public "Search Taxpayer" page (services.gst.gov.in,
// CAPTCHA-gated); programmatic via GST Suvidita Providers (GSPs) + ASPs on
// per-API-call fee. PAN - via NSDL/UTIITSL/Protean PAN verification service
// (regulated, per-call fee) or via CKYC.
//
// Access to swap for real: GSP/ASP license for programmatic GSTIN; NSDL/
// Protean PAN verification API credentials.
//
// Env (see .env.example): GSTIN_API_KEY (GSP/ASP), PAN_API_KEY (NSDL/Protean).
// Mode is selected via `input.context.mode` ("GSTIN" | "PAN"). When mock mode
// is off AND at least one of the two keys is present, `status` flips to
// "ready" and `run` uses `GstinPanClient` (which dispatches to the relevant
// upstream per mode).

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

const ADAPTER: AdapterId = "gstinPan";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface GstinVerification {
  gstin: string;
  legalName: string;
  tradeName: string;
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  registrationType: string;
  registrationDate: string;
  constitution: string;
  taxableType: string;
  stateJurisdiction: string;
  centreJurisdiction: string;
  lastUpdated: string;
  panLinked: string;
}

export interface PanVerification {
  pan: string;
  nameOnPan: string;
  nameMatch: "MATCH" | "PARTIAL" | "MISMATCH";
  status: "VALID" | "INVALID";
  aadhaarLinked: boolean;
  lastVerified: string;
}

export interface GstinPanData {
  mode: "GSTIN" | "PAN";
  gstin?: GstinVerification;
  pan?: PanVerification;
}

type GstinApiResponse = GstinVerification;
type PanApiResponse = PanVerification;

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildGstinPanSample(input: {
  identifier?: string;
  mode?: GstinPanData["mode"];
}): GstinPanData {
  const mode = input.mode ?? "GSTIN";
  if (mode === "PAN") {
    const pan = (input.identifier ?? "ABCDE1234F").toUpperCase();
    const panResult: PanVerification = {
      pan,
      nameOnPan: "ROHIT MEHTA",
      nameMatch: "MATCH",
      status: "VALID",
      aadhaarLinked: true,
      lastVerified: new Date().toISOString(),
    };
    return { mode, pan: panResult };
  }
  const gstin = (input.identifier ?? "27AAACR5058K1Z5").toUpperCase();
  const gstinResult: GstinVerification = {
    gstin,
    legalName: "BINARY CAPITAL ADVISORS LLP",
    tradeName: "Binary Bonds",
    status: "ACTIVE",
    registrationType: "Regular",
    registrationDate: "2018-07-01",
    constitution: "Limited Liability Partnership",
    taxableType: "Regular",
    stateJurisdiction: "Maharashtra - Ward 0504",
    centreJurisdiction: "Mumbai - Range 412",
    lastUpdated: "2026-06-18T09:00:00+05:30",
    panLinked: "AAACR5058K",
  };
  return { mode, gstin: gstinResult };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const GSTIN_GSP_URL = "https://api.gstnsp.com"; // GSP/ASP gateway (swap per vendor)
const PAN_VERIFICATION_URL = "https://api.onlineservices.nsdl.com"; // NSDL/Protean PAN verify

/**
 * Real GSTIN/PAN verification client. Credential-away: GSTIN calls use
 * `GSTIN_API_KEY` (GSP/ASP); PAN calls use `PAN_API_KEY` (NSDL/Protean). The
 * client picks the upstream per `mode`.
 */
export class GstinPanClient {
  private readonly gstinHttp: HttpClient | undefined;
  private readonly panHttp: HttpClient | undefined;

  constructor() {
    const gstinKey = optionalEnv("GSTIN_API_KEY");
    const panKey = optionalEnv("PAN_API_KEY");
    if (gstinKey) {
      this.gstinHttp = new HttpClient({
        baseUrl: optionalEnv("GSTIN_API_BASE_URL") ?? GSTIN_GSP_URL,
        adapter: ADAPTER,
        defaultHeaders: bearerAuth(gstinKey),
        timeoutMs: 15_000,
        maxRetries: 3,
      });
    }
    if (panKey) {
      this.panHttp = new HttpClient({
        baseUrl: optionalEnv("PAN_API_BASE_URL") ?? PAN_VERIFICATION_URL,
        adapter: ADAPTER,
        defaultHeaders: bearerAuth(panKey),
        timeoutMs: 15_000,
        maxRetries: 3,
      });
    }
  }

  async verifyGstin(gstin: string): Promise<GstinVerification> {
    if (!this.gstinHttp) {
      throw new IntegrationError({
        adapter: ADAPTER,
        code: "not_configured",
        message: "GSTIN_API_KEY not set",
        retryable: false,
      });
    }
    return this.gstinHttp.request<GstinApiResponse>({
      method: "GET",
      path: "/taxpayer/search",
      query: { gstin },
    });
  }

  async verifyPan(pan: string): Promise<PanVerification> {
    if (!this.panHttp) {
      throw new IntegrationError({
        adapter: ADAPTER,
        code: "not_configured",
        message: "PAN_API_KEY not set",
        retryable: false,
      });
    }
    return this.panHttp.request<PanApiResponse>({
      method: "POST",
      path: "/pan/verify",
      body: { pan },
    });
  }

  async fetchGstinPan(input: AdapterInput): Promise<GstinPanData> {
    const mode = (input.context?.mode as GstinPanData["mode"]) ?? "GSTIN";
    if (mode === "PAN") {
      const pan = (input.identifier ?? "ABCDE1234F").toUpperCase();
      return { mode, pan: await this.verifyPan(pan) };
    }
    const gstin = (input.identifier ?? "27AAACR5058K1Z5").toUpperCase();
    return { mode, gstin: await this.verifyGstin(gstin) };
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const gstinPan: IntegrationAdapter = {
  id: ADAPTER,
  name: "GSTIN / PAN Verification",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "registry",
  description: "GSTIN verification (GSP/ASP) + PAN verification (NSDL/Protean).",
  accessRequirements: [
    "GSP/ASP license for programmatic GSTIN",
    "NSDL/UTIITSL/Protean PAN verification API credentials",
    "Per-call fees for both",
  ],
  apiAvailability:
    "GSTIN: free public page (CAPTCHA-gated) or GSP/ASP API. PAN: NSDL/Protean regulated per-call service or via CKYC.",
  costRisk: "Build ~1-2 PM. Per-call fees. Low risk.",
  phase: "Phase 1",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const mode = (input?.context?.mode as GstinPanData["mode"]) ?? "GSTIN";
    const data = buildGstinPanSample({ identifier: input?.identifier, mode });
    const label =
      mode === "PAN"
        ? `PAN ${data.pan?.pan} ${data.pan?.status}`
        : `GSTIN ${data.gstin?.gstin} ${data.gstin?.status}`;
    const result: AdapterResult<GstinPanData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: label,
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
          message: "GSTIN_API_KEY or PAN_API_KEY not set",
          retryable: false,
        });
      }
      const client = new GstinPanClient();
      const data = await client.fetchGstinPan(input ?? {});
      const label =
        data.mode === "PAN"
          ? `PAN ${data.pan?.pan} ${data.pan?.status}`
          : `GSTIN ${data.gstin?.gstin} ${data.gstin?.status}`;
      const result: AdapterResult<GstinPanData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${label} (live)`,
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
