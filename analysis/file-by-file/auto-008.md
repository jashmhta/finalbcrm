
# Batch 008

## `scripts/screenshot.mjs`

- **Lines:** 209 | **Bytes:** 9889
- **Kind:** Ops/verification script
- **Security signals:** rbac/rls, india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, credit_analysis, kyc, party, scorecard

## `scripts/verify-logo-theme.mjs`

- **Lines:** 101 | **Bytes:** 4963
- **Kind:** Ops/verification script
- **Header intent:** Focused check: (a) the real BC logo renders in the nav AND login (detect via the bundled static-media logo filename in the page HTML, regardless of the /_next/image wrapper), (b) the theme toggle actually flips html.dark after allowing React's re-render tick. Login uses the AUTH_URL host.
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/verify-routes.mjs`

- **Lines:** 194 | **Bytes:** 9201
- **Kind:** Ops/verification script
- **Header intent:** Step 5 verification: log in, extract the session cookie, then fetch every user-facing route (authed) and confirm 200 + real content (not redirected to /login, not a thin/empty/404). Also confirms the real BC logo renders in nav + login + favicon, and the theme toggle is present. Uses the AUTH_URL host so the session cookie domain matches (see scripts/screenshot.mjs for why).
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital, bond, kyc, party

## `scripts/verify.mjs`

- **Lines:** 134 | **Bytes:** 6313
- **Kind:** Ops/verification script
- **Header intent:** Verify the previously-broken screens render real data by logging in and dumping key text content from each page. More reliable than screenshots for confirming no NaN/undefined and real rows.
- **DB ops patterns:** from
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** binarycapital, party
