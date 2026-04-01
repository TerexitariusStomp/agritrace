#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 --force <backup-tar.gz>" >&2
  exit 1
fi

if [[ "$1" != "--force" ]]; then
  echo "Refusing restore without --force." >&2
  exit 1
fi

BACKUP_ARCHIVE="$2"
if [[ ! -f "${BACKUP_ARCHIVE}" ]]; then
  echo "Backup archive not found: ${BACKUP_ARCHIVE}" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"
ENV_FILE="${DEPLOY_ENV_FILE:-${DEPLOY_DIR}/env/.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing env file: ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

RESTORE_DIR="$(mktemp -d)"
trap 'rm -rf "${RESTORE_DIR}"' EXIT
tar -C "${RESTORE_DIR}" -xzf "${BACKUP_ARCHIVE}"

if [[ ! -f "${RESTORE_DIR}/postgres.dump" ]]; then
  echo "Invalid backup archive: missing postgres.dump" >&2
  exit 1
fi

if [[ ! -d "${RESTORE_DIR}/minio-data" ]]; then
  echo "Invalid backup archive: missing minio-data directory" >&2
  exit 1
fi

COMPOSE_CMD=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

echo "Stopping app services for restore..."
"${COMPOSE_CMD[@]}" stop nginx worker backend

echo "Restoring PostgreSQL dump (destructive)..."
"${COMPOSE_CMD[@]}" exec -T postgres psql \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
"${COMPOSE_CMD[@]}" exec -T postgres pg_restore \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --clean --if-exists < "${RESTORE_DIR}/postgres.dump"

if [[ -f "${RESTORE_DIR}/agrotrace.db" ]]; then
  echo "Restoring SQLite database..."
  "${COMPOSE_CMD[@]}" cp "${RESTORE_DIR}/agrotrace.db" backend:/data/agrotrace.db
fi

if [[ -d "${RESTORE_DIR}/minio-data" ]]; then
  echo "Restoring MinIO data..."
  "${COMPOSE_CMD[@]}" exec -T minio sh -c 'rm -rf /data/*'
  "${COMPOSE_CMD[@]}" cp "${RESTORE_DIR}/minio-data/." minio:/data
fi

echo "Starting services..."
"${COMPOSE_CMD[@]}" start backend worker nginx

echo "Restore completed from ${BACKUP_ARCHIVE}"
