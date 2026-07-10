#!/usr/bin/env bash
#
# Deploy the Binary Capital CRM via the India-hosted Path 2 (containers on
# AWS ap-south-1 / Azure West India). ARCHITECTURE.md §2.3.
#
# Flow:  build image  →  run Drizzle migrations (one-off)  →  start app container
#
# Migrations are run from the *build* stage image (which carries drizzle-kit +
# the full devDependency tree), NOT the slim runtime image — this keeps the
# runtime image small while still letting the deploy apply schema changes
# against the ap-south-1/Aurora Postgres before serving traffic.
#
# Usage:
#   scripts/deploy.sh                       # defaults, reads .env.production
#   IMAGE=binary-crm:sha ENV_FILE=.env.production scripts/deploy.sh
#   MIGRATE_ONLY=1 scripts/deploy.sh        # apply migrations, don't start app
#   SKIP_MIGRATE=1 scripts/deploy.sh        # start app, skip migrations
#
# Required env (in ENV_FILE or exported): DATABASE_URL, DATABASE_URL_UNPOOLED,
# AUTH_SECRET, AUTH_URL. See .env.example. Secrets are passed via --env-file at
# runtime — they are NEVER baked into the image.
#
# Target region: ap-south-1 (Mumbai) / Azure West India. The container runtime
# and the Aurora/RDS Postgres MUST be co-located in the same India region to
# keep primary processing of PII/MNPI in-region (DPDP / SEBI Cloud Framework).
set -euo pipefail

# ── config ────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE="${IMAGE:-binary-crm:latest}"
MIGRATE_IMAGE="${MIGRATE_IMAGE:-${IMAGE}-migrate}"
ENV_FILE="${ENV_FILE:-.env.production}"
CONTAINER_NAME="${CONTAINER_NAME:-binary-crm}"
PORT="${PORT:-3000}"
NETWORK="${NETWORK:-host}"   # use --network=host so the container can reach the
                             # VPC-internal Aurora endpoint without extra DNS.
                             # On ECS/Fargate use awsvpc; override NETWORK="".

color() { printf '\033[%sm%s\033[0m' "$1" "$2"; }
log()  { printf '%s %s\n' "$(color "1;36" "▸")" "$*"; }
err()  { printf '%s %s\n' "$(color "1;31" "✖")" "$*" >&2; }
ok()   { printf '%s %s\n' "$(color "1;32" "✔")" "$*"; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || { err "Missing required command: $1"; exit 1; }; }

# ── preflight ─────────────────────────────────────────────────────────────
require_cmd docker

if [[ ! -f "${ENV_FILE}" ]]; then
  err "Env file not found: ${ENV_FILE} (copy .env.example → ${ENV_FILE} and fill prod secrets)"
  exit 1
fi

# Validate the load-bearing secrets are present (fail fast, before building).
for var in DATABASE_URL DATABASE_URL_UNPOOLED AUTH_SECRET AUTH_URL; do
  # `set -a; . file; set +a` sources without leaking into this shell long-term.
  val="$( ( set -a; . "${ENV_FILE}"; set +a; printf '%s' "${!var:-}" ) )"
  if [[ -z "${val}" ]]; then
    err "Missing required secret in ${ENV_FILE}: ${var}"
    exit 1
  fi
done
ok "Preflight: env file + required secrets present"

# ── 1. build ───────────────────────────────────────────────────────────────
log "Building runtime image  → ${IMAGE}"
docker build --target runtime -t "${IMAGE}" "${ROOT_DIR}"

if [[ "${MIGRATE_ONLY:-0}" != "1" ]]; then
  log "Building migrate image  → ${MIGRATE_IMAGE}"
  docker build --target build -t "${MIGRATE_IMAGE}" "${ROOT_DIR}"
fi

# ── 2. migrate (Drizzle) ───────────────────────────────────────────────────
run_migrations() {
  log "Applying Drizzle migrations against ${DATABASE_URL_UNPOOLED%%@*}@<host>"
  local net_args=()
  if [[ -n "${NETWORK}" ]]; then net_args=(--network "${NETWORK}"); fi
  # shellcheck disable=SC2086
  docker run --rm \
    --env-file "${ENV_FILE}" \
    "${net_args[@]}" \
    "${MIGRATE_IMAGE}" \
    npx drizzle-kit migrate --config drizzle.config.ts
  ok "Migrations applied"
}

if [[ "${SKIP_MIGRATE:-0}" != "1" ]]; then
  run_migrations
else
  log "SKIP_MIGRATE=1 — skipping migrations"
fi

if [[ "${MIGRATE_ONLY:-0}" == "1" ]]; then
  ok "MIGRATE_ONLY=1 — done after migrations"
  exit 0
fi

# ── 3. start ───────────────────────────────────────────────────────────────
log "Starting app container   → ${CONTAINER_NAME} (0.0.0.0:${PORT})"
# Replace any existing container with the same name (idempotent redeploys).
if docker ps -a --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  log "Removing existing container ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

net_args=()
if [[ -n "${NETWORK}" ]]; then net_args=(--network "${NETWORK}"); fi
# --restart unless-stopped: survives host reboot / Fargate task restart.
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --env-file "${ENV_FILE}" \
  -p "${PORT}:3000" \
  "${net_args[@]}" \
  "${IMAGE}"

ok "Deployed: ${CONTAINER_NAME} → http://localhost:${PORT}"
log "Logs:     docker logs -f ${CONTAINER_NAME}"
log "Health:   curl -fsS http://localhost:${PORT}/ || docker logs --tail 50 ${CONTAINER_NAME}"
