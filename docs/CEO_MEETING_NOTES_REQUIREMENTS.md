# CEO Meeting Notes → CRM Requirements

**Source:** Notes taken during the meet with the CEO (Binary Capital).  
**People named:** Shray, Shahrukh, Rati, Niraj, Yash, Pranjali, Tashmit.  
**Purpose:** Capture spoken requirements cleanly, map them to product modules, and show what the codebase already implements vs what still needs confirmation/work.

---

## 0. Org / RBAC roster (confirmed from CEO notes)

### Super admins (export + full book + assign / merge)

| Person | Brand / desk scope | CRM role to provision | Notes |
|---|---|---|---|
| **Shray Vasudeva** | **Both** Binary Capital **and** Binary Bonds | `super_admin` (firm-wide) | Founder; only firm-wide super admin spanning both brands |
| **Shahrukh Sheikh** | **Binary Capital** only | `super_admin` scoped to Capital **or** Capital admin with export | Capital / IB side leadership |
| **Rati Ravi Kant** | **Binary Bonds** only | `super_admin` scoped to Bonds **or** Bonds admin with export | Credit & Risk / Bonds leadership |
| **Niraj** | **Binary Bonds** only | `super_admin` (Bonds) | Bonds-side super admin |

> **Export rule (CEO):** CSV / bulk export is **super-admin only**. In code today that is the `super_admin` role (`canUseCsvExport`). When seeding users, grant `super_admin` only to the four people above (with brand scope if/when multi-brand ABAC is enforced).

### Employees (RBAC-segregated book; no export)

| Person | Brand / desk | Role | Book / modules |
|---|---|---|---|
| **Yash** | Binary Capital | Employee (coverage RM) | ~50k companies; Leads, RCD, Interactions; assigned-party only |
| **Pranjali** | Binary Capital | Employee | Capital staff; assigned data + day-to-day CRM (not super admin) |
| **Tashmit** | Binary Bonds | Employee | ~10k bond investor book; Interactions + investor filters; assigned-party only |

### How this maps in the product

```
                    ┌─────────────────────────────────────┐
                    │  Shray — super_admin (BOTH brands)  │
                    └──────────────┬──────────────────────┘
           ┌───────────────────────┴───────────────────────┐
           ▼                                               ▼
 ┌─────────────────────┐                         ┌─────────────────────┐
 │  BINARY CAPITAL     │                         │  BINARY BONDS       │
 │  Super: Shahrukh    │                         │  Super: Rati, Niraj │
 │  Employees:         │                         │  Employees:         │
 │    Yash, Pranjali   │                         │    Tashmit          │
 └─────────────────────┘                         └─────────────────────┘
```

| Capability | Super admin (Shray / Shahrukh* / Rati* / Niraj*) | Employee (Yash / Pranjali / Tashmit) |
|---|---|---|
| See full firm (or brand) book | Yes | No — only `assigned_user_id` / `data_owner_user_id` |
| CSV / bulk export | **Yes** | **No** |
| Assign party to another staff | Yes | Confirm policy (often yes within own brand) |
| Merge duplicates | Yes | No (or request-only) |
| Leads / interactions / deals | Yes | Yes (scoped) |
| Credit analysis | Per firm policy (“inactive” note) | Per firm policy |

\*If product later enforces **brand-scoped** super admin: Shahrukh cannot export Bonds-only data; Rati/Niraj cannot export Capital-only data; Shray can both. Today’s code treats `super_admin` as global — brand scope is a follow-on if required.

---

## 1. Clean transcript of the notes

### 1.1 Yash — corporate / company book (~50k)

- Scale target: **~50,000 companies**.
- **RBAC segregation** so Yash only sees his book / his assigned data.
- **Filters** on the company list:
  - Rated (has a rating / rating filter)
  - **Turnover bands (₹ Cr):** ≤50 · 50–75 · 75–100 · 100–150 · 150–175 · 175–200 · 200–300 · 300–500 · 500–750 · 750–1,000 · **1,000+**
  - **Industry sector**
  - **Rating agency**
  - Credit agency example: **CRISIL**, rating **BBB**, **which year**, **rating headers**
- Yash’s modules / ownership: **Leads**, **RCD** (relationship / contact / desk coverage — confirm exact acronym with team), **Interactions**.

### 1.2 Industry sectors called out

- Infra  
- Fintech  
- EPC  
- Roads  
- Buildings  
- Manufacturing (sub-type: “manufacturing of what”)  
- Textiles  
- OEM  
- Plastics  
- Recycled (plastics)  

### 1.3 Bonds desk — Tashmit — investor book (~10k)

- Scale: **~10,000** investor / bond-book records.
- **Same RBAC** pattern as Yash (only own / assigned data).
- **Interactions** in scope for Bonds too.
- **Filters:**
  - Portfolio size  
  - Investor type  
  - Equity PMS · Mutual funds · Bonds (and related types)  
  - Bond rating band **BBB → AAA**  
  - Risk-bearing capacity / risk appetite  
  - **High-yield risk appetite** of clients  
  - **Existing sale of securities** with details  

### 1.4 Cross-desk / ops

| Area | Note |
|---|---|
| **Credit analysis** | “Inactive” (see open questions — disabled for some roles vs product not primary for go-live) |
| **Operations** | **Deals** |
| Staff called | **Pranjali**, **Yash**, **RN** (Binary Capital) |

### 1.5 Platform features the CEO asked for

1. **Assign data to another staff** (reassign parties / book ownership).  
2. **Export only for super admin**.  
3. **Duplication detection**.  
4. **Notifications**.  
5. Capture and **assign these meeting notes** into the product requirements track (this document).

---

## 2. People → product ownership (working model)

| Person | Level | Brand | Book | Primary modules | Filter focus |
|---|---|---|---|---|---|
| **Shray** | Super admin | Capital **+** Bonds | Full firm | Admin, export, assign, merge | Unrestricted |
| **Shahrukh** | Super admin | **Capital** | Capital book | Admin / export (Capital) | Capital-wide |
| **Rati** | Super admin | **Bonds** | Bonds book | Admin / export (Bonds), credit policy | Bonds-wide |
| **Niraj** | Super admin | **Bonds** | Bonds book | Admin / export (Bonds) | Bonds-wide |
| **Yash** | Employee | Capital | ~50k companies (assigned) | Leads, RCD, Interactions | Turnover, sector, rating, agency, year |
| **Pranjali** | Employee | Capital | Assigned Capital parties | Day-to-day CRM, ops support | Same family as Yash when on companies |
| **Tashmit** | Employee | Bonds | ~10k investors (assigned) | Interactions, investor 360, matching | Investor type, portfolio, rating, risk, HY, securities |
| **Operations** | Function | Both | Mandates | **Deals** | Pipeline stages |
| **Credit analysis** | Function | Bonds-led | Analyses | Credit module — marked **inactive** pending policy | — |

> **RCD** was spoken as “RCD” in notes — not expanded. Treat as **relationship / contact / coverage desk** until Binary confirms the acronym.

Also update open actions:

- Provision users: **Shray, Shahrukh, Rati, Niraj** → `super_admin` (brand scope TBD); **Yash, Pranjali, Tashmit** → employee roles without export.
- Remove earlier “RN” as undefined staff unless Binary re-confirms a person named RN.

---

## 3. Filter taxonomies (CEO-aligned)

### 3.1 Turnover (issuer / company) — ₹ Cr

| Band code (system) | Label |
|---|---|
| `lt_50` | ≤ 50 |
| `50_75` | 50–75 |
| `75_100` | 75–100 |
| `100_150` | 100–150 |
| `150_175` | 150–175 |
| `175_200` | 175–200 |
| `200_300` | 200–300 |
| `300_500` | 300–500 |
| `500_750` | 500–750 |
| `750_1000` | 750–1,000 |
| `gt_1000` | **1,000+** |

### 3.2 Industry sectors (as named + system extras)

CEO-named: infra, fintech, EPC, roads, buildings, manufacturing (+ subsector text), textiles, OEM, plastics, recycled plastics.  

Also in system today: NBFC, real estate, renewables, logistics, healthcare, education, consumer, other.

### 3.3 Rating filters

- Agency: CRISIL, ICRA, CARE, India Ratings, Acuite, Infomerics, Brickwork  
- Symbol: AAA … BB- (includes **BBB** band)  
- **Year** of rating  
- **Rating header** text field (display of full rating line / rationale header)

### 3.4 Investor filters (Bonds / Tashmit)

| Dimension | Values |
|---|---|
| Investor type | Equity PMS, Mutual fund, Bond investor, AIF, Family office, HNI, Insurance, Bank treasury, Corporate treasury, Pension fund |
| Portfolio size | ≤50 · 50–100 · 100–250 · 250–500 · 500–1,000 · 1,000+ Cr |
| Risk appetite | Low · Moderate · High · **High yield** |
| Bond rating focus | BBB → AAA band |
| High-yield appetite | Boolean flag |
| Existing securities | Free-text / notes field for current holdings / sales |

---

## 4. Requirement → codebase status

| # | CEO requirement | Status in app today | Where |
|---|---|---|---|
| R1 | Turnover band filters (≤50 … 1000+) | **Done** | `src/features/parties/segmentation.ts`, party columns, party list filters |
| R2 | Industry sector filters (infra, fintech, EPC, …) | **Done** (+ manufacturing subsector text) | same + `party.industry_sector` / `industry_subsector` |
| R3 | Rating + agency + year + rating header | **Done** (schema + filters) | `party.latest_rating*`, list filters `rating` / `agency` / `ratingYear` |
| R4 | Investor type (Equity PMS, MF, Bonds…) | **Done** | `INVESTOR_TYPES` + `party.investor_type` |
| R5 | Portfolio size filters | **Done** | `PORTFOLIO_SIZE_BANDS` + filters |
| R6 | Risk appetite + high-yield appetite | **Done** | `risk_appetite`, `high_yield_appetite` |
| R7 | Existing sale / securities details | **Done (field)** | `party.existing_securities_note` |
| R8 | RBAC segregation by assignee / owner | **Done (app-layer scoping)** | `assigned_user_id` / `data_owner_user_id` on party; queries scope non-admins |
| R9 | Assign data to another staff | **Partial / verify UI** | columns + filters exist; confirm reassignment UI action is complete for operators |
| R10 | Export only super admin | **Done** | `canUseCsvExport` → `super_admin` only |
| R11 | Duplication detection | **Done** | `party_duplicate_candidate` + import queue + notifications |
| R12 | Notifications | **Done** | workflow engine (KYC, stuck deals, duplicates, tasks…) |
| R13 | Yash: Leads + Interactions | **Done (modules)** | `/leads`, `/interactions` |
| R14 | Tashmit: Bonds book + interactions + filters | **Done (data model + filters)** | party investor fields + matching |
| R15 | Operations = Deals | **Done** | `/deals` |
| R16 | Credit analysis inactive | **Policy / config — confirm** | module exists at `/credit`; “inactive” may mean hide from some roles or deprioritize in go-live |
| R17 | 50k companies capacity | **Designed for 10k–50k** | indexes + seed-scale path; need real 50k load + import run |
| R18 | 10k bonds investor data | **Designed + import tooling** | `import-parties.ts`, sample CSVs; need Tashmit’s real file |
| R19 | Named staff users (Yash, Tashmit, Pranjali, RN) | **Client data** | seed admin exists; real users must be provisioned with roles + assigned books |

Legend: **Done** = present in code · **Partial** = schema/API yes, UX/ops may need polish · **Confirm** = product decision · **Client data** = not a code gap.

---

## 5. Open questions for Binary Capital (close these next)

1. **RCD** — exact expansion and which screens count as RCD?  
2. **Credit analysis “inactive”** — hide module for everyone, only for coverage roles, or just “not primary this phase”?  
3. **Yash vs Tashmit books** — pure party-type split (issuer vs investor) or also brand (`binarycapital` / `binarybonds`)?  
4. **50k source file** — format, columns, owner of import (vendor vs Binary ops)?  
5. **10k bonds source** — same questions for Tashmit’s file.  
6. **Reassign workflow** — any approval needed when Yash reassigns a company to Pranjali/RN, or free reassignment?  
7. **“Rated” filter** — means “has any rating” only, or “investment-grade only (BBB+ and above)”?

---

## 6. Recommended next actions (engineering + ops)

| Priority | Action | Owner |
|---|---|---|
| P0 | Provision real users: Yash, Tashmit, Pranjali, RN + roles | Binary + vendor admin |
| P0 | Assign each party to correct `assigned_user_id` on import | Vendor import + Binary |
| P0 | Confirm credit module visibility policy | CEO / Rati |
| P1 | Verify assign-to-staff UX end-to-end on `/parties` | Vendor |
| P1 | Import pilot: 1k Yash companies + 1k Tashmit investors with filters demo | Vendor + Yash/Tashmit |
| P2 | Load test toward 50k with indexes + list latency budget | Vendor |
| P2 | Super-admin export dry-run (who is super_admin in prod) | Binary |

---

## 7. One-line product statement from this meeting

> Binary Capital needs **role-segregated books** (Yash on companies with turnover/sector/rating filters; Tashmit on bond investors with portfolio/type/risk/HY filters), **shared interactions**, **deals for ops**, **assign-to-staff**, **super-admin-only export**, **duplicate detection + notifications** — credit analysis currently treated as inactive pending policy.

---

*Document created from CEO-meeting notes so the team has a single written source of truth. Update §5 answers as Binary confirms.*

---

## 8. Implementation log (2026-07)

### UI redesign (Stripe-level day theme)
- `app/src/app/globals.css` - cool slate canvas `#f6f9fc`, navy text `#0a2540`, primary accent Stripe indigo `#635bff` (token still named `--gold` for compatibility)
- Cards simplified to single white surface + hairline (no double-bezel / mesh / grain)
- Buttons: 6px radius, solid primary
- Shell: solid sidebar, snappier page transitions
- Login: navy brand panel + clean form
- Page shell utilities: `.bc-page`, `.bc-page-title`, `.bc-page-subtitle`

### Calendar + notifications
- New route `/calendar` - month grid + agenda (tasks, interactions, re-KYC, deal targets)
- Nav entry under primary IA
- Notifications page links to calendar; uses same page shell

### Org users seed
- `app/src/db/seed-org-users.ts`
- Super admins: Shray, Shahrukh, Rati, Niraj
- Employees: Yash, Pranjali, Tashmit
- Default password: `BinaryCrm!2026` (override with `SEED_ORG_PASSWORD`)
- Run: `npx tsx src/db/seed-org-users.ts` from `app/`
