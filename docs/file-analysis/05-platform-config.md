# 05 — Platform & Config

Auth.js, RBAC, Next proxy, package/tsconfig/eslint/Dockerfile, and a few legacy root paths.

## File inventory

_22 files · 1,123 lines_

### Domain: `app`

PRD: **Cross-cutting / Supporting**

#### `app/.github/workflows/ci.yml`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 79 |
| Runtime | n/a |
| Uses DB | Y |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | CI — Binary Capital CRM (Track B: production readiness)  Pipeline: install → lint → typecheck → build → test (vitest) → drizzle-kit generate check (migration drift).  Keeps `next build` clean and prevents schema/migration drift before any deploy to the India-hosted paths (Vercel bom1 / ap-south-1 containers). ARCHITECTURE.md §2.3 + §10 (environments parity). |

#### `app/Dockerfile`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 89 |
| Runtime | n/a |
| Uses DB | Y |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | syntax=docker/dockerfile:1.7  Production image for the India-hosted Path 2 (ARCHITECTURE.md §2.3): AWS App Runner / ECS Fargate / EKS in ap-south-1 (Mumbai), or Azure Container Apps in West India (Pune).  Runs the SAME Next.js app as the Vercel `bom1` path — `next start` (Node server) supports every Next 16 feature (Server Components, Server Actions, Proxy/Middleware, PPR, `after()`). Hosting-port |

#### `app/components.json`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 25 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Build, lint, deploy configuration |

#### `app/drizzle.config.ts`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 12 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Build, lint, deploy configuration |

#### `app/eslint.config.mjs`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 36 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Build, lint, deploy configuration |

#### `app/next-env.d.ts`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 6 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | / <reference types="next" /> / <reference types="next/image-types/global" /> |

#### `app/next.config.ts`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 28 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Build, lint, deploy configuration |

#### `app/package.json`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 56 |
| Runtime | n/a |
| Uses DB | Y |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Build, lint, deploy configuration |

#### `app/postcss.config.mjs`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 7 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Build, lint, deploy configuration |

#### `app/tsconfig.json`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 34 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Build, lint, deploy configuration |

#### `app/vercel.ts`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 55 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | config |
| Has TODO | N |
| Purpose | Vercel project configuration — Path 1a (India residency, Mumbai). Programmatic equivalent of vercel.json (Vercel reads the `config` export at build time). See https://vercel.com/docs/project-configuration/vercel-ts. Hosting posture (ARCHITECTURE.md §2.3): - Fluid Compute is pinned to `bom1` (Mumbai, ap-south-1) so primary processing of PII / MNPI stays in-region (DPDP Act 2023 + SEBI Cloud Framewo |

#### `app/vitest.config.ts`

| Field | Value |
|---|---|
| Role | `config` — Build, lint, deploy configuration |
| LOC | 36 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (0) | — |
| Has TODO | N |
| Purpose | Vitest configuration — Track B (TESTS).  Scope: pure library units under src/__tests__/. The financial engines (bondPricing, ratios, scorecard, ratingMap static mapping) are deterministic and side-effect free, so they run in the node environment without a database or a running Next server. The route smoke test is opt-in via SMOKE_BASE_URL (it fetches a live server) and self-skips otherwise, so `vi |

### Domain: `auth-gate`

PRD: **Security Auth**

#### `app/src/proxy.ts`

| Field | Value |
|---|---|
| Role | `proxy-middleware` — Next 16 request proxy (auth gate) |
| LOC | 56 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | critical |
| Exports (1) | config |
| Has TODO | N |
| Purpose | Next.js 16 Proxy - the renamed, Node.js-runtime successor to `middleware.ts`. See node_modules/next/dist/docs/01-app/.../proxy.md: "Starting with Next.js 16, Middleware is now called Proxy." The file convention is `proxy.ts` at the same level as `app/` (i.e. in `src/` for this project), and the exported function is `proxy` (named) or a default export.  RESPONSIBILITY: COARSE auth only - redirect u |

### Domain: `auth-rbac`

PRD: **Security RBAC**

#### `app/src/lib/.gitkeep`

| Field | Value |
|---|---|
| Role | `library` — Shared platform library (auth/rbac/utils) |
| LOC | 1 |
| Runtime | n/a |
| Uses DB | N |
| Maturity | supporting |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | N |
| Purpose | lib — placeholder. Implementation after design docs finalized. |

#### `app/src/lib/auth.ts`

| Field | Value |
|---|---|
| Role | `library` — Shared platform library (auth/rbac/utils) |
| LOC | 271 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented+TODO |
| Criticality | critical |
| Exports (0) | — |
| Has TODO | Y |
| Purpose | Auth.js v5 configuration (next-auth@5.0.0-beta.31) with the Drizzle adapter.  SESSION STRATEGY: JWT (this initial build). PRODUCTION TARGET: DB-stored sessions mirrored to in-region Redis (ElastiCache ap-south-1) so sessions are revocable at the edge (ARCHITECTURE §4.7). The adapter + `sessions` table are wired here so the cutover is `session: { strategy: "database" }` plus a Redis cache, not a re |

#### `app/src/lib/rbac-core.ts`

| Field | Value |
|---|---|
| Role | `library` — Shared platform library (auth/rbac/utils) |
| LOC | 17 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | critical |
| Exports (2) | RbacSubject, can |
| Has TODO | N |
| Purpose | Exports: RbacSubject, can |

#### `app/src/lib/rbac.ts`

| Field | Value |
|---|---|
| Role | `library` — Shared platform library (auth/rbac/utils) |
| LOC | 106 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | critical |
| Exports (3) | CrmUser, getCurrentUser, requireUser |
| Has TODO | N |
| Purpose | RBAC helper + server-side current-user loader.  DATA_MODEL §2.8, §2.23.12 + ARCHITECTURE §4.2. Permission codes are resource-action pairs (e.g. `party:create`, `deal:create`, `kyc:approve`, `credit_score:override`, `party:merge`) stored on the `permission` table and granted to roles via `role_permission`. A user's EFFECTIVE permissions are the union over their active (valid_to IS NULL) `user_role` |

#### `app/src/lib/utils.ts`

| Field | Value |
|---|---|
| Role | `library` — Shared platform library (auth/rbac/utils) |
| LOC | 6 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | critical |
| Exports (1) | cn |
| Has TODO | N |
| Purpose | Exports: cn |

### Domain: `login-duplicate`

PRD: **Cross-cutting / Supporting**

#### `app/login/actions.ts`

| Field | Value |
|---|---|
| Role | `legacy-route` — Legacy/duplicate path outside src/app |
| LOC | 36 |
| Runtime | server |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (2) | LoginState, login |
| Has TODO | N |
| Purpose | Exports: LoginState, login |

#### `app/login/login-form.tsx`

| Field | Value |
|---|---|
| Role | `legacy-route` — Legacy/duplicate path outside src/app |
| LOC | 54 |
| Runtime | client |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | LoginForm |
| Has TODO | N |
| Purpose | Exports: LoginForm |

#### `app/login/page.tsx`

| Field | Value |
|---|---|
| Role | `legacy-route` — Legacy/duplicate path outside src/app |
| LOC | 26 |
| Runtime | rsc/shared |
| Uses DB | N |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | metadata |
| Has TODO | N |
| Purpose | Exports: metadata |

### Domain: `root-duplicate`

PRD: **Cross-cutting / Supporting**

#### `app/page.tsx`

| Field | Value |
|---|---|
| Role | `legacy-route` — Legacy/duplicate path outside src/app |
| LOC | 87 |
| Runtime | rsc/shared |
| Uses DB | Y |
| Maturity | implemented |
| Criticality | medium |
| Exports (1) | dynamic |
| Has TODO | N |
| Purpose | Exports: dynamic |
