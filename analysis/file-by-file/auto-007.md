
# Batch 007

## `scripts/diag-nav.mjs`

- **Lines:** 96 | **Bytes:** 5141
- **Kind:** Ops/verification script
- **Header intent:** Focused diagnostic: on one overflowing page (/deals) and one clean page (/parties), report the desktop nav container's computed display, a sample desktop nav link's computed display + rect, and the single widest element (max right edge) with its ancestor chain. Tells us WHY scrollWidth=638 on deals but 390 on parties despite the same SiteNav component.
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/diag-theme-logo.mjs`

- **Lines:** 60 | **Bytes:** 3038
- **Kind:** Ops/verification script
- **Header intent:** Directly verify the theme toggle flips html.dark and the nav logo <img> renders on an authed page — with a post-click wait (next-themes updates the class via an effect, so the verifier's instant check can false-negative).
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/mobile-overflow-all.mjs`

- **Lines:** 131 | **Bytes:** 7532
- **Kind:** Ops/verification script
- **Header intent:** All-routes mobile overflow audit: every user-facing route at 390px, confirm 200 + no document-level horizontal overflow (scrollWidth <= viewport), and for any element whose right edge exceeds the viewport, report whether it is INSIDE an overflow-clipped (overflow-x:auto/hidden/scroll) ancestor — i.e. a contained scrollable region (fine) vs a true page overflow (bug).
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, kyc, party

## `scripts/mobile-pass.mjs`

- **Lines:** 223 | **Bytes:** 9989
- **Kind:** Ops/verification script
- **Header intent:** Mobile excellence pass: capture 390x844 screenshots for the required route set AND measure horizontal overflow (document.scrollWidth vs viewport) + flag elements wider than 390px. Logs in first via the form, driving the AUTH_URL host so the next-auth session cookie domain matches the proxy redirects (see scripts/screenshot.mjs for the rationale).
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, kyc
