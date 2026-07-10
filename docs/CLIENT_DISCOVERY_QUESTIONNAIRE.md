# Binary Capital CRM — Client Discovery Questionnaire

> Purpose: questions to answer *with* the client (Binary Capital / Binary Bonds) before finalizing scope, quote, and build plan. Grouped by theme. Each item says **why it matters** so the client understands the ask. Fill answers in the right column during the discovery call/meeting.
>
> Status: v1 — to be refined after the research, design, and compliance/feasibility reports land.

---

## 1. Firm & regulatory status (determines which compliance rules bind the CRM)

| # | Question | Why it matters |
|---|---|---|
| 1.1 | What is your exact SEBI registration — category **and** registration number? (Merchant Banker? Stock Broker — which segments? Investment Adviser? Portfolio Manager? Debenture Trustee?) | Each category imposes different record-keeping, KYC, and cyber obligations. Drives the compliance checklist. |
| 1.2 | Any RBI registration/licence? (NBFC? Authorized dealer? Anything for the G-Sec desk?) | Determines RBI circulars that apply (cyber, outsourcing, cloud). |
| 1.3 | Are you a member of BSE and/or NSE (debt/equity segment)? CCIL participant? Depository Participant with CDSL/NSDL? | Determines which exchange/clearing/depository APIs the CRM can integrate and what data you can pull. |
| 1.4 | Which KRA are you registered with for KYC (NDML/CAMS/Kfintech)? Do you use CKYCRegistry? | Drives the KYC-integration design and refresh workflow. |
| 1.5 | Is the firm a "Significant Data Fiduciary" under DPDP? (volume/sensitivity of personal data, turnover thresholds once Rules are notified) | Triggers extra duties (DPIA, audit, DPO). |
| 1.6 | Are there any open regulatory observations/audits relating to data, KYC, or cyber? | Surfaces compliance gaps the CRM must help close. |

## 2. Current state & data sources (where do the "10k clients" live today?)

| # | Question | Why it matters |
|---|---|---|
| 2.1 | Where are the 10,000+ client records today? (Excel sheets, Google Sheets, broker back-office, an existing CRM, email inboxes, WhatsApp, paper?) | Defines the migration plan, dedup effort, and import pipeline. |
| 2.2 | How many *distinct* records vs duplicates across sources? Best guess on dedup? | Sizing & data-quality scope. |
| 2.3 | What fields do you currently capture per client? (PAN, GSTIN, CIN/LLPIN, demat DP+client id, LEI, beneficial owner, KYC status, ratings, exposure…) | Maps to the data model; reveals gaps vs what compliance requires. |
| 2.4 | Do you already use any CRM/sales tool (Salesforce, Zoho, HubSpot, Dynamics, Navatar, DealCloud, in-house)? | Build-vs-buy decision: extend vs replace vs integrate. |
| 2.5 | What other systems must the CRM talk to? (back-office, accounting/Tally, Bloomberg/Refinitiv terminal, exchange terminals, rating-agency portals) | Integration scope & feasibility. |

## 3. Users & roles

| # | Question | Why it matters |
|---|---|---|
| 3.1 | How many CRM users, now and in 2 years? | Licensing/sizing (per-user pricing vs flat). |
| 3.2 | What roles? (coverage/relationship managers, credit analysts, bond traders/syndicate, deal/mandate team, compliance/KYC officer, founders/MD) | RBAC design & screens per persona. |
| 3.3 | Do founders/partners need dashboards/reporting distinct from operators? | Shapes analytics & permissions. |
| 3.4 | Mobile access needs (field coverage, on-the-go review)? | Mobile/responsive scope. |

## 4. Scope — which of your services must the CRM support?

| # | Question | Why it matters |
|---|---|---|
| 4.1 | Which deal/mandate types to manage? (corporate bond underwriting, G-Sec trading, rating advisory, M&A, project finance, structured finance/securitization, supply-chain finance, ECM/DCM) | Module scope; each has a different workflow. |
| 4.2 | Two-sided: do you track **both** issuers and investors? Are investors also clients (placement network)? | Core data model (party duality, allocations). |
| 4.3 | Investor allocation / order-book / IOI management — needed in v1 or later? | A bond-house-specific feature; sizable build. |
| 4.4 | Secondary-trading relationship tracking vs execution/OMS — where does the CRM boundary end? | Avoid rebuilding an OMS; CRM = relationships + deals, not execution. |
| 4.5 | Out of scope for v1? (e.g., full portfolio accounting, execution blotters, accounting/GL) | Keeps MVP lean. |

## 5. Credit analysis depth (core to rating advisory + high-yield)

| # | Question | Why it matters |
|---|---|---|
| 5.1 | Which financial ratios do you actually use today? Any internal scorecard? | Calibrates the ratio library & scorecard. |
| 5.2 | Which rating agencies do you work with, and do you need to map across their scales? | Rating-mapping module (CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics). |
| 5.3 | Do you estimate PD/LGD/EAD or expected credit loss? For whom (issuers? investor exposures?)? | IFRS-9/IRB-style features; may be optional for a non-bank. |
| 5.4 | How do you track counterparty exposure & limits today? Sector/issuer concentration limits? | Exposure & limit-management module. |
| 5.5 | Is there a credit-committee workflow (draft → review → committee → decision)? | Workflow design. |
| 5.6 | Where does financial-statement data come from? (MCA filings, company-provided, Bloomberg, rating rationales) | Data-source integration. |

## 6. Financial modeling needs

| # | Question | Why it matters |
|---|---|---|
| 6.1 | Which model types are must-have? (bond pricing, project finance/SPV, securitization, DCF/valuation, M&A/LBO) | Modeling module scope. |
| 6.2 | Do analysts live in Excel? Would they accept in-app lightweight calculators + Excel round-trip, or must heavy models stay in Excel with the CRM just storing outputs? | The key build-vs-lightweight decision for modeling. |
| 6.3 | Do you have standard model templates today? Version-control/audit pain? | Model-governance features. |
| 6.4 | Should the CRM link a deal/client to model files & key outputs (IRR, DSCR, price)? | Model registry design. |

## 7. Pipeline & activities

| # | Question | Why it matters |
|---|---|---|
| 7.1 | Define your mandate/deal lifecycle stages (e.g., lead → mandate → structuring → execution → closure → post-deal). | Pipeline schema & kanban. |
| 7.2 | How are interactions logged today? Capture email/calendar automatically (relationship intelligence) or manual? | Auto-capture scope (Gmail/Outlook integration effort). |
| 7.3 | Tasks/follow-ups & reminders — current pain? | Task module. |
| 7.4 | Document management — term sheets, offering docs, KYC, rating letters — storage & access control needs? | Doc store + classification + retention. |

## 8. Compliance needs (must align with research/compliance report)

| # | Question | Why it matters |
|---|---|---|
| 8.1 | KYC lifecycle: do you need the CRM to track CDD/EDD, beneficial ownership, PEP screening, sanctions screening, periodic refresh due dates? | PMLA compliance module. |
| 8.2 | Record-retention expectations (KYC 5 yr post-relationship, deal records, audit trail)? | Retention policy & immutable audit log. |
| 8.3 | Information barriers / Chinese walls (advisory vs trading) — do you need access segregation enforced? | RBAC/ABAC & info-barrier controls. |
| 8.4 | Consent management for investor/client personal data (DPDP) — do you have a consent process today? | Consent manager feature. |
| 8.5 | Breach-response process today? | Incident workflow in CRM. |

## 9. Integrations available to the firm

| # | Question | Why it matters |
|---|---|---|
| 9.1 | BSE/NSE API access — do you have member API credentials? | Feasibility of exchange data. |
| 9.2 | CDSL/NSDL — DP API access? | Demat data integration. |
| 9.3 | KRA/CKYC — API access or manual? | KYC automation. |
| 9.4 | Account Aggregator — do you want to use AA for consented financial-data fetch (credit analysis)? Are you registered as an FIU? | High-value credit-analysis data source. |
| 9.5 | Bloomberg/Refinitiv — do you have a licence/API access we can use? | Market data for bond pricing & credit. |
| 9.6 | Email/calendar platform (Google Workspace / Microsoft 365)? | Relationship-intelligence integration. |
| 9.7 | WhatsApp Business for sales — in use? | Communication capture. |

## 10. Non-functional & project

| # | Question | Why it matters |
|---|---|---|
| 10.1 | Expected concurrent users / peak load? | Performance & infra sizing. |
| 10.2 | Uptime/availability SLA expectation? | Hosting & SLA terms. |
| 10.3 | Data residency — must all data stay in India? (DPDP/SEBI cloud framework) | Hosting decision (India region). |
| 10.4 | Budget range (one-time build + ongoing)? | Build-vs-buy & phasing. |
| 10.5 | Target timeline / go-live? | Phasing & MVP cut. |
| 10.6 | Who on your side is the product owner / decision-maker? | Engagement governance. |
| 10.7 | Success criteria — what does "this CRM works" look like in 6 months? | Acceptance & metrics. |

## 11. MVP prioritization (force-rank)

Ask the client to rank each candidate module **P0 (must, MVP) / P1 (phase 2) / P2 (later)**:
- [ ] Client & contact DB (issuers + investors + intermediaries)
- [ ] Deal/mandate pipeline
- [ ] Interactions + tasks + documents
- [ ] Credit analysis (ratios, scoring, rating mapping)
- [ ] Financial modeling (bond pricing / project finance / securitization / DCF)
- [ ] Exposure & credit limits
- [ ] KYC lifecycle & screening (PMLA)
- [ ] Consent management (DPDP)
- [ ] Investor order book / allocations (bond-specific)
- [ ] Dashboards & reporting
- [ ] Integrations (BSE/NSE, CDSL/NSDL, KRA, AA, Bloomberg)

## 12. Open questions to resolve before quoting

- Confirm SEBI category & registration number (1.1) — gates the compliance scope.
- Confirm where the 10k records live and their shape (2.1–2.3) — gates migration effort & quote.
- Confirm budget & timeline (10.4–10.5) — gates build-vs-buy and phasing.
- Confirm whether Bloomberg/Refinitiv + exchange/DP/KRA/AA access is available (9.x) — gates integration feasibility.
- Confirm MVP P0 set (§11) — gates the quote & roadmap.
