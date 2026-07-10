
# Batch 079

## `src/features/integrations/fiuInd.ts`

- **Lines:** 332 | **Bytes:** 13260
- **Kind:** Application module
- **Header intent:** FIU-IND FINnet 2.0 adapter (STR/CTR XML generation + filing).  §11: CONFIRMED. Filing via FINGate 2.0 portal (https://fingate.gov.in) in batch XML format (NOT CSV). FIU-IND provides Excel templates + Report Generation/Validation Utilities that produce XML. CTR threshold INR 10 lakh (Rule 3 PML Rules 2005); STR within 7 working days.  Access to swap for real: Binary's reporting-entity registration with FIU-IND; Principal Officer + Designated Director designation. Vendor generates the XML payload;
- **Exported functions:** escapeXml, buildStrXml, buildCtrXml, generateFiuIndXml
- **Exported const:** fiuInd
- **Exported types:** FiuIndData, FiuIndGenerateRequest, FiuIndSubmitRequest
- **Exported classes:** FiuIndClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** Bond, KYC, bond

## `src/features/integrations/gstinPan.ts`

- **Lines:** 257 | **Bytes:** 8573
- **Kind:** Application module
- **Header intent:** GSTIN + PAN verification adapter.  §11: GSTIN - free public "Search Taxpayer" page (services.gst.gov.in, CAPTCHA-gated); programmatic via GST Suvidita Providers (GSPs) + ASPs on per-API-call fee. PAN - via NSDL/UTIITSL/Protean PAN verification service (regulated, per-call fee) or via CKYC.  Access to swap for real: GSP/ASP license for programmatic GSTIN; NSDL/ Protean PAN verification API credentials.  Env (see .env.example): GSTIN_API_KEY (GSP/ASP), PAN_API_KEY (NSDL/Protean). Mode is selected 
- **Exported functions:** buildGstinPanSample
- **Exported const:** gstinPan
- **Exported types:** GstinVerification, PanVerification, GstinPanData
- **Exported classes:** GstinPanClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types

## `src/features/integrations/kra.ts`

- **Lines:** 205 | **Bytes:** 7100
- **Kind:** Application module
- **Header intent:** SEBI KRA adapter (CVL / CAMS / Kfintech / NDML).  §11: KRAs provide APIs for upload/download/modify of KYC records to SEBI-registered intermediaries. SEBI Circular SEBI/HO/MIRSD/SECFATF/P/CIR/ 2024/79 (6 Jun 2024) governs KRA uploads to CKYCRR. CDSL APIs page confirms CVL KRA APIs.  Access to swap for real: Binary's SEBI registration + KRA onboarding/API credentials. Vendor integrates as processor under Binary's credentials. Vendor should NOT independently become KRA-integrated. eKYC is consumed
- **Exported functions:** buildKraSample
- **Exported const:** kra
- **Exported types:** KraLookupRequest, KraRecord, KraData
- **Exported classes:** KraClient
- **Security signals:** auth, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **TODOs/FIXMEs:** X-XXXX-7821",
- **Domain terms:** KYC, kyc, onboarding

## `src/features/integrations/mca.ts`

- **Lines:** 191 | **Bytes:** 7129
- **Kind:** Application module
- **Header intent:** MCA21 company master + financials adapter.  §11: NO official open API. Access via MCA portal paid downloads (per-company fee) or third-party aggregators (Tofler, Zauba, Perfins). MCA API URLs returned 403 in research. Portal-scraping is legally risky - avoid.  Access to swap for real: licensed third-party aggregator API subscription (per-call or bulk). Vendor integrates against the aggregator's REST API.  Env (see .env.example): MCA_API_KEY (aggregator API key). When mock mode is off AND the key
- **Exported functions:** buildMcaSample
- **Exported const:** mca
- **Exported types:** McaLookupRequest, McaData
- **Exported classes:** McaClient
- **Security signals:** auth, rbac/rls, india-compliance
- **Internal imports (3):** ./env, ./env, ./types
- **Domain terms:** party
