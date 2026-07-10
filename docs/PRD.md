# Product Requirements Document — Binary Capital CRM

**Client:** Binary Capital Advisors LLP ("Binary Capital") and its bond-markets division "Binary Bonds — A Division of Binary Capital."
**Office:** Spaces Adani Height, Andheri West, Mumbai 400053.
**Document status:** Draft v1.0 — 2026-06-26. Decision-grade; assumes parallel architecture/compliance tracks confirm regulatory specifics flagged "to confirm."
**Owner (client side):** Shray Vasudeva (Founder & Managing Partner, Binary Capital / Founder & Director, Binary Bonds), Rati Ravi Kant (Director, Credit Analysis & Risk, Binary Bonds) — product sponsor; Shahrukh Sheikh (Managing Partner) — IB/coverage sponsor.

---

## 1. Vision & Problem

### 1.1 Vision
A single CRM that runs the **two-sided relationship business** of an Indian investment-banking boutique that is *also* a bond house — capturing issuer mandates on one side and the institutional/retail investor distribution book on the other, with embedded **credit analysis** and **financial modeling** so that the firm's core analytical IP (credit, structuring, valuation, DSCR) lives next to the relationships, not in disconnected Excel towers.

### 1.2 Why not generic Salesforce / a vanilla CRM
A generic CRM models a one-sided, linear sales funnel (lead → opportunity → close). Binary Capital's business is **two-sided and match-making**: an issuer mandate only succeeds if it is matched to a curated investor book, and an investor relationship only pays if it is repeatedly matched to deal flow. Concretely, generic CRMs fail on:

| Generic-CRM gap | Binary Capital reality |
|---|---|
| No native **issuer↔investor matching** (sector, rating band, tenor, ticket size, mandate type) | A real-estate NBFC raising ₹250 Cr 3-yr NCD must be matched against investors whose mandates permit BBB+ real-estate exposure at that tenor/ticket |
| No **deal/mandate object** with lifecycle (Mandate → Structuring → Rating → Underwriting → Placement → Settlement → Post-issue) | The 6-step underwriting process and 4-step G-Sec process are first-class workflows, not "opportunity stages" |
| No **credit analysis** module (financial spreading, ratio analysis, Indian rating-scale mapping, PD/LGD/EAD) | Credit rating advisory (CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics) and high-yield underwriting are core revenue lines — the CRM must produce rating-ready memos |
| No **financial modeling** layer (DCF, DSCR for project finance/SPV, securitization cash-flow waterfall) | Project finance (non-recourse, ₹500+ Cr arranged, 15+ yr tenure), structured finance/securitization, and M&A valuations all require model capture and version control |
| No **Indian market microstructure** (BSE/NSE, CCIL DVP, NDS-OM, ICCL settlement, CDSL/NSDL demat, ISIN, G-Sec/SDL/T-Bill/SGB curve) | Secondary trading/market-making and G-Sec auction participation are operational workflows with settlement specifics |
| No **regulatory record-keeping** tuned to SEBI/RBI/FIMMDA, PMLA KYC/AML, DPDP Act 2023 | Every interaction with an issuer/investor is potentially recordable evidence; KYC status gates transacting |

### 1.3 The two-sided relationship problem at 10k+ scale
The 10,000+ client-relationships figure is **per the client kickoff (vendor-side input), representing the TOTAL relationship book** — the full set of investor-book contacts, issuer prospects, HNIs, intermediaries, and IFAs the firm has touched over the past decade. It is *not* from the public website/brochure, which show materially smaller *active/repeat* counts: **150+ institutional investors**, **100+ clients**, and **70+ organisations**. These are not necessarily contradictory — 10k is plausibly the total book (everyone ever in the Rolodex) while 70–150+ are the active/repeat clients generating current revenue. **To confirm with founders: reconcile 10k total vs public 70+ orgs / 100+ clients / 150+ investors (likely active-repeat vs total book)** — see Open Decision #15. Two-sidedness creates **N×M** matching pressure: 10k relationships × multiple service lines × investor book. Without a specialized CRM this produces:

- **Siloed relationship memory** — the same HNI may be a bond investor *and* an M&A client *and* a referral source; coverage bankers step on each other.
- **Mandate-to-investor blindness** — syndicate desk cannot query "which investors bought BBB+ NBFC paper last 18 months with tenor 3–5y" without manual spreadsheet archaeology.
- **Credit re-work** — the same issuer's financials get re-spread by different analysts on different mandates; no versioned model library.
- **Compliance debt** — KYC lapses on dormant investors; PMLA/DPDP audit trail is reconstructable only from email.
- **Founder bottleneck** — at ~6 SMEs + 2 directors (per brochure), institutional knowledge is concentrated in 2–3 people; a CRM is the only way to de-risk that concentration.

### 1.4 Vision statement (one line)
> A relationship-and-analytics platform that turns Binary Capital's 10k+ two-sided book, its credit-and-modeling IP, and its Indian regulatory obligations into a single, auditable, decision-grade system — so coverage, credit, syndicate, and compliance work from one source of truth.

---

## 2. Target Users & Personas

Six primary personas. Headcount is small (~6 SMEs + 2 directors per brochure), so most personas are 1–3 people today; the CRM must scale to growth without re-architecture.

### 2.1 Coverage / Relationship Manager (RM)
- **Covers:** Issuer clients (infra, real estate, manufacturing, NBFCs, services) and/or investor clients (banks, insurers, MFs, pension funds, AIFs, family offices, HNIs, NBFCs) + intermediaries (IFAs/brokers).
- **Goals:** Track every relationship, mandate history, last-touch, fee potential; never miss a rollover/refinancing window; surface cross-sell (a project-finance client → bond issuance → rating advisory).
- **Pain points today:** Excel-based client lists; no 360° view; cannot see what credit/trading has done with the same client; founder holds the "who matters" list in his head.

### 2.2 Credit Analyst (reports to Rati Ravi Kant, Director, Credit Analysis & Risk — Binary Bonds)
- **Does:** Financial spreading, ratio analysis, rating-scale mapping, credit memos, rating-agency coordination (CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics), PD/LGD/EAD, stress testing for high-yield.
- **Goals:** Cut credit turnaround time; produce rating-ready memos in days not weeks; maintain a reusable model/peer library; track rating outcomes vs target.
- **Pain points today:** Spreadsheets with broken links; no version control on models; rating-agency correspondence in personal email; no library of "what rating did this issuer get last time and why."

### 2.3 Bond Trader / Syndicate Desk (Shray Vasudeva-led)
- **Does:** Primary placement (investor book, allocations), secondary trading/market-making (two-way quotes on G-Secs/corporates), G-Sec/SDL/T-Bill/SGB auction participation, CCIL DVP / NDS-OM / ICCL settlement.
- **Goals:** Match mandates to investor preferences; see live investor mandate constraints (rating, tenor, sector, ticket); track blotter, execution, and settlement status; maintain secondary quotes/price discovery log.
- **Pain points today:** Investor preferences live in traders' heads; no queryable "investors who will buy X"; settlement status tracked manually across ICCL/CCIL/demat.

### 2.4 Deal / Mandate Team (IB — Shahrukh Sheikh-aligned)
- **Does:** M&A advisory, project finance (SPV/non-recourse, DSCR), structured finance/securitization, ECM/DCM advisory, supply-chain financing.
- **Goals:** Pipeline visibility across all mandates and stages; document management (term sheets, NDAs, engagement letters); milestone tracking; fee/success-fee forecasting.
- **Pain points today:** Pipeline is a slide deck updated weekly; deal documents scattered across email/Drive; no cross-mandate view for founders.

### 2.5 Compliance / KYC Officer
- **Does:** KYC/AML (PMLA), DPDP Act 2023 consent management, SEBI record-keeping, audit trail, regulator-facing retrieval, demat-status checks, watch-list/sanctions screening.
- **Goals:** 100% KYC currency before any transaction; one-click regulator retrieval; clean consent ledger; defensible audit trail.
- **Pain points today:** KYC in PDFs in a shared folder; no expiry alerts; no consent ledger; cannot prove "what did we tell investor X about issuer Y and when."

### 2.6 Leadership / Management (Shray, Shahrukh, Rati)
- **Shray Vasudeva** — Founder & Managing Partner (Binary Capital) / Founder & Director (Binary Bonds). Sole founder; leads strategic vision and the bond/syndicate desk.
- **Shahrukh Sheikh** — Managing Partner (Binary Capital). IB/coverage sponsor.
- **Rati Ravi Kant** — Director, Credit Analysis & Risk (Binary Bonds). Credit & risk lead.
- **Goals:** Dashboard of pipeline, revenue forecast, coverage productivity, credit throughput, compliance health, top clients/investors at risk.
- **Pain points today:** Weekly manual roll-ups; no real-time view; cannot answer "what's our pipeline by stage and probability" instantly.

---

## 3. Goals & Success Metrics

### 3.1 Quantifiable goals (12-month horizon post-MVP)

| # | Goal | Metric / Target | Owner |
|---|---|---|---|
| G1 | **Migrate the book** | 10,000+ client relationships + 150+ institutional investors imported, deduped, enriched, KYC-status tagged | Coverage lead |
| G2 | **Coverage productivity** | +40% mandates per RM; ≤7 days median last-touch on Tier-1 clients/investors | Coverage lead |
| G3 | **Credit turnaround** | Median issuer credit-memo turnaround ≤10 business days (baseline "≥21 days today" is an assumption, **to confirm with Rati Ravi Kant** — measure before quoting a baseline); rating-advisory memos ≤5 days | Rati Ravi Kant |
| G4 | **Deal pipeline visibility** | 100% of active mandates in pipeline with stage, probability, fee estimate, next milestone; founders' dashboard refreshes real-time | Shahrukh / Shray |
| G5 | **Issuer↔investor matching** | ≥70% of new primary placements sourced via CRM investor-match query (not trader memory) | Syndicate desk |
| G6 | **Compliance pass rate** | ≥99% of transacting clients have current KYC; 100% of regulated interactions logged with immutable audit trail; zero DPDP consent gaps | Compliance officer |
| G7 | **Model re-use** | ≥50% of new credit memos built from a templated/reusable model or peer comparison; version-controlled | Credit lead |
| G8 | **Adoption** | ≥90% of client-facing staff daily-active within 60 days of rollout | PM |

### 3.2 Anti-goals (things we will *not* measure as success)
- We are not measuring "leads created" — this is not a top-of-funnel SaaS sales motion; relationships are long-cycle and relationship-led.
- We are not measuring trading P&L inside the CRM — that lives in the OMS/accounting integration.

---

## 4. Scope — Modules

### 4.1 In scope (MVP unless marked P2/P3)

| Module | Core capability | Binary-Capital specifics |
|---|---|---|
| **M1. Relationship & Client 360** | Unified issuer + investor + intermediary records; 360° view (mandates, holdings, KYC, touchpoints, fees); household/group linking for HNIs/family offices | Investor mandate constraints (rating band, tenor, sector, ticket, demat); issuer attributes (sector, rating, outstanding paper, refinancing calendar) |
| **M2. Mandate / Deal Pipeline** | Mandate object with product-type workflows (IB: M&A, project finance, structured finance, ECM/DCM, SCF; Bonds: underwriting, rating advisory, G-Sec auction, portfolio mandate) | Per-product lifecycle stages mirror the published 4/5/6/8-step processes; fee tracking (retainer + success fee). **MVP = minimal pipeline + stage tracking; full per-product lifecycle + fee forecasting in P2.** *Note on Bond Portfolio Management:* the **portfolio mandate** product type covers *origination* (Investment Mandate → Strategic Asset Allocation → Security Selection → Monitoring & Rebalancing). The **ongoing** portfolio-mandate workflow — periodic rebalancing events, performance attribution, risk-metric/benchmark tracking, and client reporting cycles — is **deferred to P2** as a dedicated portfolio-mandate sub-workflow; MVP only captures the mandate record + stage + linked investor client. |
| **M3. Credit Analysis** | Financial spreading (P&L, BS, CF), ratio analysis (coverage, leverage, liquidity, profitability), Indian rating-scale mapping across CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics, credit memo templates, PD/LGD/EAD, peer comparison library | Rating-advisory ROI tracking (the 10–50x reduced-borrowing-cost claim); rating-outcome vs target |
| **M4. Financial Modeling** | Versioned model library: DCF, DSCR/project finance (non-recourse SPV), securitization cash-flow waterfall, M&A valuation (comparables, precedent), sensitivity/scenario | Locks to M3 outputs; reusable templates per product line |
| **M5. Investor Match & Placement** | Queryable investor book by (rating band × tenor × sector × ticket × demat-ready × KYC-current); allocation tracking; placement record per ISIN/deal | Powers the syndicate desk's "who will buy this" question |
| **M6. Secondary Trading Blotter** | Order blotter, two-way quote log, execution record, settlement status (CCIL DVP / NDS-OM / ICCL / demat), G-Sec/SDL/T-Bill/SGB auction participation log | Not an OMS — read/write reference data only; execution integrates to OMS (out of scope) |
| **M7. KYC / AML / Consent (Compliance)** | KYC status + expiry + alerts; PMLA risk categorization; sanctions/watch-list screening; DPDP consent ledger (purpose, timestamp, withdraw); demat-status linkage | Blocks transactions on expired KYC; one-click regulator retrieval |
| **M8. Audit Trail & Records** | Immutable, append-only audit log of all reads/writes on regulated entities; SEBI/RBI/FIMMDA record-keeping retention; export for regulator | Tamper-evident; retention per SEBI/RBI rules (to confirm exact periods) |
| **M9. Documents & Engagement** | NDAs, engagement letters, term sheets, rating letters, offer documents, ISIN/agency correspondence; versioned; linked to mandate/client | templated NDA/engagement-letter generation |
| **M10. Dashboard & Reporting** | Founder/management dashboards (pipeline, revenue forecast, coverage productivity, credit throughput, compliance health, top-at-risk) | Saved views per persona |
| **M11. Notifications & Tasks** | Rollover/refinancing alerts, KYC-expiry alerts, rating-action alerts, mandate-stage reminders, last-touch nudges | Drives G2, G6 |

### 4.2 Explicit Out-of-Scope (integrate, do not rebuild)

| Out of scope | Why | Integration approach |
|---|---|---|
| **Order Management System (OMS) / execution** | Trading execution belongs in exchange-facing OMS; CRM is reference + workflow | CRM holds blotter metadata; OMS holds execution; nightly/real-time sync |
| **Portfolio accounting / NAV** | Portfolio management reports on holdings; accounting system holds the books | Read-only feed from accounting/portfolio system into CRM investor view |
| **General ledger / firm accounting** | Not a finance system | None (out of scope entirely) |
| **Live market data feeds / quoting engine** | Real-time G-Sec/bond prices come from vendors (Bloomberg/Refinitiv/NSE/BSE) | CRM stores last-known prices and ISIN metadata; live data via vendor API, not home-grown |
| **Demat/CDSL/NSDL operational integration (MVP)** | Demat operational linkage is complex; MVP uses status fields + manual confirmation | P2/P3: API integration to DP |
| **HR, payroll, internal ITSM** | Not client-facing | None |
| **Marketing automation / mass email** | Not a marketing-led funnel; relationship-led | None in MVP (P3 lightweight batch comms only) |
| **Retail self-service investor portal** | Retail "Buy Bonds" channel exists but institutional is primary | P3 separate workstream |

---

## 5. Phased Scope — MVP / Phase 2 / Phase 3

### 5.1 MVP (≈0–4 months) — "Single source of truth + credit + compliance + minimal deal pipeline"
Goal: replace spreadsheets, pass compliance, run credit, and unblock deal teams from day 1. Targets G1, G3, G6, G8 (and early progress on G4 via minimal pipeline).

> **MVP value statement:** MVP ships the data foundation + credit + compliance + a minimal deal pipeline so deal teams aren't blocked; the full investor-match engine lands in P2.

- **M1 Relationship & Client 360** — schema for issuer/investor/intermediary; bulk import of 10k+ records; dedupe; KYC-status tagging.
- **M2 Mandate / Deal Pipeline (MINIMAL)** — mandate object + stage tracking across the core lifecycles (Mandate → Structuring → Rating → Underwriting → Placement → Settlement → Post-issue) with product-type tag and basic next-milestone/owner; enough for pipeline visibility and to stop deal teams reverting to slide decks. Full per-product lifecycle enforcement, fee forecasting, and milestone document linking remain in Phase 2.
- **M3 Credit Analysis** — financial spreading, ratio engine, Indian rating-scale mapping (all 6 agencies), credit-memo templates, peer library.
- **M4 Financial Modeling (core)** — versioned DCF + DSCR/project-finance + securitization waterfall templates; model-to-credit linkage.
- **M7 KYC/AML/Consent** — status, expiry alerts, PMLA risk cat, DPDP consent ledger, transaction block on expired KYC.
- **M8 Audit Trail & Records** — immutable log; retention config; regulator export.
- **M9 Documents (core)** — store + version NDAs/engagement letters/term sheets/rating letters.
- **M10 Dashboard (founders + compliance)** — pipeline, compliance health, credit throughput.
- **M11 Notifications** — KYC expiry, rating actions, last-touch nudges.
- RBAC, audit, backup/DR from day 1 (Section 7).

### 5.2 Phase 2 (≈4–8 months) — "Two-sided matching + deal workflow"
Goal: activate the syndicate desk and IB mandate engine. Targets G2, G4, G5, G7.

- **M2 Mandate/Deal Pipeline (FULL)** — builds on the MVP minimal pipeline: full per-product lifecycle enforcement, fee forecasting (retainer + success fee), milestone tracking with document links, cross-mandate views. Includes the **Bond Portfolio Management sub-workflow**: periodic rebalancing events, performance attribution, risk-metric/benchmark tracking, and client reporting cycles on ongoing portfolio mandates.
- **M5 Investor Match & Placement** — full constraint query engine (rating band × tenor × sector × ticket × demat-ready × KYC-current); allocation tracking; ISIN/deal placement records.
- **M6 Secondary Trading Blotter** — blotter, quote log, settlement status (manual confirmation against ICCL/CCIL), auction participation log.
- **M4 expansion** — M&A valuation templates, structured-finance/SCF models.
- **M9 expansion** — templated NDA/engagement-letter generation.
- Mobile-responsive coverage app (Section 7.6).

### 5.3 Phase 3 (≈8–14 months) — "Operational integration + retail channel"
Goal: deepen operational integration and serve the retail "Buy Bonds" channel. Targets scale + retail revenue.

- DP (CDSL/NSDL) status API integration.
- OMS two-way sync (execution ↔ CRM blotter).
- Vendor market-data integration (Bloomberg/Refinitiv/NSE/BSE) for live ISIN/prices.
- Retail/HNI/NRI/IFA self-service investor portal (separate workstream; DPDP-consented).
- Advanced analytics: coverage productivity analytics, league-table-style internal tracking, churn/at-risk models on investor book.
- Optional: API for IFAs/brokers to submit investor orders (with KYC gate).

---

## 6. Key Constraints

### 6.1 India regulatory constraints
| Constraint | Implication for CRM | Status |
|---|---|---|
| **SEBI record-keeping** (applicable to merchant bankers / brokers / investment advisers — *firm's exact SEBI category not disclosed, to confirm*) | All mandate, placement, trading-blotter, and client-interaction records must be retained and retrievable on demand; tamper-evident | Exact retention periods **to confirm** with compliance counsel |
| **PMLA KYC/AML** | KYC mandatory before transacting; risk categorization; ongoing monitoring; suspicious-transaction reporting hooks; sanctions screening | Standard PMLA rules apply |
| **DPDP Act 2023** | Explicit, purpose-limited, withdrawable consent; data minimization; data principal rights (access, correction, erasure, grievance); breach notification within 72 hours; **data localization** — personal data of Indian principals processed/stored in India | Consent ledger (M7) is first-class; architecture must allow India residency |
| **RBI** (G-Sec auction, market infrastructure) | G-Sec/SDL/T-Bill/SGB auction participation records; CCIL DVP/NDS-OM settlement records | Operational logging in M6 |
| **FIMMDA** best practices | Reporting conventions for FIMMDA-regulated instruments | Followed in blotter/reporting |
| **SEBI/RBI/FIMMDA registration numbers not disclosed by firm** | CRM must store and surface the firm's registration numbers once confirmed; regulator-facing exports must cite them | **To confirm** with founders/compliance |

### 6.2 Scale & data constraints
- **10k+ total relationships** (per client kickoff — total book incl. investor book, issuer prospects, HNIs, intermediaries, IFAs) vs **150+ institutional investors / 100+ clients / 70+ organisations** (public, active-repeat); reconciliation in Open Decision #15. Design for growth to 50k+ total without schema change.
- **Two-sided graph** (issuer ↔ investor ↔ intermediary ↔ mandate ↔ instrument) — graph-friendly data model recommended.
- **High-touch, low-volume** vs SaaS norms: most users internal (~tens today, hundreds at scale), but investor-portal (P3) could add thousands of external principals.

### 6.3 Data residency & security
- **Primary storage in India** (Mumbai/AWS-ap-south-1 or equivalent India region) to satisfy DPDP localization expectations for personal data.
- Encryption at rest (AES-256) and in transit (TLS 1.2+); field-level encryption for sensitive PII (PAN, demat, KYC docs).
- Secrets management; no hard-coded credentials; least-privilege service accounts.
- **To confirm:** whether any client/investor data must never leave India (e.g., pension-fund/NRI data restrictions) — affects multi-region design.

### 6.4 Auditability
- Immutable, append-only audit log for all create/update/delete on regulated entities (clients, investors, mandates, KYC, consents, blotter).
- Every record carries created/modified by + timestamp + before/after delta.
- Audit log exportable to regulator-ready format (CSV/JSON + signed manifest).

### 6.5 Organizational constraint
- Small team (~6 SMEs + 2 directors) → CRM must reduce founder bottleneck, not add tooling overhead; UX must be low-friction for non-technical bankers; onboarding ≤ half-day per persona.

---

## 7. Non-Functional Requirements

### 7.1 Performance (at 10k+ scale, growing to 50k)
- Page load ≤2s p95 for 360° views; investor-match query ≤3s p95 across full investor book with multi-dimensional filters.
- Bulk import of 10k records ≤10 min with progress + error report.
- Audit log writes synchronous, non-blocking to user UX (queue + persist).

### 7.2 Role-Based Access Control (RBAC)
- Roles: Founder & Managing Partner (Shray), Managing Partner (Shahrukh), Director Credit Analysis & Risk (Rati), Coverage RM, Credit Analyst, Syndicate/Trader, Deal/Mandate, Compliance Officer, read-only Auditor, Admin.
- Field-level permissions (e.g., fee economics visible only to founders/partners; KYC docs visible to Compliance + assigned RM).
- Segregation of duties: Compliance cannot edit mandates; Traders cannot edit KYC; Credit cannot approve placement.
- Per-investor/issuer "team" assignment (who can see/edit this record).

### 7.3 Auditability
- See 6.4. Audit log retention ≥ longest applicable regulatory retention (**to confirm**, default 7 years).

### 7.4 Uptime & Availability
- Target 99.5% during business hours (Mon–Fri 9AM–6PM IST, the firm's stated hours) in MVP; 99.9% P2.
- Planned maintenance outside business hours only.

### 7.5 Backup & Disaster Recovery
- Daily automated backups; RPO ≤24h (MVP), ≤1h (P2); RTO ≤8h (MVP), ≤4h (P2).
- Off-region (within India) replicated backups; quarterly DR drill.
- Backup encryption; tested restore, not just backup.

### 7.6 Mobile
- **MVP:** responsive web (works on phone browser) for coverage RM on the road (last-touch logging, quick client lookup, KYC alerts).
- **P2:** native or PWA coverage app with offline-tolerant note capture and sync-on-reconnect.

### 7.7 Integrability
- REST/GraphQL API-first; webhooks for KYC-expiry, rating-action, settlement-status events.
- Integration points reserved for OMS, DP (CDSL/NSDL), market-data vendor, accounting/portfolio system, e-sign (for NDAs/engagement letters).

### 7.8 Observability
- App + audit logging to a centralized store; alerting on compliance-critical failures (e.g., KYC-block bypass attempt, audit-log write failure).

---

## 8. Assumptions & Dependencies

### 8.1 Assumptions
- **A1.** Operating entity is **Binary Capital Advisors LLP** (per Binary Bonds JSON-LD); Binary Bonds is a *division*, not a separate legal entity. CRM is single-tenant for one firm. (Confidence HIGH per business context; LLPIN/CIN **to confirm** via MCA.)
- **A2.** The firm's exact SEBI registration category (Merchant Banker / Stockbroker / Investment Adviser / NBFC) is **not disclosed**; CRM is built to support whichever applies, with regulator-category as a configurable field. **To confirm.**
- **A3.** Headcount today ~6–8; product must scale without rebuild. Brochure stats (6 SMEs, 2 directors) treated as closer to true than JSON-LD's 20–50.
- **A4.** 10,000+ relationships exist in extractable form (Excel/CRM-export/email) for migration; data quality is uneven → MVP includes a dedupe/enrich sprint.
- **A5.** Fee model is retainer + success fee (parent) and unspecified for bonds; CRM models fee as configurable (retainer, success, commission, spread, mgmt fee) per mandate.
- **A6.** Investors include institutional (primary) and HNI/IFA (retail "Buy Bonds" channel); MVP serves institutional + HNI via RM, retail self-service is P3.
- **A7.** Credit-analysis rating scales: CRISIL (AAA…D), ICRA ([ICRA]AAA…D), CARE (CARE AAA…D), India Ratings (IND AAA…D), Acuite (ACUITE AAA…D), Infomerics (AAA…D / Infomerics scale). CRM uses a normalized scale + per-agency notation.
- **A8.** Market microstructure references (BSE/NSE, ICCL, CCIL DVP, NDS-OM, CDSL/NSDL) are accurate per brochure; settlement is T+0/T+1 via ICCL as counterparty.

### 8.2 Dependencies
- **D1.** Compliance counsel sign-off on retention periods, DPDP consent wording, and data-localization scope (blocks M7/M8 finalization).
- **D2.** Founders/leadership confirm SEBI/RBI registration numbers and category (blocks regulator-facing exports).
- **D3.** Data migration source(s) identified and access granted (blocks G1).
- **D4.** India-region cloud account + KMS provisioned (blocks deployment).
- **D5.** Credit-team ratification of rating-scale mapping and credit-memo templates (blocks M3).
- **D6.** Existing OMS/accounting/portfolio system identified for P2/P3 integration scope.

---

## 9. Open Decisions / Open Questions

1. **Firm's SEBI registration category & number** (Merchant Banker Cat-I? Stockbroker on BSE/NSE debt segment? Investment Adviser? NBFC?) — determines which SEBI regulations govern record-keeping and which fields the CRM must capture. *To confirm with founders.*
2. **Exact SEBI/RBI record retention periods** applicable to this firm's activities (mandate records, placement records, blotter, KYC). *To confirm with compliance counsel.*
3. **DPDP data-localization scope:** is *all* personal data India-resident, or only sensitive categories? Do NRI/pension-fund investor records carry extra residency constraints? *To confirm.*
4. **Single-tenant vs multi-tenant:** assuming single-tenant for one LLP. If founders plan a separate subsidiary or a SaaS product spin-out, architecture changes. *To confirm strategic intent.*
5. **Hosting region/provider:** India region (e.g., AWS ap-south-1 / Azure Central India / GCP asia-south1) — confirm preferred vendor and any client-mandated restrictions.
6. **Build vs buy for credit-analysis/modeling engine:** buy a spreading/rating library vs build in-house. Buy accelerates MVP but may not match Indian agency nuances; build gives IP control. *Open.*
7. **OMS integration target in P2/P3:** which OMS does the trading desk use today? Currently undisclosed. *To confirm with Shray Vasudeva / syndicate desk.*
8. **Demat/DP integration depth:** MVP = manual status; P2 = read API; P3 = write/order flow. Confirm which DP(s) (CDSL/NSDL) and member relationships.
9. **Retail "Buy Bonds" channel regulatory status:** whether the firm is a SEBI-registered broker authorized on BSE/NSE debt segment for retail — affects whether P3 portal is even permissible. *To confirm.*
10. **Investor preference data sourcing:** how to populate investor mandate constraints (rating/tenor/sector/ticket) — manual RM entry vs ingestion from investor mandate letters vs inferred from trade history. *Open.*
11. **Credit memo / model IP ownership & confidentiality:** how are client models isolated from each other and from other analysts' views; how is export controlled. *Open — touches RBAC design.*
12. **Fee/economics visibility:** which roles see fee estimates and actuals. Assumed founders/partners only; *to confirm.*
13. **Data migration cut-over strategy:** big-bang vs phased by product line (e.g., Bonds first, then IB). *Open.*
14. **Naming reconciliation:** parent says "subsidiary," division says "division." CRM branding/branding-in-records — single brand "Binary Capital" with "Binary Bonds" as a product line tag? *Assume division/product-line tag; to confirm.*
15. **Aggregate-stat reconciliation** (₹2,000 Cr vs ₹5,000 Cr; **10,000+ total relationships (per client kickoff) vs 150+ investors vs 70+ orgs vs 100+ clients** — likely total book vs active/repeat; 100+ rating assignments vs 115+ transactions) — affects baseline KPIs and migration counts; *to confirm with founders before importing.*

---

*End of PRD v1.0. Next actions: (1) founders confirm open decisions #1–#4, #14–#15; (2) compliance counsel engagement for #2–#3; (3) data-migration source discovery for A4/D3; (4) architecture track produces the data model and integration blueprint from this PRD.*
