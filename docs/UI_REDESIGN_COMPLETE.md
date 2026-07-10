# UI redesign — complete system pass

## Design system (Stripe-level day)

| Token | Value |
|---|---|
| Canvas | `#f6f9fc` |
| Surface | `#ffffff` |
| Text | `#0a2540` |
| Accent (token `--gold`) | `#635bff` indigo |
| Radius | 8px (`0.5rem`) default |
| Type | Geist Sans + Geist Mono only |

## Primitives updated

- `card` — single surface, hairline, soft shadow  
- `button` — 6px radius solid primary  
- `badge` — rounded-md chips, not uppercase pills  
- `table` — quiet sticky header, no gold row accents  
- `text` / `PageHeader` / `SectionHeading` — product titles, no serif  
- `empty-state` — compact product empty  
- `stat-card` — tight KPI tiles  
- `input` — Stripe-like field  
- `preview-pane` — dense identity header  
- `chart-theme` ChartCard — clean headers  

## Shell

- Root layout: light-only, no mesh/noise  
- SiteNav: solid sidebar, Binary CRM mark, filtered credit for employees  
- Login: navy brand panel + form card  
- Page utility: `.bc-page`  

## Screens

- All major list routes use `bc-page` shell  
- Dashboard uses product Overview header (no “Desk command” editorial)  
- Ambient halos removed app-wide  
- `font-display` / Fraunces usage stripped from components  

## Verification

- `tsc --noEmit` clean  
- Unit tests green  

## Intentionally deferred

- Pixel-perfect rewrite of every filter dialog / kanban card micro-layout  
- Chart color series re-theme beyond token inheritance  
- Mobile bottom-nav icon redesign (structure kept; colors inherit)  
