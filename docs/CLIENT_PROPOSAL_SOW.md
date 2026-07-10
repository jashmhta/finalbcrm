# Proposal & Statement of Work — CRM Platform for Binary Capital / Binary Bonds

**Prepared for:** Binary Capital Advisors LLP ("Binary Capital") and its bond-markets practice line, "Binary Bonds — A Division of Binary Capital."
**Prepared by:** [VENDOR LEGAL NAME] ("Vendor", "we", "us").
**Date:** June 2026.
**Document status:** Draft for client review. Pricing and vendor-credential sections marked with placeholders to be confirmed before signature. This Proposal + SOW is conditional on resolution of the gating items set out in Section 10.

---

## 1. Executive Summary

You run an unusual business. Binary Capital is simultaneously a Mumbai investment-banking and financial-advisory boutique *and* a bond house — originating and advising on M&A, project finance, structured finance, and capital-markets transactions on one side, while underwriting, placing, trading, making markets in, and managing portfolios of bonds on the other. That two-sided model — issuers on one side, institutional and retail investors on the other, with credit analysis and financial modeling at the core — is exactly what no off-the-shelf CRM is built for. Salesforce, Dynamics 365, DealCloud, and Navatar each cover slices of what you do, but none of them carry bond pricing, Indian credit-rating mapping, PMLA KYC tiers, DPDP consent management, or BSE/NSE/CCIL/KRA/Account Aggregator integrations. We verified this directly.

**What we will build.** A single, India-hosted CRM that runs the full two-sided relationship business of Binary Capital and Binary Bonds on a hybrid architecture: a commodity CRM backbone (party master, relationship graph, deal pipeline, activities, documents, dashboards, RBAC, audit) plus a custom India-resident layer for bond pricing, Indian rating-scale mapping, credit analysis, financial modeling, PMLA KYC/AML, DPDP consent, and the regulatory integrations that a SEBI/RBI/FIMMDA-regulated firm requires. The custom layer is the part that makes this product yours and not a generic install — and it is the part no Western IB-CRM vendor provides.

**The headline outcome.** One auditable, decision-grade system of truth that replaces your spreadsheet towers and personal-email memory, cuts credit-memo turnaround, gives the syndicate desk a queryable investor book, gives compliance a one-click regulator retrieval path, and gives the founders a real-time view of pipeline, coverage, credit, and compliance health across all practice lines — all hosted in India, on MeitY-empaneled cloud, with DPDP-aligned consent and immutable audit from day one.

**Conditional-go framing.** Our compliance and feasibility analysis recommends a **conditional go**. The build is feasible, commercially defensible, and the regulatory stack is well-defined enough to build against. However, the precise scope of the SEBI compliance layer, certain market-infrastructure integrations, and a small number of regulatory-rule effective dates depend on facts only you can confirm — principally your actual SEBI registration category and Certificate of Registration (COR), your BSE/NSE/CCIL/DP/FIMMDA memberships, and the final notification status of the DPDP Rules 2025. Section 10 sets these out as client-action gating items. Resolving them in a focused 2–4 week Phase 0 discovery is the fastest, lowest-risk path to a fixed scope and fixed price.

---

## 2. Our Understanding of Your Business

We have done our homework. The summary below is what we understand you to be; please correct anything that is off so the final scope reflects your reality, not our reading.

**The entity.** The operating legal entity is **Binary Capital Advisors LLP**, headquartered at 2045, 2nd Floor, Spaces Adani Height, Andheri West, Mumbai 400053. Binary Bonds is a specialised division (the parent's site calls it a "subsidiary," the division's own footer calls it a "Division"; no separate registration number is disclosed and we read it as a branded practice line of the LLP). The firm has been serving Indian businesses since 2014. The LLP is the contracting entity for this engagement.

**The two-sided model.** You are a two-sided intermediary. On the **issuer** side you originate and advise corporates raising debt — structuring, rating advisory, underwriting, placement, post-issue support. On the **investor** side you maintain a curated book of banks, insurers, mutual funds, pension funds, AIFs, family offices, HNIs, NBFCs, and IFAs to whom paper is placed and for whom you manage portfolios and provide secondary-market liquidity. A single corporate can be an issuer in one mandate and an investor in another's paper. That duality is the single most distinctive thing about your data model and the thing generic CRMs handle worst.

**The relationship book.** You have touched **10,000+ relationships** over the past decade (per the client kickoff), of which **150+ institutional investors**, **100+ clients**, and **70+ organisations** are the active/repeat core. This is not a contradiction — it is total book versus active book — but the CRM must be designed for the total, with dedup, enrichment, and KYC-status tagging as a first-class migration workstream.

**The service lines.** Your umbrella covers:

*Binary Bonds (the bond house):*
- **Corporate bond underwriting** — IG and high yield; structuring, rating coordination, placement, SEBI filing/exchange listing, post-issue support. Stated ₹2,000+ Cr underwritten, 100% placement record.
- **Government securities** — RBI auction participation (GoI dated securities 5–40 yr, SDLs, T-Bills 91/182/364 day, Sovereign Gold Bonds) and secondary trading; settlement via CCIL DVP and RBI NDS-OM.
- **High-yield bonds** — sub-IG paper with a 200–500 bps premium; 8-step credit methodology (fundamental, relative value, diversification, active monitoring, PD/recovery/LGD, liquidity, concentration, stress testing).
- **Bond portfolio management** — top-down macro allocation, duration management, yield enhancement, credit-quality management, performance reporting, rebalancing.
- **Credit rating advisory** — CRISIL, ICRA, CARE, India Ratings (and Acuite/Infomerics per your brochure); 100+ issuer assignments; 10–50x ROI claim via reduced borrowing costs.
- **Secondary-market trading / market-making** — two-way quotes across the G-Sec curve, SDLs, SGBs, IG/HY corporates; CCIL DVP settlement; BSE/NSE execution with ICCL as counterparty (T+0/T+1).

*Binary Capital (investment banking & advisory):*
- **Finance Advisory** — structured finance / securitisation, supply-chain financing.
- **Project Advisory / Project Financing** — non-recourse/limited-recourse SPV financing for infrastructure, renewables, industrial, real estate; ₹500+ Cr arranged, 50+ projects, 15+ yr average tenure.
- **Capital Markets Advisory** — ECM (IPOs, FPOs, QIPs, rights, preferential) and DCM (corporate bonds, NCDs, CP, green bonds); ₹2,000+ Cr raised, 75+ transactions.
- **M&A Advisory** — buy-side, sell-side, valuations, post-merger integration.
- **Structured Bonds** — convertible, callable, puttable, green, embedded-option structures.

**The people.** **Shray Vasudeva** — Founder & Managing Partner (Binary Capital) / Founder & Director (Binary Bonds); leads strategic vision, client relationships, and the bond/syndicate desk. **Shahrukh Sheikh** — Managing Partner; IB/coverage sponsor across the full transaction lifecycle. **Rati Ravi Kant** — Director, Credit Analysis & Risk (Binary Bonds); CFA charterholder, MBA Finance; 20+ years in credit rating advisory and risk. Beyond these three, the brochure implies a small team (~6 subject-matter experts + 2 directors) — a boutique where institutional knowledge is concentrated in a very few people, which is itself a reason to build a CRM that externalises that knowledge into a system rather than leaving it in founders' heads.

**The regulatory frame.** You claim compliance with **SEBI**, **RBI**, and **FIMMDA**. Your website describes the firm as "SEBI registered, RBI compliant" and references "Merchant Banker Coordination." Critically — and we say this as a partner, not a critic — **no SEBI Certificate of Registration number or category (Merchant Banker / Stock Broker / Investment Adviser / Portfolio Manager / Debenture Trustee) is published anywhere on your public-facing materials**, and "investment banker" is not itself a recognised SEBI registration category. We treat verifying your actual registration status as the single most important gating item (Section 10) because the entire SEBI compliance layer of the CRM — retention periods, cyber-resilience tier, PIT applicability, KRA access — turns on it. We assume for the rest of this document that you are a SEBI-registered intermediary (the most likely basis for your claims) and will re-scope if that proves incorrect.

---

## 3. The Problem & Why a Specialized CRM

You already know the day-to-day pain. The structural point is *why* the obvious alternatives do not solve it.

**Generic Salesforce / Dynamics 365** model a one-sided, linear sales funnel — Lead → Opportunity → Close. Your business is two-sided and match-making: an issuer mandate only succeeds if it is matched to a curated investor book, and an investor relationship only pays if it is repeatedly matched to deal flow. Adapting a generic CRM for that requires expensive customisation that creates technical debt and still does not yield bond pricing, Indian rating mapping, or PMLA/DPDP compliance.

**Intapp DealCloud** is a credible IB/PE deal and relationship CRM — for the M&A/advisory slice. We verified that it has **no bond-desk functionality** (no fixed-income, no bond underwriting, no G-Sec auctions, no secondary-market making), **no credit analysis or financial modeling**, no India data-residency commitment, and no SEBI/RBI/FIMMDA capabilities. It is a shortlist candidate for the M&A slice only, not a default for a bond house. The "leading IB CRM" framing is vendor self-positioning, not an independent analyst designation.

**Navatar** is often pitched as "built for Indian capital markets." It is not. It is a US-headquartered (Wall Street, NYC) global private-markets CRM built on Salesforce, with Indian-origin founders and a Noida delivery office. It has no India-specific capital-markets, SEBI/RBI/FIMMDA, or bond-market functionality. Its only genuine India advantage is that Salesforce-native deployment can inherit Hyperforce India residency. It would require the same custom bond/credit build as any other CRM.

**What is missing from every off-the-shelf option:**

| Gap | Why it matters for you |
|---|---|
| No **bond pricing** (FIMMDA YTM, clean/dirty, modified duration, convexity, G-spread/OAS with Indian day-count/settlement conventions) | Every desk user needs this daily; it belongs inside the CRM, not in a side spreadsheet |
| No **Indian rating-scale mapping** (CRISIL / ICRA / CARE / India Ratings / Acuite / Infomerics / Brickwork on the AAA→D long-term and A1+→D short-term scales) | Your credit rating advisory practice depends on it |
| No **PMLA KYC tiers** (CDD/EDD, beneficial-ownership traversal, PEP/sanctions screening, STR/CTR to FIU-IND via FINnet 2.0 XML, 5-year retention per Section 12 of the PML Act) | You are a reporting entity under PMLA s.12 |
| No **DPDP consent management** (granular, purpose-limited, withdrawable consent; data-subject rights; breach notification) | DPDP Act 2023 + IT Act SPDI Rules apply to your investors'/issuers' financial data |
| No **BSE/NSE, CCIL, KRA, CKYC, Account Aggregator, FIU-IND** integrations | These are the Indian market-infrastructure rails your business runs on |
| No **issuer↔investor matching** engine (rating band × tenor × sector × ticket × demat-ready × KYC-current) | The syndicate desk's core question — "who will buy this paper" — is unanswerable in a generic CRM |
| No **deal/mandate object** with your product-specific lifecycles (Mandate → Structuring → Rating → Underwriting → Placement → Settlement → Post-issue) | Your published 4/5/6/8-step processes are first-class workflows, not "opportunity stages" |
| No **PIT / Chinese-wall** enforcement between advisory/corporate-finance and trading | A material SEBI insider-trading requirement given you do both advisory and secondary trading |
| No **FIMMDA CBRRP / F-TRAC 15-minute trade reporting** | Confirmed regulatory requirement; a late or failed submission is a breach |

A specialized CRM is not a luxury here. It is the only architecture that fits your business and your regulator.

---

## 4. Proposed Solution

We propose a **hybrid CRM**: a commodity CRM backbone for the 70–80% that is generic to any relationship business, plus a custom India-resident layer for the 20–30% that is specific to an Indian bond house + IB and that no off-the-shelf vendor provides. The custom layer is your differentiator and the part we will own and productize.

### Core modules

1. **Unified party master + two-sided relationship graph.** A single Party model (People, Organisations, Funds, SPVs, Intermediaries) where a Party can simultaneously be an issuer, an investor, and an intermediary. Typed relationship edges (parent-of, UBO-of, related-party, coverage-owner, mandated-by, invested-in, issued-by). Corporate group / SPV / UBO hierarchies. Firm-wide contact graph across your 10,000+ book. **This is the single most distinctive requirement and the foundation everything else sits on.**
2. **Deal / mandate pipeline (multi-product).** Stage-gated pipelines for bond underwriting/issuance, G-Sec/RBI auction participation, M&A, project finance (SPV/non-recourse), structured finance/securitisation, supply-chain finance, ECM/DCM, rating advisory, and portfolio mandates — origination → mandate → execution → closing, with deal type, instrument, underwriting exposure, bidder/investor lists, cross-product linking for the same issuer.
3. **Credit-analysis workbench.** Financial-statement spreading of Indian-format audited financials (Schedule III, NBFS, consolidated/standalone); ratio analysis (leverage, coverage/DSCR, liquidity, profitability, turnover); configurable internal scorecard; agency-rating mapping to all 7 Indian CRAs with rating-action history; per-issuer and per-group exposure & limit management mirroring RBI ceilings; watchlist / early-warning; credit-committee workflow (memo, scoring, voting, conditions/covenants). Integrates Moody's Credit Lens / S&P Capital IQ / LSEG data where licensed.
4. **Financial modeling — bond pricing in-app + Excel round-trip.** Embedded FIMMDA-compliant bond-pricing calculators (YTM, clean/dirty, modified/effective duration, convexity, spread) with Indian day-count/settlement conventions configurable — the one piece of modeling that genuinely belongs inside the CRM because every desk user needs it daily. For heavier models (project-finance SPV, securitisation waterfall, DCF, M&A/LBO), governed Excel templates linked to the deal record with key outputs surfaced as CRM fields, and bi-directional Excel round-tripping of inputs/outputs (a Cube-style pattern). Versioned model-template library with author/approver/change log.
5. **KYC / CDD / AML.** CDD fields, identity/address/income proof vault, beneficial-ownership capture (PML Rules 2005 Rule 9(3) thresholds: company >10%, partnership >15%, trust 15%, with senior-managing-official fallback), risk categorisation (low/medium/high), periodic re-KYC scheduler (RBI: Low=10yr / Medium=8yr / High=2yr), PEP and sanctions/UN 1267-1373 screening with daily delta re-screening, STR/CTR workflow with FINnet 2.0 XML export via your Principal Officer, 5-year post-closure retention per PMLA s.12. KRA + CKYC 2.0 + Aadhaar eKYC (via KRA as AUA/KUA, not UIDAI direct) + DigiLocker integration.
6. **DPDP consent + data-subject rights.** Granular, purpose-limited, withdrawable consent capture with a full consent ledger; one-click withdrawal; Data Principal rights portal (access/summary, correction/erasure, nomination, grievance with SLA tracking); breach detection and notification workflow layered with CERT-In 6-hour and SEBI/RBI timelines; cross-border transfer controls (DPDP s.16 negative-list); SDF-readiness (DPIA, independent data audit, India-based DPO) architected now for the May 2027 commencement.
7. **Compliance & audit.** PIT/Chinese-wall information barriers (segregate advisory/corporate-finance from trading; designated-person register, trading-window closures, pre-clearance workflow); SCORES 2.0 complaint integration (21-day SLA + ATR); SEBI multi-category compliance profiles (Merchant Banker / Stock Broker / Investment Adviser / Portfolio Manager / Debenture Trustee) on the same client record; regulatory reporting pack; **immutable append-only audit trail** on every party/deal/rating/relationship/consent record (tamper-evident, exportable for SEBI/RBI/FIMMDA inspection); 180-day in-India log retention per CERT-In Directions.
8. **Dashboards & reporting.** Founder/management dashboards (pipeline, revenue forecast, coverage productivity, credit throughput, compliance health, top-at-risk); banker/attribution splits; league-table-style internal tracking; saved views per persona; regulator-facing exports.

### Module → service-line mapping (P0 / P1 / P2)

| Module | Binary Capital / Binary Bonds service line it serves | Priority |
|---|---|---|
| Party Master + Two-Sided Relationship Graph | All — coverage, syndicate, credit, compliance | **P0** |
| Ethical Walls / Chinese Walls + RBAC/ABAC | PIT compliance across advisory + trading; all service lines | **P0** |
| Immutable Audit Trail & Version History | SEBI/RBI/FIMMDA inspection readiness; all service lines | **P0** |
| KYC / CDD / AML (SEBI + PMLA) | All — gates every transaction; investor onboarding; issuer onboarding | **P0** |
| DPDP Consent + Data-Subject Rights | All — investors, issuers, HNIs, NRIs, IFAs | **P0** |
| India Data Residency Deployment | All — regulatory foundation | **P0** |
| Deal / Mandate Pipeline (multi-product) | Underwriting, G-Sec auctions, M&A, project finance, structured finance, SCF, ECM/DCM, rating advisory | **P0** |
| Credit-Rating Agency Tracking & Advisory Workflow | Credit rating advisory (CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics) | **P0** |
| FIMMDA Trade Reporting (CBRRP / F-TRAC, 15-min) | Secondary trading / market-making; corporate bond repos | **P0** (gated on membership — see §6, §10) |
| Document Management + e-Sign (eMudhra/NSDL eSign) | All — DRHP/RHP, PPM, ISIN applications, debenture trust deeds, term sheets, rating letters, KYC packs | **P0** |
| Credit Analysis Workbench | Credit rating advisory; high-yield underwriting; portfolio management credit selection | **P1** |
| Embedded FIMMDA Bond-Pricing Calculators | Secondary trading; G-Sec auctions; underwriting pricing; portfolio management | **P1** |
| Excel Model Round-Trip + Versioned Template Library | Project finance (DSCR/SPV); securitisation waterfalls; M&A/LBO/DCF; debt sizing | **P1** |
| IOI / Order Book + Allocation (custom-built) | Corporate bond underwriting; syndicate desk | **P1** |
| Secondary Trading / Market-Making Integration (read-only) | Secondary trading desk | **P1** (gated on membership) |
| Relationship Intelligence + Zero-Entry Activity Capture | Coverage RMs; all relationship-led work | **P1** |
| Generative-AI Copilot (with trust/security layer) | All — memo summarisation, email drafting, meeting prep; no PII/MNPI leakage to public LLMs | **P1** |
| ESG / Green-Bond Tracking | Green bonds; SEBI green debt securities framework; BRSR Core | **P1** |
| SEBI Multi-Category Compliance Profiles | Merchant Banker / Broker / IA / PM / DT record-keeping and periodic reports | **P1** |
| Regulatory Reporting Pack | SEBI / FIMMDA / PMLA STR / DPDP breach / CERT-In 6-hour | **P1** |
| LP / Fundraising + Investor Portal | Any fund/portfolio-management vehicles; retail "Buy Bonds" channel | **P2** |
| Predictive Analytics + Next-Best-Action | Coverage productivity; churn risk; next-best-instrument | **P2** |
| Mobile CRM with Offline Sync | Coverage RMs on roadshows; traders on the go | **P2** |
| Account Aggregator Integration | Credit analysis (consented bank-statement/cash-flow pull) | **P2** (recommended Phase-1 priority — see §6) |
| Portfolio Management & P&L Dashboards | Bond portfolio management; trading/market-making P&L | **P2** |
| Securitization Waterfall Engine (Excel-linked) | Structured finance / securitisation | **P2** |

---

## 5. Compliance & Regulatory Approach

Compliance is not a feature we bolt on at the end; it is the architecture. The CRM is designed so that *you stay compliant* — the system enforces the obligations, logs the evidence, and produces regulator-ready exports on demand. The binding regimes are SEBI, RBI (largely indirectly via your bank/NBFC counterparties), FIMMDA, PMLA, DPDP, the IT Act / SPDI Rules, and CERT-In.

**SEBI Cloud Framework.** All RE data stored and processed exclusively within India — primary, DR, and near-DR all in-country. MeitY-empaneled + STQC-audited cloud (or on-prem). BYOK/BYOE with keys in dedicated fault-tolerant HSM under your control. Encryption at rest, in transit, and in use. Mandatory exit/expunging clauses. You retain complete ownership of data, logs, and encryption keys; the cloud provider acts only in a fiduciary capacity.

**PMLA KYC / CDD / BO / PEP / Sanctions / STR-CTR.** You are a "reporting entity" under PMLA s.12. The CRM implements: CDD with identity & address proof; EDD for high-risk clients; beneficial-ownership traversal per PML Rules 2005 Rule 9(3) — **company >10%, partnership >15%, trust 15%**, with a role-based senior-managing-official fallback where no natural person meets threshold (there is no 25% figure); risk categorisation (low/medium/high); periodic re-KYC (RBI: Low=10yr / Medium=8yr / High=2yr; SEBI KRA-based regime modelled alongside); **5-year retention per PMLA s.12** — 5 years from transaction date, and 5 years after the relationship ended or account closed, whichever is later; PEP screening (domestic/foreign/associate) with senior-management approval and source-of-funds/wealth capture; UN 1267/1373 + RBI/UAPA sanctions screening with daily delta re-screening and false-positive disposition; STR workflow (within 7 working days of suspicion) and CTR workflow (auto-aggregation per PAN per month with ≥₹10 lakh flag per Rule 3 PML Rules 2005); FINnet 2.0 / FINGate 2.0 XML export via your Principal Officer. Note: retention is anchored to PMLA s.12, not PML Rules Rule 7 (which is a common misattribution).

**DPDP Act 2023 + IT Act SPDI Rules 2011.** You are the Data Fiduciary; we are the Data Processor. The CRM implements granular, purpose-limited, withdrawable consent with a full consent ledger; Data Principal rights (access/summary, correction/erasure, grievance, nomination); breach detection and notification workflow to the Data Protection Board and affected principals (exact clock per final notified Rules — we use "without undue delay / 24–48h" vendor-notice SLA in the DPA pending final Rules); cross-border transfer controls (DPDP s.16 negative-list model — DPDP does **not** mandate blanket localization, but SEBI Cloud Framework and RBI sectoral rules do require India residency); SDF-readiness (DPIA, independent data audit, India-based DPO) architected now for the May 2027 commencement. IT Act s.43A and SPDI Rules 2011 remain in force alongside DPDP — your bond/IB data is squarely "financial information" SPDI, and the CRM satisfies the stricter of the two regimes. IT Act ss.72/72A criminal exposure for confidentiality breach backs our personnel obligations in the DPA.

**PIT Regulations 2015 / Chinese walls.** Designated-person register, pre-clearance of trades, trading-window closures around UPSI events, trade monitoring, and information-barrier logic segregating advisory/corporate-finance (UPSI-exposed) teams from trading teams. This is a material SEBI insider-trading requirement given you do both advisory and secondary trading, not a nice-to-have. Chinese walls are a recognised defence to insider-trading presumptions.

**CERT-In Directions (28 Apr 2022).** 6-hour cyber-incident reporting; 180-day ICT log retention within Indian jurisdiction; system clocks synced to NICT/NPL. These apply **directly to us as the vendor/hosting layer** regardless of your RE status.

**Immutable audit.** Append-only, tamper-evident, time-stamped audit trail of every read/write/export of KYC, client financials, advice, trades, deal documents, consent, and screening decisions — user identity, timestamp, purpose — survives SEBI/CERT-In inspection and forensic audit.

### Compliance checklist (consolidated, by theme)

The full checklist runs to 42 controls. The summary below groups them by theme so you can see the shape of the compliance surface; the full control list is in our compliance feasibility report and will be mapped test-by-test in the Phase 0 compliance matrix.

| Theme | Controls (summary) |
|---|---|
| **Data residency & cloud** | India-only storage (primary + DR + backups + logs); MeitY-empaneled + STQC-audited cloud; BYOK/HSM with rotation + split-knowledge; encryption at rest/in transit/in use; exit/expunging engine with certified deletion; data portability (CSV/JSON); 6-month remediation path if CSP loses empanelment |
| **Audit & access** | Immutable append-only audit log; 180-day in-India log retention (CERT-In); RBAC + need-to-know + Chinese-wall/information-barrier logic; field-level encryption; periodic access reviews; MFA; just-in-time access for vendor/support; designated-person register + pre-clearance + trading-window closures (PIT Regs) |
| **KYC / AML** | CDD fields + identity/address proof vault; PAN + masked Aadhaar + CKYC Identifier + KRA reference; KRA + CKYCRR 2.0 real-time API; Aadhaar eKYC via KRA (not UIDAI direct); V-CIP with liveness/live-geo; DigiLocker; BO traversal (company >10%, partnership >15%, trust 15%, SMO fallback); PEP + EDD workflow; sanctions/UN 1267-1373 + RBI/UAPA screening with daily delta; risk-rating engine (Low/Med/High); periodic KYC refresh (RBI 10/8/2); STR + CTR workflow with FINnet 2.0 XML export; 5-year retention per PMLA s.12 |
| **DPDP / SPDI consent & rights** | Consent management engine (free/specific/informed/withdrawable, granular per purpose, one-click withdrawal, full ledger); Data Principal rights portal (access, correction/erasure, nomination, grievance with SLA); children's/disability gate; storage-limitation/retention engine; RoPA; breach detection + notification workflow (DPDP + CERT-In 6-hr + SEBI/RBI layered); SDF toolkit (DPIA, independent data audit, India DPO); cross-border transfer controls; SPDI special-handling class (passwords, bank account, financial info, biometrics, medical) |
| **Sectoral record-keeping** | Record-retention policy engine with per-record-type minimums (SEBI Stock Brokers ≥5 yrs; Debenture Trustee ≥5 financial yrs; IA Reg 19(2) ≥5 yrs; PM Reg 29 ≥5 yrs; Merchant Banker Reg 13/14 due-diligence and agreement records); legal-hold override; never auto-purge inside retention window; SCORES 2.0 complaint integration (21-day SLA + ATR) |
| **Credit, rating & pricing** | Credit-analysis module with versioning + model governance + audit trail; bond pricing engine (YTM, duration, spread, clean/dirty, accrued) for G-Sec/SDL/corporate/CP/CD; Indian credit-rating mapping & tracking (all 7 CRAs, outlook/watch, rating-action timeline) |
| **Counterparty & sub-processor** | Sub-processor register + flow-down; vendor/sub-processor management with MeitY empanelment + STQC audit evidence; back-to-back enforceable agreements; no joint/shared ownership of any compliance task; CSP cooperation clause for SEBI/CERT-In audit and search-and-seizure; counterparty vendor-risk flow-down (bank/NBFC → you → vendor) |
| **Resilience & incident** | Backup/DR with India-resident DR + near-DR; tested BCP/DR with documented RTO/RPO; periodic DR drills; CSCRF-aligned security controls (board-approved cyber governance, SOC/24×7 monitoring, IAM, VAPT by CERT-In-empaneled auditors); CERT-In 6-hour incident reporting workflow; SOC 2 / ISO 27001 / ISO 22301 certification evidence on demand |
| **Communications** | Email/calendar (Google Workspace / Microsoft Graph) + WhatsApp Business API integration with OAuth2 customer-tenant consent, communication retention/archive for SEBI/RBI record-keeping, opt-in/opt-out registry |

**India-only hosting.** Primary, DR, and backups on **AWS Mumbai (ap-south-1) / Hyderabad (ap-south-2), or Azure India Central (Pune) / West India (Mumbai), or GCP asia-south1 (Mumbai) / asia-south2 (Delhi)** — all three hyperscalers operate India regions suitable for DPDP/SEBI residency. Mumbai location favours AWS ap-south-1 / Azure Central India for low-latency staff access. BYOK/HSM with keys in India. If we use Vercel for the application layer, we pin compute to the Mumbai (bom1) region and run the database on AWS RDS / Azure SQL in India — not Vercel-managed Postgres, which has limited India-residency guarantees.

---

## 6. Integrations

Integration feasibility is **mixed**: the open-architecture / self-serve feeds are buildable in Phase 1; the license-gated / member-only feeds depend on your memberships and licences and are gated on your confirmations. We sequence Phase 1 around the open feeds and start your licence onboarding in parallel with the build.

| Integration | Phase 1 feasible? | Access requirement | Notes |
|---|---|---|---|
| **Account Aggregator (RBI / Sahamati)** — consented bank-statement / cash-flow pull for credit analysis | **Yes** | You onboard as Financial Information User (FIU) via Sahamati; ~17 operational AAs, ~179 FIPs, ~955 FIUs. Weeks lead time. | Highest-value, most feasible credit-analysis feed. Recommended Phase-1 priority. ~4–6 person-months build. |
| **SEBI KRA (CVL / CAMS / Kfintech / NDML)** — KYC upload/download/modify | **Yes** | Your SEBI registration + KRA API onboarding. We integrate as processor under your credentials. | ~2–3 PM. Per-call KRA charges may apply. |
| **CKYC Registry (CERSAI) — CKYCRR 2.0 real-time API** | **Yes** | You onboard as Reporting Entity with CERSAI; API credentials. | CKYCRR 2.0 real-time API launched per CERSAI notification 5 Jun 2026. ~2–3 PM. |
| **Aadhaar eKYC / DigiLocker** | **Yes** | eKYC consumed *through the KRA* (which is the AUA/KUA), not UIDAI directly. DigiLocker partner/requester setup. | We will not become AUA/KUA. ~1–2 PM each. Low risk. |
| **GSTIN / PAN verification** | **Yes** | GST Suvidha Provider for programmatic GSTIN; NSDL/Protean for PAN verification. | Per-call fees. ~1–2 PM. Low risk. |
| **MCA21 company master + financials** | **Yes (via aggregator)** | No official open API; licensed third-party aggregator (Tofler/Zauba/Perfins). | Portal-scraping is legally risky — we use a licensed aggregator. ~2–3 PM. |
| **Email / Calendar (Google Workspace / Microsoft Graph)** | **Yes** | OAuth2 customer-tenant admin consent; restricted-scope verification for Gmail. | ~3 PM. Low risk. Communication retention/archive for record-keeping. |
| **WhatsApp Business API** | **Yes** | Meta Business account + template approval; BSP optional. | ~2–3 PM. Per-conversation pricing by category. RBI/SEBI communication-record retention applies. |
| **FIU-IND FINnet 2.0 / FINGate 2.0 (STR/CTR filing)** | **Yes** | Your reporting-entity registration with FIU-IND; Principal Officer + Designated Director designation. | We generate the XML payload; your Principal Officer files via FINGate. ~2–3 PM. CTR threshold ₹10 lakh (Rule 3 PML Rules 2005). |
| **BSE / NSE debt-segment trade reporting** | **Gated — on your membership** | Member-only; no public API. Requires you to be a SEBI-registered broker/dealer with BSE/NSE debt-segment membership. | Adversarial check found **no evidence** you are a member; you likely act as arranger/advisory. If not a member, we rely on licensed delayed feeds or manual entry — scoped out. **Confirm membership (Section 10).** |
| **CCIL F-TRAC trade reporting** | **Gated — on your membership** | CCIL member/reporting entity. Membership is for banks/PDs/FIs with RBI approval. | Adversarial check: you are **not a direct CCIL member**; any CCIL-settled trades you arrange clear through a sponsoring bank/PD. Likely out of scope; rely on member-uploaded data. **Confirm (Section 10).** |
| **CDSL / NSDL depository (demat)** | **Gated — on your DP registration** | DP-system access only for SEBI-registered Depository Participants. | Adversarial check: your DP registration **unverified**; likely not a DP. If not, we store demat details as reference data only — scoped out. **Confirm (Section 10).** |
| **Rating-agency feeds (CRISIL / ICRA / CARE / India Ratings / Acuite / Infomerics)** | **Gated — on your licences** | Licensed commercial data; sold via agency subscription products or redistributors (Bloomberg / Refinitiv). | Significant annual licence cost. Indian CRA public REST APIs are not guaranteed — many integrations are via licensed redistributors or scheduled feeds. **Confirm licences per agency.** ~2 PM per feed. |
| **Bloomberg / Refinitiv (LSEG) market data** | **Gated — on your existing licence** | Enterprise-licensed; BLPAPI (Bloomberg) / Workspace/Eikon APIs (Refinitiv) under paid Terminal/Data License. | A bond house usually already has this. Cost is the dominant constraint, not build. **Confirm your existing licence.** ~2–3 PM to consume. |
| **Credit bureaus (CIBIL / Experian / Equifax / CRIF High Mark)** | **Gated — on your eligibility** | Individual access requires CICRA membership as a "Credit Institution" (banks/NBFCs/lenders). | You are an IB/advisory, **not a registered lender** — individual bureau access is likely **not available**; company/commercial reports may be. If ineligible, we redesign credit analysis around AA + rating agencies + MCA financials (recommended regardless). **Confirm eligibility (Section 10).** |

---

## 7. Technical Approach

We keep this brief and non-technical; the full architecture is in our technical feasibility report.

**Stack.** A modern web application on **Next.js + PostgreSQL + Drizzle ORM**, with Auth.js for identity, shadcn/ui for the interface, and an India-region managed Postgres (AWS RDS / Azure SQL) for the database. An async job queue handles AA / KRA / CKYC / MCA API calls with retry and rate-limit handling. An object store (S3 / ABS) holds documents and financial models. The existing repository already scaffolds this (42 tables, 67 enums) — we are not starting from a blank page.

**Information barriers.** Role-based access control (RBAC) augmented by attribute-based access control (ABAC) — roles × attributes like deal team, segment, and issuer-investor conflict boundary — enforced at the database layer via PostgreSQL Row-Level Security. Default-deny: a row with no policy is invisible. This is how the Chinese wall between advisory/corporate-finance and trading is enforced technically, not just by policy.

**Immutable audit.** Append-only event log via Postgres triggers capturing who / what / when / old→new on every party, deal, rating, relationship, and consent record — not just "last modified" columns. Tamper-evident; exportable for SEBI/RBI/FIMMDA inspection.

**Scale.** 10,000+ party rows is well within commodity relational-database territory — the binding constraints are *not* scale but (a) a relationship-centric data model, (b) India data residency, and (c) build-vs-buy fit. We design with a `tenant_id` and RLS from day one even though you are single-tenant today, so future lines of business (Binary Bonds vs Binary Capital IB vs any asset-management vehicle) can be partitioned, and so we can later productize to other Indian IBs/bond desks as a second tenant.

**Hosting portability.** Cloud-agnostic and multi-cloud-ready per SEBI Cloud Framework guidance. We prefer an India-region hyperscaler with a documented exit/expunging path so you are never locked in. Field-level encryption for SPDI fields (PAN, masked Aadhaar, bank account, KYC, credit-analysis, deal economics). DLP and masking in non-production environments.

**Performance targets.** Page load ≤2s p95 for 360° views; investor-match query ≤3s p95 across the full investor book with multi-dimensional filters; bulk import of 10k records ≤10 min with progress and error report; audit log writes asynchronous and non-blocking to user UX.

---

## 8. Phased Plan & Timeline

The plan is sequenced so that each phase ships value on its own and so that the gating items in Section 10 are resolved in Phase 0 before scope is fixed.

### Phase 0 — Discovery & gating (weeks 1–4)

Goal: confirm the facts that fix scope, execute contracts, and stand up the India hosting foundation.

- Resolve all gating items in Section 10 (your SEBI COR verified on the SI Portal; BSE/NSE/CCIL/DP/FIMMDA memberships confirmed; credit-bureau eligibility confirmed; DPDP Rules final status checked against live MEITY/eGazette; rating-agency and Bloomberg/Refinitiv licence status confirmed).
- Inventory and assess data quality of the 10,000+ existing records (Excel/Google Sheets/broker back-office).
- Confirm India data-residency requirements with your compliance/legal counsel.
- Re-verify bare-act retention and BO-threshold sources (PMLA s.12; PML Rules 2005 Rule 9(3); SEBI IA Reg 19(2); PM Reg 29) before coding.
- Execute MSA + DPA + SLA + NDA + IP/License schedule + source-code escrow + exit/data-deletion agreement.
- Stand up India-only hosting (MeitY-empaneled cloud, BYOK/HSM, encryption, DR).
- Deliverables: Phase 0 discovery report (gating-item resolutions, data-quality assessment, finalised compliance matrix, fixed-scope SOW, fixed-price quote, contract pack).

### Phase 1 — MVP (months 2–5)

Goal: replace spreadsheets, pass compliance, run credit, and unblock deal teams from day 1.

- Unified party master with role overlays (issuer/investor/intermediary) + 10k-record migration with dedup and entity resolution.
- RBAC + Chinese-wall/information-barrier logic (PIT Regs).
- Immutable audit logging + 180-day CERT-In log retention.
- KYC module (CDD fields, PAN, masked Aadhaar, CKYC ID, KRA ref) with KRA + CKYCRR 2.0 API integration; risk-rating engine; BO traversal (Rule 9(3) thresholds); PEP/sanctions screening.
- DPDP consent management engine + Data Principal rights portal; retention engine (PMLA s.12, SEBI 5-yr).
- Deal/mandate pipeline (minimal: mandate object + stage tracking across core lifecycles + product-type tag + basic next-milestone/owner).
- Credit-rating agency tracking + advisory workflow (all 7 CRAs, rating-action history, rating-mandate object).
- Document management (core: store + version NDAs/engagement letters/term sheets/rating letters).
- Founder + compliance dashboards (pipeline, compliance health, credit throughput).
- Notifications (KYC expiry, rating actions, last-touch nudges).
- Account Aggregator FIU onboarding + integration (highest-value credit feed).
- Email/calendar + WhatsApp integration; DigiLocker; GSTIN/PAN verification.
- Deliverables: deployed MVP in production on India hosting; 10k records migrated and signed off; admin + end-user training; runbook; UAT sign-off.

### Phase 2 — Credit + compliance depth (months 5–8)

Goal: activate the bond desk's analytical IP and the full compliance depth.

- Credit-analysis workbench (financial spreading of Indian-format financials, ratio analysis, configurable internal scorecard, agency-rating mapping, exposure/limit management mirroring RBI ceilings, watchlist/early-warning, credit-committee workflow).
- Embedded FIMMDA bond-pricing calculators (YTM, clean/dirty, duration, convexity, spread).
- Excel model round-tripping + versioned template library (bond pricing, PF SPV, securitisation, DCF, M&A/LBO, debt sizing).
- Custom IOI / order-book / allocation module (verified not native to any CRM).
- Credit-rating advisory workflow (rating-mandate object linking credit model, agency correspondence, rating outcome).
- PMLA STR/CTR workflow + FIU-IND FINnet 2.0 XML export via Principal Officer; periodic KYC refresh scheduler (RBI 10/8/2).
- Designated-person + trading-window + pre-clearance workflow (PIT Regs).
- SCORES 2.0 complaint integration (21-day SLA + ATR).
- Breach detection + notification workflow (DPDP + CERT-In 6-hr + SEBI/RBI layered); RoPA; sub-processor register; SDF toolkit (DPIA, independent data audit, India DPO) if you are notified as an SDF.
- Secondary trading / market-making integration (read-only, gated on membership — see §6).
- SEBI multi-category compliance profiles (MB / Broker / IA / PM / DT).
- Regulatory reporting pack.
- Deliverables: credit workbench in production; bond-pricing calculators live; IOI/order-book/allocation module in production; STR/CTR + FINnet export tested with your Principal Officer; PIT designated-person register live; Phase 2 UAT sign-off.

### Phase 3 — Advanced + productization (months 8–12)

Goal: deepen operational integration, add intelligence, and harden for scale and productization.

- Member-only integrations *if* your memberships are confirmed (BSE/NSE debt ingestion, CCIL F-TRAC reporting, demat APIs) — otherwise licensed delayed feeds / manual entry.
- Bloomberg/Refinitiv consumption *if* you have a licence.
- Relationship intelligence + zero-entry activity capture (email/calendar/WhatsApp auto-logging, relationship-strength scoring, warm-intro path-finding across the 10k+ book).
- Generative-AI copilot with trust/security layer (no PII/MNPI leakage to public LLMs) + conversational querying.
- ESG / green-bond tracking (BRSR Core, Sovereign Green Bond Framework, SEBI green debt securities).
- Counterparty master with regulator/flow-down obligation tracking.
- CSCRF independent assurance / VAPT by CERT-In-empaneled auditors + SOC 2 / ISO 27001 / ISO 22301 certification evidence.
- Multi-tenant hardening (vendor productization path); source-code escrow deposit; DR drills + BCP test.
- Mobile CRM (responsive web → P2 PWA with offline-tolerant capture).
- Admin/end-user training refresh + video walkthroughs.
- Deliverables: advanced modules in production; CSCRF/VAPT evidence pack; SOC 2 / ISO 27001 / ISO 22301 certifications on demand; source-code escrow deposited; go-live + 90-day warranty.

---

## 9. Commercial Model

We recommend and price a **one-time build fee + Annual Maintenance Contract (AMC)**, with an optional per-user SaaS tier activated only if a second tenant is signed. This matches the unit economics of a single boutique client — per-user SaaS pricing breaks when the vendor bears all fixed cost with one tenant.

**Effort.** Approximately **40–60 person-months** total — commodity CRM core + custom India bond/credit/compliance modules + 10k-record migration. The existing repository scaffold (Next.js 16 + Drizzle + Postgres + Auth.js v5 + shadcn/ui, 42 tables, 67 enums) is a head start; remaining build is auth + RBAC/RLS, server actions, feature routes, and integration adapters.

**Pricing structure.**

| Component | Basis | Amount |
|---|---|---|
| One-time build fee (capex) | ~40–60 PM hybrid build + 10k-record migration + integrations + training; milestone-billed 20% kickoff / 30% MVP / 30% UAT / 20% go-live + 90-day warranty | **[VENDOR PRICING — TO CONFIRM]** |
| Annual Maintenance Contract (AMC) | 15–18% of build fee, annual; covers bug-fix, minor enhancements, infra, security patching, SLA support (P1/P2 response, ≥99.5% uptime, RPO ≤24h), compliance updates (PMLA/RBI/SEBI/DPDP rule changes), integration adapter maintenance | **[VENDOR PRICING — TO CONFIRM]** (15–18% of build) |
| Optional per-user SaaS tier | Activated only at tenant #2 (if we productize to a second Indian IB/bond desk); not applied to your single-tenant engagement | **[VENDOR PRICING — TO CONFIRM]** (Indian SaaS benchmarks ₹1,000–3,000/user/month for generic CRM — sanity ceiling only, not a floor for a custom India-bond product) |
| Implementation / data migration | Folded into build fee (10k-record migration, dedup, entity resolution ~4–6 PM) | Included in build fee |
| Integration onboarding costs | Passed through where you pay the third party directly (Sahamati membership, KRA per-call fees, MCA aggregator subscription, rating-agency licences, Bloomberg/Refinitiv licence, GSP/ASP fees). We bill integration build effort. | Pass-through + build effort in build fee |

**Benchmark for comparison.** Microsoft Dynamics 365 Sales Enterprise India list price is **₹8,735/user/month** (confirmed). For ~50 users that is ~₹52.4 lakh/year of licence *alone* — for a platform that still has no bond pricing, no Indian rating mapping, no PMLA KYC tiers, no BSE/NSE/CCIL/KRA/AA integrations, and no DPDP consent, and that would still need the custom layer we are building. Salesforce FSC India pricing is not publicly listed (salesforce.com returned HTTP 403 in our research) — industry-cited range ~USD 150–300/user/month plus Einstein add-ons; **to be confirmed with a written Salesforce India quote** if a build-vs-buy TCO re-evaluation is needed. The hybrid build + AMC is cheaper over a 5-year horizon *and* gives you the India bond/credit/compliance IP that none of those platforms provide.

**GST.** 18% GST on the build fee + AMC (SAC 9983 series — exact code to confirm against current CBIC notification). IGST to you in Maharashtra if we are in a different state; CGST + SGST if both intra-state Maharashtra. We are GST-registered and will issue B2B tax invoices with GSTIN, SAC, place-of-supply, and IGST/CGST+SGST breakdown; B2B e-invoicing where applicable.

**Liability and insurance.** Liability capped at 12-month fees, with carve-outs (uncapped) for data breach caused by us, IP infringement, and gross negligence / wilful misconduct. We size professional liability and cyber insurance against the uncapped carve-outs and the DPDP indemnity exposure.

**Contracting entity.** Binary Capital Advisors LLP (the LLP). Binary Bonds is a division, not a separate legal entity — the LLP signs the MSA/DPA. We will clarify whether bond-division data is siloed by role-based access.

---

## 10. Assumptions, Gating Items & Open Questions

This section is critical. These are **your action items** that gate the final scope. We cannot fix scope or price until they are resolved. Phase 0 (Section 8) is designed to resolve them in 2–4 weeks.

### Gating item #1 (CRITICAL) — Your SEBI registration category and COR

Your website describes the firm as "SEBI registered investment banker, RBI compliant" and references "Merchant Banker Coordination." **"Investment banker" is not a recognised SEBI registration category.** SEBI registers Merchant Bankers, Debenture Trustees, Investment Advisers, Portfolio Managers, Stock Brokers, and Research Analysts. The "Merchant Banker Coordination" wording suggests you may act as coordinator/advisory alongside a separate registered merchant banker rather than holding your own registration.

**Your action:** Provide your Certificate of Registration(s) so we can verify entity name + COR number on the **SEBI SI Portal (siportal.sebi.gov.in)** before we hard-code any registration category into the compliance design. The entire SEBI compliance layer — record-retention periods, CSCRF tier, PIT applicability, KRA access, Cloud Framework applicability — turns on this. If you are *not* a SEBI-registered intermediary, the SEBI layer is re-scoped (DPDP / CERT-In / PMLA / RBI-via-counterparties still apply regardless) and we re-price accordingly.

### Gating item #2 (HIGH) — Market-infrastructure memberships

We found no evidence in public sources that you hold BSE/NSE debt-segment membership, CCIL membership, DP (CDSL/NSDL) registration, FIMMDA membership, or PDAI membership. The adversarial check suggests you likely operate as arranger/advisory, clearing through sponsoring members.

**Your action:** Confirm which of these you hold. This determines whether member-only integrations (BSE/NSE trade-data ingestion, CCIL F-TRAC reporting, demat APIs) are in scope or scoped out — and therefore the value of the CRM's secondary-trading and settlement modules.

### Gating item #3 (HIGH) — DPDP Rules 2025 final notification status

The DPDP Act 2023 has phased commencement — certain provisions 13 Nov 2025, more 13 Nov 2026, remaining 13 May 2027. The DPDP Rules 2025 (draft published 3 Jan 2025) cover Consent Manager registration, breach-notification form, SDF thresholds, and children's verifiable consent. **Final notification status and which sections are in force as of June 2026 must be verified against the live MEITY/eGazette record before go-live.**

**Your action:** We will track this on your behalf as part of Phase 0, but we flag it as a regulatory uncertainty that affects the breach-notification clock, Consent Manager API availability, and SDF thresholds. We design the CRM to be Rules-ready regardless.

### Gating item #4 (MEDIUM) — Credit-bureau eligibility

You are an IB/advisory, not a registered lender / Credit Institution under CICRA. Individual credit-bureau access (CIBIL/Experian/Equifax/CRIF High Mark) is likely **not available** to you; company/commercial reports may be.

**Your action:** Confirm your CICRA eligibility. If ineligible, we lock the credit-analysis design around Account Aggregator + rating agencies + MCA financials — which is our recommended design regardless, because AA is the highest-value, most feasible credit feed.

### Additional gating and confirmation items (resolve in Phase 0)

- **Your RBI registration category (if any).** The "RBI compliant" claim suggests possible NBFC or FEMA debt-investment registration. Determines whether RBI KYC Master Direction and RBI outsourcing norms apply directly vs only via counterparty contracts.
- **Bare-act re-verification.** We will re-verify retention and BO-threshold sources against bare-act text before coding: PMLA s.12 (5 yrs from transaction date; 5 yrs after relationship ended or account closed, whichever is later — *not* PML Rules Rule 7); PML Rules 2005 Rule 9(3) BO thresholds (company >10%, partnership >15%, trust 15%; role-based SMO fallback, no 25%); SEBI IA Regs 2013 Reg 19(2) (not Reg 26) 5-yr retention; SEBI PM Regs 2020 Reg 29 (not Reg 27) 5-yr retention.
- **CKYCRR 2.0 + KRA + Sahamati + FIU-IND onboarding lead times.** Confirm API spec/endpoint/onboarding with CERSAI; with the specific KRA(s) you use; with Sahamati for FIU onboarding + per-AA transaction fees; with FIU-IND FINnet 2.0 / FINGate 2.0 for your Principal Officer.
- **Salesforce FSC current India list price** — obtain a written Salesforce India quote if a build-vs-buy TCO re-evaluation is needed.
- **IT Act s.43A / SPDI Rules 2011** — confirm whether they remain in force alongside DPDP as of June 2026 or have been withdrawn/amended; we design for both regimes in parallel pending confirmation.
- **SEBI CSCRF per-tier assurance mapping.** Obtain the bare SEBI CSCRF circular (20 Aug 2024) + Apr 30 2025 clarification + June 2025 FAQ and parse the per-tier assurance mapping for Small-size REs (active merchant bankers). Confirm your current CSCRF compliance status (the 30 Jun 2025 deadline is historical).
- **GST** — confirm 18% rate + exact SAC code (9983 series) + place-of-supply treatment via current CBIC notification or your CA's written opinion.

### Open questions (from the PRD — to confirm with founders)

- The **10,000+ total relationships** figure (per client kickoff) vs **150+ institutional investors / 100+ clients / 70+ organisations** (public, active-repeat) — likely total book vs active/repeat; please reconcile so we baseline KPIs and migration counts correctly.
- **Firm's SEBI/RBI registration numbers and category** — for regulator-facing exports and CRM record-keeping.
- **Aggregate-stat reconciliation** — ₹2,000 Cr vs ₹5,000 Cr; 100+ rating assignments vs 115+ transactions; affects baseline KPIs.
- **Naming/branding in records** — single brand "Binary Capital" with "Binary Bonds" as a product-line tag? We assume division/product-line tag; please confirm.
- **OMS integration target in Phase 2/3** — which OMS does the trading desk use today? Currently undisclosed.
- **Retail "Buy Bonds" channel regulatory status** — whether the firm is a SEBI-registered broker authorised on BSE/NSE debt segment for retail; affects whether the Phase 3 portal is permissible.
- **Investor preference data sourcing** — manual RM entry vs ingestion from investor mandate letters vs inferred from trade history.
- **Fee/economics visibility** — which roles see fee estimates and actuals. Assumed founders/partners only; please confirm.
- **Data migration cut-over strategy** — big-bang vs phased by product line (e.g., Bonds first, then IB).

---

## 11. Deliverables & Acceptance

### Per-phase deliverables

**Phase 0.**
- Discovery report (gating-item resolutions, data-quality assessment, finalised compliance matrix).
- Fixed-scope SOW + fixed-price quote.
- Executed contract pack (MSA + DPA + SLA + NDA + IP/License schedule + source-code escrow + exit/data-deletion agreement).
- India hosting foundation stood up (MeitY-empaneled cloud, BYOK/HSM, encryption, DR).
- *Acceptance:* you sign off on scope, price, and the contract pack; hosting attestable to India residency.

**Phase 1 (MVP).**
- Deployed MVP in production on India hosting.
- 10,000+ records migrated, deduped, enriched, KYC-status tagged — with your sign-off in staging before production cutover.
- Party master + two-sided relationship graph; RBAC + Chinese walls; immutable audit; KYC module with KRA + CKYCRR 2.0 integration; DPDP consent engine + rights portal; minimal deal/mandate pipeline; credit-rating agency tracking; document management (core); founder + compliance dashboards; notifications; Account Aggregator integration; email/calendar + WhatsApp; DigiLocker; GSTIN/PAN verification.
- Admin + end-user training; runbook; video walkthroughs.
- *Acceptance:* UAT sign-off against the Phase 1 acceptance criteria document; 10k-record migration signed off; MVP uptime ≥99.5% during business hours across a 2-week stability window.

**Phase 2.**
- Credit-analysis workbench in production; bond-pricing calculators live; Excel round-trip + versioned template library; IOI / order-book / allocation module; credit-rating advisory workflow; STR/CTR + FINnet XML export tested with your Principal Officer; PIT designated-person register + pre-clearance + trading-window closures; SCORES 2.0 complaint integration; breach detection + notification workflow; RoPA; sub-processor register; SDF toolkit; secondary trading read-only integration (gated on membership); SEBI multi-category compliance profiles; regulatory reporting pack.
- *Acceptance:* UAT sign-off against the Phase 2 acceptance criteria document; STR/CTR XML export validated against FIU-IND templates; credit-committee workflow exercised end-to-end on a live mandate.

**Phase 3.**
- Member-only integrations (if memberships confirmed) or licensed delayed feeds / manual entry; Bloomberg/Refinitiv consumption (if licensed); relationship intelligence + zero-entry capture; generative-AI copilot with trust layer; ESG / green-bond tracking; counterparty master with flow-down tracking; CSCRF VAPT evidence + SOC 2 / ISO 27001 / ISO 22301 certifications on demand; multi-tenant hardening; source-code escrow deposited; DR drills + BCP test; mobile CRM; training refresh.
- *Acceptance:* UAT sign-off; VAPT report from a CERT-In-empaneled auditor with no critical findings open; DR drill completed within RTO/RPO targets; source-code escrow deposit confirmed; go-live + 90-day warranty commenced.

### Standard acceptance criteria (all phases)

- Functionality matches the signed-off acceptance criteria document for the phase.
- Security: no critical VAPT findings open; RBAC/Chinese-wall tests pass; audit log integrity verified.
- Compliance: retention engine, consent ledger, BO traversal, STR/CTR XML, and breach-notification workflow tested against the compliance matrix.
- Performance: page-load ≤2s p95 for 360° views; investor-match query ≤3s p95 (from Phase 2); bulk import ≤10 min for 10k records.
- Uptime: ≥99.5% during business hours (Mon–Fri 9AM–6PM IST) in MVP; ≥99.9% from Phase 2.
- Data: migration signed off in staging before production cutover; audit-stamped import; rollback verified.
- Training: admin + end-user training delivered; runbook + video walkthroughs handed over.

---

## 12. Engagement Terms (summary)

These are summaries; the full terms are in the MSA, DPA, and SLA, which we will draft and circulate for your counsel's review in Phase 0.

- **Master Services Agreement (MSA).** Umbrella contract governing scope, fees, payment milestones (20% kickoff / 30% MVP / 30% UAT / 20% go-live + 90-day warranty), warranties, limitation of liability, indemnities, term/termination, governing law (Indian law), dispute resolution (Mumbai-seat arbitration or Mumbai courts), force majeure, change management. Signed with Binary Capital Advisors LLP.
- **Data Processing Agreement (DPA) — DPDP-aligned.** Binds us (Data Processor) to your (Data Fiduciary) DPDP / SPDI / SEBI / RBI obligations. Processing only on your documented instructions; purpose limitation; confidentiality of personnel (backed by IT Act ss.72/72A criminal exposure); security safeguards (ISO 27001-aligned, encryption at rest/in transit/in use, RBAC, MFA, audit logging, India HSM key management); sub-processor control (prior notice/consent, flow-down, register); cross-border transfer restrictions (no export to blacklisted countries; RBI/SEBI localisation where applicable); breach detection + prompt vendor-to-fiduciary notification (without undue delay / 24–48h); assistance with Data Principal rights and DPIA/audit/DPO functions; return or certified deletion of data on termination (per SEBI Cloud Framework expunging clause); audit/inspection rights for you + regulators (SEBI/CERT-In/RBI); Records of Processing Activities; indemnity for vendor-caused breaches; GST-compliant invoicing. Express prohibition on us independently determining processing purposes (which would risk us becoming a joint Data Fiduciary).
- **Service Level Agreement (SLA).** Uptime ≥99.5% (MVP) / ≥99.9% (Phase 2+); P1/P2/P3 response + resolution times; RPO ≤24h (MVP) / ≤1h (Phase 2); RTO ≤8h (MVP) / ≤4h (Phase 2); backup frequency + restore testing; support hours + ticket channels; penalty/credit computation for SLA breaches; escalation matrix; AMC covers bug-fix, minor enhancements, infra, security patching, SLA support, compliance updates, and integration adapter maintenance.
- **Intellectual Property.** Custom India bond/credit/compliance modules (bond pricing, Indian rating mapping, PMLA KYC, DPDP consent, India integrations, FIMMDA/RBI reporting hooks, PIT Chinese-wall logic, deal-velocity analytics) are **vendor-owned and productizable** — you receive a **perpetual license** to use them. The reusable commodity CRM platform/engine remains vendor-licensed. Module-level IP separation in the codebase/deployment so the commodity core can be swapped while custom modules remain portable. Multi-tenant-ready architecture so we can productize to other Indian IBs/bond desks as a second tenant. Change-management and version-control records evidence IP ownership and warranty scope.
- **Source-code escrow.** Source code + build artifacts + deployment docs + encryption key custody deposited with an independent escrow agent; release triggers (vendor bankruptcy, failure to maintain SLA, abandonment). Critical given small-vendor single-point-of-failure risk.
- **Liability.** Capped at 12-month fees, with carve-outs (uncapped) for data breach caused by us, IP infringement, and gross negligence / wilful misconduct. We size professional liability + cyber insurance against the uncapped carve-outs and DPDP indemnity exposure.
- **India-only hosting.** Primary, DR, and backups on MeitY-empaneled + STQC-audited cloud in India (AWS Mumbai / Azure India / GCP India), BYOK/HSM, encryption at rest/in transit/in use, exit/expunging clauses. No cross-border replication without your approval and legal basis.
- **Warranty.** 90-day warranty post go-live covering defects, bug-fix, and knowledge transfer.
- **Exit.** Bulk export of all your records + metadata in open formats (CSV/JSON) on termination; certified data deletion across disks/backups/logs (per SEBI Cloud Framework expunging clause) with certificate of destruction; minimum SEBI/Government retention preserved even after exit; transition assistance period.

---

## 13. Why Us

[VENDOR TO FILL — this section is a placeholder for the vendor's credentials, case studies, team biographies, relevant Indian financial-services / SEBI-regulated entity experience, security certifications (SOC 2 / ISO 27001 / ISO 22301), CERT-In-empaneled auditor relationships, and prior CRM builds for IB / capital-markets / bond-desk clients. The vendor should also cite any in-house fixed-income / credit-analysis domain expertise or named domain consultant partnerships here.]

---

## 14. Next Steps

1. **Sign a mutual NDA** (we will circulate a draft this week) so we can exchange the data needed for Phase 0.
2. **Run Phase 0 discovery (2–4 weeks).** We resolve the gating items in Section 10 — verify your SEBI COR on the SI Portal, confirm BSE/NSE/CCIL/DP/FIMMDA memberships, confirm credit-bureau eligibility, check DPDP Rules final status, confirm rating-agency and Bloomberg/Refinitiv licence status — and assess your 10,000+ records' data quality. You provide the registrations, memberships, and data sources; we do the verification and scoping.
3. **Resolve gating items** with your compliance counsel and our compliance track. We produce a finalised compliance matrix and fixed-scope SOW.
4. **Execute MSA + DPA + SLA + IP/License schedule + source-code escrow + exit agreement.** Your counsel reviews; we close on terms.
5. **MVP build (months 2–5).** We stand up India hosting, migrate the book, and ship the MVP. You get a working system at UAT and a 90-day warranty at go-live.

We would welcome a working session with Shray, Shahrukh, and Rati to walk through this proposal, answer questions, and tailor the scope to your priorities before we commit to Phase 0.

---

*End of Proposal & SOW. Pricing and vendor-credential sections marked with placeholders are to be confirmed before signature. No pricing figures, timelines, or client facts beyond the source research have been fabricated; where the research flagged uncertainty (SEBI registration category, market-infrastructure memberships, DPDP Rules final status, credit-bureau eligibility, data-source licences), that uncertainty is preserved explicitly in Section 10 as client-action gating items.*
