# Dogfood / multi-device browser test report

**Date:** 2026-07-09  
**Target:** `http://localhost:3000` (local Next 16 + Postgres)  
**Tool:** agent-browser (Chrome, `--no-sandbox`)  
**Login:** `shray@binarycapital.in` / `BinaryCrm!2026`

## Viewports tested

| Viewport | Size | Sessions |
|---|---|---|
| Desktop | 1440×900 | Login, Overview, Parties, Deals, Calendar, Notifications, Leads, Tasks, Interactions, Reports, Admin |
| Mobile | 390×844 | Overview, Parties, Calendar |

Screenshots: `app/dogfood-output/screenshots/`

## Results

### Pass
- Login page Stripe split layout renders correctly
- Auth works; redirect to `/parties`
- Sidebar IA complete including Calendar
- Parties list + preview pane with sample data
- Calendar month grid + agenda empty state
- Super-admin export CSV button visible
- Filters for turnover / sector / rating present (CEO requirements)
- Mobile bottom nav (Home / Parties / Deals / Credit / More)

### Issues found → fixed this session

| Issue | Severity | Fix |
|---|---|---|
| Greeting “shray.” lowercase | Medium | Capitalize first name; drop trailing period |
| Role subline generic | Low | “Super admin · Capital + Bonds” from brand scope |
| Parties filter stack (10 selects) fills mobile | High | Primary 5 filters + **More filters** disclosure |
| Parties page copy too long | Medium | Short description |
| Command bar heavy glass/shadow | Low | Solid surface + soft shadow |
| Session name = full email | Medium | Auth displayName from email local-part |

### Remaining / known

| Issue | Severity | Notes |
|---|---|---|
| Next.js dev “N” FAB overlaps mobile nav | Low | Dev-only; gone in production build |
| Sidebar very long (20+ items) | Medium | Consider groups / pin favorites later |
| Duplicate “New lead” CTA on dashboard (header + hero) | Low | Intentional shortcuts; could drop hero CTA |
| Empty charts / zero KPIs | Info | Expected with tiny seed (4 parties) |
| No e2e against Vercel prod | Blocked | No deploy credentials / wrong public URLs |

## Iterative UX improvements shipped

1. Collapsed advanced party filters  
2. Cleaner page headers  
3. Greeting + account naming  
4. Command bar calmer chrome  
5. Brand-aware admin subline  

## How to re-run

```bash
cd app
# ensure Postgres + .env.local
npm run dev -- --port 3000
export AGENT_BROWSER_ARGS="--no-sandbox,--disable-dev-shm-usage"
agent-browser --session desk open http://localhost:3000/login
# login, then screenshot routes at 1440×900 and 390×844
```
