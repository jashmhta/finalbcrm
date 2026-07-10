# Binary Capital CRM

Building a CRM for our client **Binary Capital** (operating entity *Binary Capital Advisors LLP*, Mumbai) and its bond-markets division **Binary Bonds — A Division of Binary Capital** — one Indian investment-banking & financial-advisory firm and bond house. They have **10,000+ client relationships** (two-sided: issuers raising debt + institutional investors: banks, insurers, mutual funds, pension funds, AIFs, family offices, HNIs, NBFCs; plus intermediaries) and want CRM software that includes **credit analysis** and **financial modeling**. Regulatory frame: SEBI, RBI, FIMMDA, PMLA (KYC/AML), DPDP Act 2023 (data protection / localization).

## Repository layout

```
crm/
├── README.md                  ← this file (project orientation)
├── scrape/                    ← client research: full site mirrors + business context
│   ├── BUSINESS_CONTEXT.md    ← verified synthesis of what BC/BB do (the main client-research artifact)
│   ├── binarycapital.in/      ← complete wget mirror (pages, assets, fonts, chunks)
│   ├── binarybonds.in/        ← complete wget mirror (pages, assets, brochure PDF + text)
│   ├── text/                  ← clean per-page text extracts (analysis input)
│   ├── verify.sh, html2text.py← tooling
│   └── logs/
├── research/                  ← "CRM in finance" research report (landscape, vendors, India regs, build-vs-buy)
│   └── CRM_IN_FINANCE_RESEARCH.md
├── docs/                      ← product design (finance + tech expert)
│   ├── PRD.md                 ← product requirements (vision, personas, scope, MVP, constraints)
│   ├── DATA_MODEL.md          ← domain model, entities, ERD, 10k-scale design
│   ├── CREDIT_ANALYSIS_SPEC.md← ratios, scoring, Indian rating-scale mapping, PD/LGD, exposure
│   ├── FINANCIAL_MODELING_SPEC.md ← bond pricing, project finance/SPV, securitization, DCF
│   └── ARCHITECTURE.md        ← stack proposal, India data-residency, security, integrations
├── app/                      ← implementation (Next.js 16 App Router + Postgres + Drizzle + Auth.js v5 + shadcn/ui)
│   ├── src/db/schema/         ← 16 Drizzle modules — 42 tables, 67 enums (validated; migration in drizzle/)
│   ├── src/features/          ← {parties,deals,credit,modeling,compliance,interactions,documents,dashboard}
│   ├── src/components/ui/     ← shadcn/ui base components (button, card, table, dialog, …)
│   ├── src/db/index.ts        ← Drizzle (postgres-js) client
│   ├── drizzle/               ← generated migrations (0000_*.sql)
│   └── .env.example           ← integration + encryption env vars
```

## Client at a glance (from `scrape/BUSINESS_CONTEXT.md`)

- **What they do:** corporate bond underwriting; government securities (RBI auctions: G-Secs/SDL/T-Bills/Sovereign Gold Bonds); high-yield bonds; bond portfolio management; credit rating advisory (CRISIL/ICRA/CARE/India Ratings/Acuite/Infomerics); secondary-market trading & market-making (BSE/NSE, CCIL DVP, NDS-OM, CDSL/NSDL demat); plus M&A advisory, project finance (SPV/non-recourse), structured finance/securitization, supply-chain financing, equity & debt capital markets advisory.
- **People:** Shray Vasudeva (Founder & MD — both entities), Shahrukh Sheikh (Managing Partner, Binary Capital), Rati Ravi Kant (Director, Credit & Risk, Binary Bonds).
- **Contact:** Spaces Adani Height, Andheri West, Mumbai 400053 · +91 7738056127 / 7738192818 · sales@binarycapital.in · (brochure alt: 9920030739 / Enquiry@binarycapital.in).
- **Caveats:** no SEBI/RBI registration numbers disclosed; credibility stats conflict across web/JSON-LD/brochure (₹2,000 Cr vs ₹5,000 Cr vs 70+ orgs/115+ deals) — treat as self-asserted until corroborated via SEBI/MCA registers.

## Status

- ✅ Client research complete — both sites scraped & verified; `BUSINESS_CONTEXT.md` written and spot-checked against source HTML, JSON-LD, and the brochure PDF.
- ⏳ "CRM in finance" research in progress → `research/CRM_IN_FINANCE_RESEARCH.md`.
- ⏳ Product design in progress → `docs/*.md` (PRD, data model, credit-analysis spec, financial-modeling spec, architecture).
- 🚧 Implementation — **BEGUN**: Next.js 16 app scaffolded in `app/` (Drizzle + Postgres + Auth.js v5 + shadcn/ui). **Full Drizzle schema written & validated** (42 tables, 67 enums, migration generated). Next: auth + RBAC/RLS, server actions, first routes (after Next-16 bundled-docs review per `app/AGENTS.md`).

## How the pieces fit

`scrape/` tells us **who the client is** → `research/` tells us **what a finance CRM should be** (and the India compliance bar) → `docs/` designs **the CRM for this client** → `app/` builds it. Each stage is grounded in the one before.
