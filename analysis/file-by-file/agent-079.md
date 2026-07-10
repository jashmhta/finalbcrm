# Agent 079 — File-by-file analysis (batch-079)

Files: fiuInd.ts, gstinPan.ts, kra.ts, mca.ts | Fully read

---

## src/features/integrations/fiuInd.ts

- **Lines:** 333  
- **Role:** FIU-IND FINnet 2.0 STR/CTR **XML generation + optional FINGate submit**. Phase 2 reporting. Highest compliance sensitivity in the integration set.

- **Exports:**
  - Types: `FiuIndData`, `FiuIndGenerateRequest`, `FiuIndSubmitRequest`
  - `escapeXml`, `buildStrXml`, `buildCtrXml`, `generateFiuIndXml`
  - `FiuIndClient` (`submitReport`, `generateAndSubmit`)
  - `fiuInd` adapter

- **Business purpose:**
  - PML Rules 2005: CTR threshold ₹10 lakh; STR within 7 working days.
  - Filing via FINGate 2.0 batch XML (not CSV). Principal Officer + Designated Director required.
  - Mock generates XML only; real path generates + POSTs to `/fingate/v2/batch/submit`.

- **Key logic:**
  - Representative FINnet 2.0 XML (namespace `http://finnet.gov.in/schema/2.0`) — **must re-verify against live XSD**.
  - STR includes ReasonForSuspicion, Layering activity category, bond subscription txn.
  - CTR includes ThresholdExceeded 1000000 INR.
  - `escapeXml` for & < > " '.
  - AdapterResult may include `raw: xml` for download/display.

- **Security / RBAC:**
  - Submitting STR/CTR is a **regulatory act** — currently gated only by auth in actions.ts (no Principal Officer role check).
  - Live submit with basicAuth portal creds is high risk if credentials land in non-prod.
  - Env keys FIU_IND_FINGATE_* not in .env.example.
  - XML contains sample PAN/customer; production must bind real case data.

- **Risks:** Schema drift vs official XSD; dual Content-Type application/xml vs JSON body; auto-submit may violate “PO files via portal” operating model.

---

## src/features/integrations/gstinPan.ts

- **Lines:** 258  
- **Role:** GSTIN (GSP/ASP) + PAN (NSDL/Protean) verification. Phase 1 registry. Dual-mode via `context.mode`.

- **Exports:** `GstinVerification`, `PanVerification`, `GstinPanData`, `buildGstinPanSample`, `GstinPanClient`, `gstinPan`.

- **Key logic:**
  - Mock PAN: VALID/MATCH/aadhaarLinked; mock GSTIN Binary Capital ACTIVE with panLinked.
  - Real: independent HttpClients if respective keys present; GSTIN GET `/taxpayer/search`; PAN POST `/pan/verify`.
  - credentialsPresent: **any** of GSTIN_API_KEY or PAN_API_KEY.

- **Security:** Regulated per-call services; PII (name match, aadhaar linked flag). Free public GST page CAPTCHA-gated — programmatic path needs GSP license.

- **Risks:** Placeholder base URLs; name-match results must not be sole KYC proof.

---

## src/features/integrations/kra.ts

- **Lines:** 206  
- **Role:** SEBI KRA adapter (CVL/CAMS/Kfintech/NDML) — KYC upload/download/modify. Phase 1. eKYC **through** KRA as AUA/KUA (not UIDAI direct).

- **Exports:** `KraLookupRequest`, `KraRecord`, `KraData`, `buildKraSample`, `KraClient`, `kra`.

- **Key logic:**
  - Mock: CVL verified record with CKYC id, UCC, Merchant Banker SEBI category.
  - Real: basicAuth; KRA_ENV sandbox|production → cvlkra.com; POST `/api/v1/kyc/{operation}` body `{pan}`.
  - context.operation: upload|download|modify (default download).

- **Business purpose:** SEBI Circular SEBI/HO/MIRSD/SECFATF/P/CIR/2024/79 (6 Jun 2024) KRA→CKYCRR uploads. Vendor integrates as processor under Binary’s COR credentials.

- **Security:** SEBI intermediary registration required; per-call KRA charges; vendor must not become independently KRA-integrated.

- **Risks:** Multi-KRA routing not implemented (CVL hardcoded); upload/modify side effects on live KYC registries.

---

## src/features/integrations/mca.ts

- **Lines:** 192  
- **Role:** MCA21 company master + financials **via licensed aggregator** (Tofler/Zauba/Perfins). Phase 2 registry. No official open MCA API (403 in research).

- **Exports:** `McaLookupRequest`, `McaData`, `buildMcaSample`, `McaClient`, `mca`.

- **Key logic:**
  - Mock: Binary Capital Advisors LLP sample CIN, directors (DIN), 2 FY financials, one OPEN charge.
  - Real: bearer MCA_API_KEY; GET `/company/master`; lookupType CIN if identifier matches `/^[LUCOP]/` else NAME.
  - Explicit warning: **avoid portal scraping** (legal risk).

- **Security:** Aggregator license; director/charge data is public registry-ish but licensed commercially.

- **Risks:** Aggregator response schemas differ; CIN regex is rough (U/L/C/O/P only).

---

## Batch 079 synthesis

KYC/registry/reporting core: KRA+GSTIN/PAN (phase 1), MCA aggregator (phase 2), FIU-IND XML (phase 2, highest compliance risk). Shared mock/real adapter pattern continues. FIU live submit without Principal Officer RBAC is the standout risk.
