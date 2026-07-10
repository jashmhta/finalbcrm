// CKYC Registry (CERSAI) adapter.
//
// §11: CKYCRR 2.0 launched with REAL-TIME API (CERSAI notification 5 Jun 2026;
// prior CKYCRR 1.0 used batch-file/SFTP). Protean and other vendors offer
// CKYCR API integration.
//
// Access to swap for real: Binary onboarded as Reporting Entity with CERSAI;
// API credentials + onboarding. Exact API spec/endpoint TO CONFIRM directly
// with CERSAI. Real-time API is recent (Jun 2026) - confirm production
// stability and onboarding timeline.
//
// Env (see .env.example): KRA_API_USER, KRA_API_KEY (CERSAI/CKYCRR access is
// provisioned alongside the KRA creds in .env.example). When mock mode is off
// AND creds are present, `status` flips to "ready" and `run` uses
// `CkycClient`.

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

const ADAPTER: AdapterId = "ckyc";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface CkycLookupRequest {
  /** CKYC id OR PAN (the registry resolves either). */
  identifier: string;
  /** "CKYC" | "PAN" - tells CERSAI which key was supplied. */
  idType: "CKYC" | "PAN";
}

export interface CkycRecord {
  ckycIdentifier: string;
  ckycStatus: "NORMAL" | "LOCKED";
  kycStatus: "COMPLETE" | "PARTIAL";
  name: string;
  pan: string;
  maskedAadhaar: string;
  dob: string;
  gender: string;
  nationality: string;
  residenceAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  identityProofType: string;
  addressProofType: string;
  contributingEntity: string;
  lastUpdated: string;
}

export interface CkycData {
  ckycIdentifierQueried: string;
  record: CkycRecord | null;
  imageUrls: { photo: string; signature: string; identityProof: string; addressProof: string };
}

interface CkycFetchResponse {
  record: CkycRecord | null;
  imageUrls?: CkycData["imageUrls"];
}

/* ── Mock ───────────────────────────────────────────────────────────────── */

export function buildCkycSample(identifier?: string): CkycData {
  const ckycId = identifier ?? "CKYC-000123456789";
  const record: CkycRecord = {
    ckycIdentifier: ckycId,
    ckycStatus: "NORMAL",
    kycStatus: "COMPLETE",
    name: "ROHIT MEHTA",
    pan: "ABCDE1234F",
    maskedAadhaar: "XXXX-XXXX-7821",
    dob: "1985-03-12",
    gender: "Male",
    nationality: "Indian",
    residenceAddress: {
      line1: "12, Sea Breeze Apartments",
      line2: "Worli Sea Face",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400018",
      country: "India",
    },
    identityProofType: "PAN",
    addressProofType: "Aadhaar",
    contributingEntity: "CDSL Ventures Limited (CVL)",
    lastUpdated: "2026-06-12T11:04:22+05:30",
  };
  return {
    ckycIdentifierQueried: ckycId,
    record,
    imageUrls: {
      photo: "mock://ckyc/photo/000123456789",
      signature: "mock://ckyc/signature/000123456789",
      identityProof: "mock://ckyc/identity/000123456789",
      addressProof: "mock://ckyc/address/000123456789",
    },
  };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const CKYC_SANDBOX_URL = "https://api.sandbox.cersai.gov.in";
const CKYC_PRODUCTION_URL = "https://api.cersai.gov.in";

/**
 * Real CKYCRR 2.0 client (CERSAI real-time API). Credential-away: constructed
 * from `KRA_API_USER` / `KRA_API_KEY` (CKYCRR access is provisioned alongside
 * the KRA creds in .env.example). Endpoint path TO CONFIRM with CERSAI.
 */
export class CkycClient {
  private readonly http: HttpClient;

  constructor() {
    const user = requireEnv("KRA_API_USER", ADAPTER);
    const key = requireEnv("KRA_API_KEY", ADAPTER);
    const env = optionalEnv("CKYC_ENV") ?? "sandbox";
    const baseUrl = env === "production" ? CKYC_PRODUCTION_URL : CKYC_SANDBOX_URL;
    this.http = new HttpClient({
      baseUrl,
      adapter: ADAPTER,
      defaultHeaders: basicAuth(user, key),
      timeoutMs: 15_000,
      maxRetries: 3,
    });
  }

  async fetchRecord(req: CkycLookupRequest): Promise<CkycFetchResponse> {
    return this.http.request<CkycFetchResponse>({
      method: "GET",
      path: "/ckycrr/v2/record",
      query: { id: req.identifier, idType: req.idType },
    });
  }

  async fetchCkyc(input: AdapterInput): Promise<CkycData> {
    const identifier = input.identifier ?? "CKYC-000123456789";
    const idType: CkycLookupRequest["idType"] = identifier.toUpperCase().startsWith("CKYC")
      ? "CKYC"
      : "PAN";
    const res = await this.fetchRecord({ identifier, idType });
    const record = res.record;
    return {
      ckycIdentifierQueried: identifier,
      record,
      imageUrls: res.imageUrls ?? {
        photo: "",
        signature: "",
        identityProof: "",
        addressProof: "",
      },
    };
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const ckyc: IntegrationAdapter = {
  id: ADAPTER,
  name: "CKYC Registry (CERSAI)",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "kyc",
  description: "Central KYC records fetch from CKYCRR 2.0 (CERSAI) real-time API.",
  accessRequirements: [
    "Binary onboarded as Reporting Entity with CERSAI",
    "CKYCRR 2.0 API credentials + onboarding",
    "Exact API spec/endpoint TO CONFIRM directly with CERSAI",
  ],
  apiAvailability:
    "CONFIRMED. CKYCRR 2.0 real-time API (CERSAI notification 5 Jun 2026); Protean offers CKYCR API.",
  costRisk:
    "Build ~2-3 PM. Real-time API is recent (Jun 2026); confirm production stability and onboarding timeline.",
  phase: "Phase 1",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const data = buildCkycSample(input?.identifier);
    const result: AdapterResult<CkycData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: data.record
        ? `CKYC ${data.record.kycStatus}/${data.record.ckycStatus} for ${data.ckycIdentifierQueried} (contributed by ${data.record.contributingEntity}).`
        : `No CKYC record for ${data.ckycIdentifierQueried}.`,
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
          message: "KRA_API_USER / KRA_API_KEY not set (CKYCRR access)",
          retryable: false,
        });
      }
      const client = new CkycClient();
      const data = await client.fetchCkyc(input ?? {});
      const result: AdapterResult<CkycData> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: data.record
          ? `CKYC ${data.record.kycStatus}/${data.record.ckycStatus} for ${data.ckycIdentifierQueried} (live).`
          : `No CKYC record for ${data.ckycIdentifierQueried} (live).`,
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
