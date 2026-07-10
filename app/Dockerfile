# syntax=docker/dockerfile:1.7
#
# Production image for the India-hosted Path 2 (ARCHITECTURE.md §2.3):
#   AWS App Runner / ECS Fargate / EKS in ap-south-1 (Mumbai), or
#   Azure Container Apps in West India (Pune).
#
# Runs the SAME Next.js app as the Vercel `bom1` path — `next start` (Node
# server) supports every Next 16 feature (Server Components, Server Actions,
# Proxy/Middleware, PPR, `after()`). Hosting-portable: no Vercel-only
# primitives in the hot path. Regulated data stays on Aurora/RDS ap-south-1.
#
# Build:  docker build -t binary-crm:latest .
# Migrate (one-off, uses the build stage which has drizzle-kit):
#   docker build --target build -t binary-crm:migrate .
#   docker run --rm --env-file .env.production binary-crm:migrate npx drizzle-kit migrate
# Run:    docker run --rm -p 3000:3000 --env-file .env.production binary-crm:latest
#
# See scripts/deploy.sh for the full build → migrate → start orchestration.

ARG NODE_VERSION=20.19.0

################################################################################
# 1. deps — full dependency install (cached layer, reused by build)
################################################################################
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
# libc6-compat: native modules (bcryptjs, postgres-js native bits).
# openssl: required by the Next.js build toolchain.
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
# Full install (incl. devDeps) — needed for `next build` and drizzle-kit.
RUN npm ci

################################################################################
# 2. build — compile the Next.js app
################################################################################
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time only. Runtime secrets (DATABASE_URL, AUTH_SECRET, FIELD_ENC_KEY,
# integration keys) are injected at `docker run` via --env-file, never baked.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

################################################################################
# 3. prod-deps — production-only dependency tree for the slim runtime
################################################################################
FROM node:${NODE_VERSION}-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

################################################################################
# 4. runtime — slim, non-root, graceful-shutdown-capable
################################################################################
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache --no-progress libc6-compat openssl tini \
    && addgroup -S nodejs \
    && adduser -S -G nodejs nextjs

# Only what the Node server needs at runtime: compiled output, static assets,
# production deps, package manifest, next config, and drizzle migrations
# (migrations are applied by scripts/deploy.sh from the build image, but the
# SQL is also present here for in-place repair if needed).
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --chown=nextjs:nodejs package.json ./package.json

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Drop root.
USER nextjs

# tini = PID 1 → proper SIGTERM handling for graceful shutdown (required for
# Next.js `after()` and in-flight request draining on ECS/Fargate rollout).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "start"]
