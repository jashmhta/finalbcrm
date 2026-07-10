// SEBI KRA adapter (CVL / CAMS / Kfintech / NDML).
//
// §11: KRAs provide APIs for upload/download/modify of KYC records to
// SEBI-registered intermediaries. SEBI Circular SEBI/HO/MIRSD/SECFATF/P/CIR/
// 2024/79 (6 Jun 2024) governs KRA uploads to CKYCRR. CDSL APIs page confirms
// CVL KRA APIs.
//
// Access to swap for real: Binary's SEBI registration + KRA onboarding/API
// credentials. Vendor integrates as processor under Binary's credentials.
// Vendor should NOT independently become KRA-integrated. eKYC is consumed
// THROUGH the KRA (which is the AUA/KUA) - call the KRA's eKYC API, not
// UIDAI directly.
//
// Env (see .env.example): KRA_API_USER, KRA_API_KEY. When mock mode is off
// AND the KRA creds are present, `status` flips to "ready" and `run` uses
// `KraClient`.

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

const ADAPTER: AdapterId = "kra";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface KraLookupRequest {
  pan: string;
  operation: "upload" | "download" | "modify";
}

export interface KraRecord {
  kraName: string;
  kraCode: string;
  kycReference: string;
  ckycIdentifier: string;
  pan: string;
  maskedAadhaar: string;
  kycStatus: "VALIDATED" | "CVL/KUA-VERIFIED" | "PENDING";
  kycType: "ONLINE" | "PHYSICAL";
  lastModified: string;
  nameOnKyc: string;
  uccFields: {
    ucc: string;
    sebiRegistrationCategory: string;
  };
}

export interface KraData {
  operation: "upload" | "download" | "modify";
  kra: KraRecord;
  duplicatesFound: number;
}

interface KraLookupResponse {
  kra: KraRecord;
  duplicatesFound: number;
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildKraSample(input: {
  identifier?: string;
  operation?: KraData["operation"];
}): KraData {
  const pan = (input.identifier ?? "ABCDE1234F").toUpperCase();
  const op = input.operation ?? "download";
  const record: KraRecord = {
    kraName: "CDSL Ventures Limited (CVL)",
    kraCode: "CVL",
    kycReference: "KRA-CVL-2026-5523011",
    ckycIdentifier: "CKYC-000123456789",
    pan,
    maskedAadhaar: "XXXX-XXXX-7821",
    kycStatus: "CVL/KUA-VERIFIED",
    kycType: "ONLINE",
    lastModified: "2026-06-12T11:04:22+05:30",
    nameOnKyc: "ROHIT MEHTA",
    uccFields: {
      ucc: "IN303019ABCDE1234F",
      sebiRegistrationCategory: "Merchant Banker",
    },
  };
  return { operation: op, kra: record, duplicatesFound: 0 };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const KRA_SANDBOX_URL = "https://kra.sandbox.cvlkra.com";
const KRA_PRODUCTION_URL = "https://kra.cvlkra.com";

/**
 * Real KRA client (CVL/CAMS/Kfintech/NDML KYC upload/download/modify API).
 * Credential-away: constructed from `KRA_API_USER` / `KRA_API_KEY`.
 */
export class KraClient {
  private readonly http: HttpClient;

  constructor() {
    const user = requireEnv("KRA_API_USER", ADAPTER);
    const key = requireEnv("KRA_API_KEY", ADAPTER);
    const env = optionalEnv("KRA_ENV") ?? "sandbox";
    const baseUrl = env === "production" ? KRA_PRODUCTION_URL : KRA_SANDBOX_URL;
    this.http = new HttpClient({
      baseUrl,
      adapter: ADAPTER,
      defaultHeaders: basicAuth(user, key),
      timeoutMs: 15_000,
      maxRetries: 3,
    });
  }

  async lookup(req: KraLookupRequest): Promise<KraLookupResponse> {
    return this.http.request<KraLookupResponse>({
      method: "POST",
      path: `/api/v1/kyc/${req.operation}`,
      body: { pan: req.pan },
    });
  }

  async fetchKra(input: AdapterInput): Promise<KraData> {
    const operation = (input.context?.operation as KraData["operation"]) ?? "download";
    const pan = (input.identifier ?? "ABCDE1234F").toUpperCase();
    const res = await this.lookup({ pan, operation });
    return { operation, kra: res.kra, duplicatesFound: res.duplicatesFound };
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const kra: IntegrationAdapter = {
  id: ADAPTER,
  name: "SEBI KRA (CVL/CAMS/Kfintech/NDML)",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "kyc",
  description:
    "KYC upload/download/modify to empaneled KRAs and CKYCRR 2.0 via the KRA.",
  accessRequirements: [
    "Binary's SEBI registration (COR) verified on SI Portal",
    "KRA onboarding + API credentials (CVL/CAMS/Kfintech/NDML)",
    "Per-call KRA charges (TO CONFIRM)",
    "Vendor integrates as processor under Binary's credentials",
  ],
  apiAvailability:
    "CONFIRMED. KRA APIs for upload/download/modify; eKYC consumed THROUGH the KRA (AUA/KUA).",
  costRisk: "Build ~2-3 PM for KYC submission/fetch + UCC fields. Dependency on KRA for eKYC.",
  phase: "Phase 1",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const op = (input?.context?.operation as KraData["operation"]) ?? "download";
    const data = buildKraSample({ identifier: input?.identifier, operation: op });
    const result: AdapterResult<KraData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `${op} ${data.kra.kycStatus} for PAN ${data.kra.pan} via ${data.kra.kraName} (CKYC ${data.kra.ckycIdentifier}).`,
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
          message: "KRA_API_USER / KRA_API_KEY not set",
          retryable: false,
        });
      }
      const client = new KraClient();
      const data = await client.fetchKra(input ?? {});
      const result: AdapterResult<KraData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${data.operation} ${data.kra.kycStatus} for PAN ${data.kra.pan} via ${data.kra.kraName} (live).`,
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
