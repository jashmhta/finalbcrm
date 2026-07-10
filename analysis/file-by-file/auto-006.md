
# Batch 006

## `postcss.config.mjs`

- **Lines:** 7 | **Bytes:** 94
- **Kind:** Application module
- **Default export:** yes

## `scripts/_audit-set2.mjs`

- **Lines:** 103 | **Bytes:** 4297
- **Kind:** Ops/verification script
- **Security signals:** india-compliance
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** KYC, binarycapital, kyc

## `scripts/diag-css-links.mjs`

- **Lines:** 68 | **Bytes:** 3490
- **Kind:** Ops/verification script
- **Header intent:** Print the exact stylesheet <link> hrefs on /deals (authed, mobile) and their load status + the HTTP status when fetched directly. Then compare the same on /parties. Determines whether the "second CSS never loads" is a real broken/404 chunk or a puppeteer load race.
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital

## `scripts/diag-css-timing.mjs`

- **Lines:** 86 | **Bytes:** 4445
- **Kind:** Ops/verification script
- **Header intent:** Confirm whether the Tailwind stylesheet applies after enough wait time on /deals (the overflowing page). Polls nav.display + navLinksWrap.display + scrollWidth at 500/1500/3000/5000ms, and also waits for networkidle2 + the first <link rel=stylesheet> to load. If display flips to flex and scrollWidth drops to 390, the overflow was a pre-CSS measurement artifact.
- **DB ops patterns:** from
- **External deps:** node:fs, node:os, node:path, puppeteer-core
- **Domain terms:** BinaryCapital, binarycapital
