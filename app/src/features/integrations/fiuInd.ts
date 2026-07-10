// FIU-IND FINnet 2.0 adapter (STR/CTR XML generation + filing).
//
// §11: CONFIRMED. Filing via FINGate 2.0 portal (https://fingate.gov.in) in
// batch XML format (NOT CSV). FIU-IND provides Excel templates + Report
// Generation/Validation Utilities that produce XML. CTR threshold INR 10
// lakh (Rule 3 PML Rules 2005); STR within 7 working days.
//
// Access to swap for real: Binary's reporting-entity registration with
// FIU-IND; Principal Officer + Designated Director designation. Vendor
// generates the XML payload; Binary's Principal Officer files via FINGate.
// (Build effort ~2-3 PM for STR/CTR case generation + XML export.)
//
// The XML below is a FINnet-2.0-styled *representative* payload (well-formed
// and self-validating as XML). The live FINnet schema/XSD is versioned and
// must be obtained from the FINGate 2.0 portal; element names below follow
// the public FINnet 2.0 style and should be re-verified against the XSD
// before production filing.
//
// Env: FIU_IND_FINGATE_USER, FIU_IND_FINGATE_PASSWORD (FINGate 2.0
// reporting-entity login; NOT in .env.example - document as a new key the
// deploy track should add). When mock mode is off AND the creds are present,
// `status` flips to "ready" and `run` uses `FiuIndClient` (XML generation is
// identical in mock + real; the real client additionally submits the batch to
// FINGate 2.0).

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

const ADAPTER: AdapterId = "fiuInd";

/* ── Typed request/response ─────────────────────────────────────────────── */

export interface FiuIndData {
  reportType: "STR" | "CTR";
  reportId: string;
  generatedAt: string;
  reportingEntity: string;
  xmlByteLength: number;
}

export interface FiuIndGenerateRequest {
  reportType: "STR" | "CTR";
  customerName?: string;
  pan?: string;
  amount?: string;
}

export interface FiuIndSubmitRequest extends FiuIndGenerateRequest {
  /** Generated FINnet XML payload. */
  xml: string;
}

interface FiuIndSubmitResponse {
  acknowledgementId: string;
  submittedAt: string;
}

/* ── XML builder (shared by mock + real) ────────────────────────────────── */

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildStrXml(input: Record<string, string | undefined>): string {
  const reportId = `STR-BCA-2026-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-0001`;
  const generatedAt = new Date().toISOString();
  const customerName = input.customerName ?? "ROHIT MEHTA";
  const customerPan = (input.pan ?? "ABCDE1234F").toUpperCase();
  const txnAmount = input.amount ?? "1450000";

  return `<?xml version="1.0" encoding="UTF-8"?>
<FINnet:Report xmlns:FINnet="http://finnet.gov.in/schema/2.0" version="2.0">
  <FINnet:ReportId>${escapeXml(reportId)}</FINnet:ReportId>
  <FINnet:ReportType>STR</FINnet:ReportType>
  <FINnet:GeneratedAt>${generatedAt}</FINnet:GeneratedAt>
  <FINnet:ReportingEntity>
    <FINnet:EntityId>IN303019BCA000001</FINnet:EntityId>
    <FINnet:EntityName>BINARY CAPITAL ADVISORS LLP</FINnet:EntityName>
    <FINnet:EntityType>SEBI Intermediary</FINnet:EntityType>
    <FINnet:PrincipalOfficer>
      <FINnet:Name>DESIGNATED PRINCIPAL OFFICER</FINnet:Name>
      <FINnet:Designation>Principal Officer</FINnet:Designation>
      <FINnet:Contact>+91-22-00000000</FINnet:Contact>
    </FINnet:PrincipalOfficer>
  </FINnet:ReportingEntity>
  <FINnet:Case>
    <FINnet:CaseId>BCA-STR-CASE-2026-0001</FINnet:CaseId>
    <FINnet:DateOfReporting>${generatedAt.slice(0, 10)}</FINnet:DateOfReporting>
    <FINnet:ReasonForSuspicion>
      Structuring of bond subscription funds across multiple instruments below
      reporting thresholds; inconsistent KYC documentation relative to declared
      source of income.
    </FINnet:ReasonForSuspicion>
    <FINnet:Person>
      <FINnet:PersonId>
        <FINnet:IdType>PAN</FINnet:IdType>
        <FINnet:IdNumber>${escapeXml(customerPan)}</FINnet:IdNumber>
      </FINnet:PersonId>
      <FINnet:Name>${escapeXml(customerName)}</FINnet:Name>
      <FINnet:Role>Customer</FINnet:Role>
    </FINnet:Person>
    <FINnet:Transaction>
      <FINnet:TransactionId>BCA-TXN-2026-0099112</FINnet:TransactionId>
      <FINnet:Date>2026-06-22</FINnet:Date>
      <FINnet:Amount currency="INR">${txnAmount}</FINnet:Amount>
      <FINnet:TransactionType>Bond Subscription</FINnet:TransactionType>
    </FINnet:Transaction>
    <FINnet:SuspiciousActivity>
      <FINnet:ActivityCategory>Layering</FINnet:ActivityCategory>
      <FINnet:ActivityDescription>
        Multiple subscription instructions aggregated to avoid CTR threshold;
        funds routed through unrelated intermediary accounts.
      </FINnet:ActivityDescription>
    </FINnet:SuspiciousActivity>
  </FINnet:Case>
</FINnet:Report>`;
}

export function buildCtrXml(input: Record<string, string | undefined>): string {
  const reportId = `CTR-BCA-2026-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-0001`;
  const generatedAt = new Date().toISOString();
  const customerName = input.customerName ?? "ROHIT MEHTA";
  const customerPan = (input.pan ?? "ABCDE1234F").toUpperCase();
  const txnAmount = input.amount ?? "1050000";

  return `<?xml version="1.0" encoding="UTF-8"?>
<FINnet:Report xmlns:FINnet="http://finnet.gov.in/schema/2.0" version="2.0">
  <FINnet:ReportId>${escapeXml(reportId)}</FINnet:ReportId>
  <FINnet:ReportType>CTR</FINnet:ReportType>
  <FINnet:GeneratedAt>${generatedAt}</FINnet:GeneratedAt>
  <FINnet:ReportingEntity>
    <FINnet:EntityId>IN303019BCA000001</FINnet:EntityId>
    <FINnet:EntityName>BINARY CAPITAL ADVISORS LLP</FINnet:EntityName>
    <FINnet:EntityType>SEBI Intermediary</FINnet:EntityType>
  </FINnet:ReportingEntity>
  <FINnet:Case>
    <FINnet:CaseId>BCA-CTR-CASE-2026-0001</FINnet:CaseId>
    <FINnet:DateOfReporting>${generatedAt.slice(0, 10)}</FINnet:DateOfReporting>
    <FINnet:ThresholdExceeded currency="INR">1000000</FINnet:ThresholdExceeded>
    <FINnet:Person>
      <FINnet:PersonId>
        <FINnet:IdType>PAN</FINnet:IdType>
        <FINnet:IdNumber>${escapeXml(customerPan)}</FINnet:IdNumber>
      </FINnet:PersonId>
      <FINnet:Name>${escapeXml(customerName)}</FINnet:Name>
      <FINnet:Role>Customer</FINnet:Role>
    </FINnet:Person>
    <FINnet:Transaction>
      <FINnet:TransactionId>BCA-TXN-2026-0099113</FINnet:TransactionId>
      <FINnet:Date>2026-06-23</FINnet:Date>
      <FINnet:Amount currency="INR">${txnAmount}</FINnet:Amount>
      <FINnet:TransactionType>Cash / Cash-Equivalent Transaction</FINnet:TransactionType>
    </FINnet:Transaction>
  </FINnet:Case>
</FINnet:Report>`;
}

/** Generate the FINnet XML for a report (shared by mock + real). */
export function generateFiuIndXml(req: FiuIndGenerateRequest): { xml: string; reportId: string } {
  const ctx: Record<string, string | undefined> = {
    customerName: req.customerName,
    pan: req.pan,
    amount: req.amount,
  };
  const xml = req.reportType === "CTR" ? buildCtrXml(ctx) : buildStrXml(ctx);
  const reportId =
    xml.match(/<FINnet:ReportId>([^<]+)<\/FINnet:ReportId>/)?.[1] ?? "";
  return { xml, reportId };
}

/* ── Real client ────────────────────────────────────────────────────────── */

const FINGATE_URL = "https://fingate.gov.in";

/**
 * Real FINGate 2.0 client. Credential-away: constructed from
 * `FIU_IND_FINGATE_USER` / `FIU_IND_FINGATE_PASSWORD` (reporting-entity
 * login). XML generation is identical in mock + real; the real client
 * additionally submits the batch XML to FINGate 2.0 and returns an
 * acknowledgement id.
 */
export class FiuIndClient {
  private readonly http: HttpClient;

  constructor() {
    const user = requireEnv("FIU_IND_FINGATE_USER", ADAPTER);
    const pass = requireEnv("FIU_IND_FINGATE_PASSWORD", ADAPTER);
    this.http = new HttpClient({
      baseUrl: optionalEnv("FIU_IND_FINGATE_BASE_URL") ?? FINGATE_URL,
      adapter: ADAPTER,
      defaultHeaders: basicAuth(user, pass),
      timeoutMs: 30_000,
      maxRetries: 2,
    });
  }

  /** Submit a generated FINnet XML batch to FINGate 2.0. */
  async submitReport(req: FiuIndSubmitRequest): Promise<FiuIndSubmitResponse> {
    return this.http.request<FiuIndSubmitResponse>({
      method: "POST",
      path: "/fingate/v2/batch/submit",
      body: { reportType: req.reportType, xml: req.xml },
      headers: { "Content-Type": "application/xml" },
    });
  }

  /** High-level: generate XML + submit. Returns the data + raw XML. */
  async generateAndSubmit(input: AdapterInput): Promise<{
    data: FiuIndData & { acknowledgementId?: string };
    raw: string;
  }> {
    const reportType = (input.context?.reportType as FiuIndGenerateRequest["reportType"]) ?? "STR";
    const { xml, reportId } = generateFiuIndXml({
      reportType,
      customerName: input.context?.customerName,
      pan: input.context?.pan,
      amount: input.context?.amount,
    });
    const ack = await this.submitReport({ reportType, xml, ...input.context });
    return {
      data: {
        reportType,
        reportId,
        generatedAt: new Date().toISOString(),
        reportingEntity: "BINARY CAPITAL ADVISORS LLP",
        xmlByteLength: Buffer.byteLength(xml, "utf8"),
        acknowledgementId: ack.acknowledgementId,
      },
      raw: xml,
    };
  }
}

/* ── Adapter ────────────────────────────────────────────────────────────── */

export const fiuInd: IntegrationAdapter = {
  id: ADAPTER,
  name: "FIU-IND FINnet 2.0 (STR/CTR XML)",
  get status() {
    return resolveAdapterStatus(ADAPTER);
  },
  category: "reporting",
  description:
    "Generate FINnet 2.0-style STR/CTR XML payloads for the Principal Officer to file via FINGate 2.0.",
  accessRequirements: [
    "Binary's reporting-entity registration with FIU-IND",
    "Principal Officer + Designated Director designation",
    "Vendor generates XML; Principal Officer files via FINGate 2.0",
  ],
  apiAvailability:
    "CONFIRMED. Filing via FINGate 2.0 portal in batch XML format (NOT CSV). FIU-IND provides Excel templates + Report Gen/Validation Utilities.",
  costRisk:
    "Build ~2-3 PM for STR/CTR case generation + XML export. CTR threshold INR 10 lakh (Rule 3 PML Rules 2005). LOW technical risk; compliance workflow is the constraint.",
  phase: "Phase 2",
  requiredEnvKeys: ADAPTER_CREDENTIALS[ADAPTER].keys,
  credentialsPresent: () => credentialsPresent(ADAPTER),
  async runMock(input) {
    const reportType = (input?.context?.reportType as FiuIndGenerateRequest["reportType"]) ?? "STR";
    const ctx = input?.context ?? {};
    const { xml, reportId } = generateFiuIndXml({
      reportType,
      customerName: ctx.customerName,
      pan: ctx.pan,
      amount: ctx.amount,
    });
    const data: FiuIndData = {
      reportType,
      reportId,
      generatedAt: new Date().toISOString(),
      reportingEntity: "BINARY CAPITAL ADVISORS LLP",
      xmlByteLength: Buffer.byteLength(xml, "utf8"),
    };
    const result: AdapterResult<FiuIndData> = {
      adapter: this.id,
      name: this.name,
      ok: true,
      status: resolveAdapterStatus(ADAPTER),
      fetchedAt: new Date().toISOString(),
      summary: `${reportType} XML generated (${data.xmlByteLength} bytes); Principal Officer files via FINGate 2.0.`,
      data,
      raw: xml,
    };
    return result;
  },
  async runReal(input) {
    try {
      if (!credentialsPresent(ADAPTER)) {
        throw new IntegrationError({
          adapter: ADAPTER,
          code: "not_configured",
          message: "FIU_IND_FINGATE_USER / FIU_IND_FINGATE_PASSWORD not set",
          retryable: false,
        });
      }
      const client = new FiuIndClient();
      const { data, raw } = await client.generateAndSubmit(input ?? {});
      const result: AdapterResult<typeof data> = {
        adapter: this.id,
        name: this.name,
        ok: true,
        status: "ready",
        fetchedAt: new Date().toISOString(),
        summary: `${data.reportType} XML generated (${data.xmlByteLength} bytes) + submitted to FINGate 2.0 (ack ${data.acknowledgementId}).`,
        data,
        raw,
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
