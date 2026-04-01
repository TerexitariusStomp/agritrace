#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DEPLOY_ENV_FILE:-${DEPLOY_DIR}/env/.env}"
BACKUP_DIR="${BACKUP_DIR:-${DEPLOY_DIR}/backups}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="${BACKUP_DIR}/tmp-${TIMESTAMP}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  echo "Copy deploy/env/.env.example to deploy/env/.env and fill secrets." >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

mkdir -p "${BACKUP_DIR}" "${WORK_DIR}"

COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

WRITER_SERVICES=(backend worker)

restart_writers() {
  "${COMPOSE_CMD[@]}" start "${WRITER_SERVICES[@]}" >/dev/null 2>&1 || true
}

trap 'restart_writers; rm -rf "${WORK_DIR}"' EXIT

echo "Creating PostgreSQL dump..."
"${COMPOSE_CMD[@]}" exec -T postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -Fc > "${WORK_DIR}/postgres.dump"

echo "Stopping writer services for consistent SQLite and object-store copy..."
"${COMPOSE_CMD[@]}" stop "${WRITER_SERVICES[@]}"

echo "Copying SQLite database from backend volume..."
"${COMPOSE_CMD[@]}" cp backend:/data/agrotrace.db "${WORK_DIR}/agrotrace.db"

echo "Copying MinIO data..."
"${COMPOSE_CMD[@]}" cp minio:/data "${WORK_DIR}/minio-data"

echo "Starting writer services..."
"${COMPOSE_CMD[@]}" start "${WRITER_SERVICES[@]}"

cat > "${WORK_DIR}/manifest.txt" <<EOF
created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
compose_project=${COMPOSE_PROJECT_NAME:-agritrace-prod}
postgres_db=${POSTGRES_DB}
postgres_user=${POSTGRES_USER}
EOF

ARCHIVE_PATH="${BACKUP_DIR}/agritrace-backup-${TIMESTAMP}.tar.gz"
tar -C "${WORK_DIR}" -czf "${ARCHIVE_PATH}" .
rm -rf "${WORK_DIR}"
trap - EXIT

echo "Backup complete: ${ARCHIVE_PATH}"
