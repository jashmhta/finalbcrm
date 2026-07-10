# Deploy finalbcrm (Vercel + Neon)

## Live

- **App:** https://finalbcrm.vercel.app  
- **GitHub:** https://github.com/jashmhta/finalbcrm  
- **Vercel project:** `finalbcrm` (team jashs-projects-f1ef9b91)  
- **Root directory:** `app`

## 1) Neon Postgres (required for data)

Marketplace install (recommended):

1. Open https://vercel.com/jashs-projects-f1ef9b91/finalbcrm/stores  
2. **Create Database → Neon** (or Marketplace → Neon → Install)  
3. Connect the store to project `finalbcrm` for **Production + Preview**  
4. Confirm `DATABASE_URL` (and optional `DATABASE_URL_UNPOOLED`) appear under Project → Settings → Environment Variables  

CLI (after Neon account exists):

```bash
npx neonctl auth
npx neonctl projects create --name finalbcrm --region aws-ap-south-1
npx neonctl connection-string --project-id <id> --pooled
# paste into Vercel env as DATABASE_URL
```

## 2) Bootstrap schema + users

With `DATABASE_URL` set (local pull or direct):

```bash
cd app
vercel env pull .env.local
npx tsx scripts/vercel-bootstrap-db.ts
# or: npx drizzle-kit push && npx tsx src/db/seed-org-users.ts
```

Default login after seed:

- **Email:** `shray@binarycapital.in`  
- **Password:** `BinaryCrm!2026`  
- Rotate passwords after first login.

## 3) Required env vars

| Key | Notes |
|-----|--------|
| `DATABASE_URL` | Neon pooled connection string |
| `AUTH_SECRET` | Already set on Vercel |
| `AUTH_URL` | `https://finalbcrm.vercel.app` |
| `AUTH_TRUST_HOST` | `true` |
| `USE_MOCK_INTEGRATIONS` | `true` for demo integrations |

## 4) Redeploy after env changes

```bash
cd app
export VERCEL_TOKEN=…
vercel deploy --prod -y
# or: git push → auto deploy from main
```

## Superadmin features on production

- **Settings** `/console/settings` — password-gated edit/delete client + clear mock/scale/all  
- **Search** `/console/search` + ⌘K command palette live search  
- **Reports** organized CSV export packs  
- **Import** `/console/parties/import` with templates  
