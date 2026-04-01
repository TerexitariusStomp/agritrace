#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <version-tag>" >&2
  exit 1
fi

VERSION_TAG="$1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DEPLOY_DIR}/.." && pwd)"
RELEASE_DIR="${REPO_ROOT}/release"
STAGING_DIR="${RELEASE_DIR}/agritrace-${VERSION_TAG}"

require_dir() {
  local path="$1"
  local message="$2"
  if [[ ! -d "${path}" ]]; then
    echo "${message}: ${path}" >&2
    exit 1
  fi
}

require_file() {
  local path="$1"
  local message="$2"
  if [[ ! -f "${path}" ]]; then
    echo "${message}: ${path}" >&2
    exit 1
  fi
}

require_dir "${REPO_ROOT}/backend/dist" "Missing backend build output"
require_dir "${REPO_ROOT}/pwa/dist" "Missing PWA build output"
require_dir "${REPO_ROOT}/web-admin/dist" "Missing web-admin build output"
require_dir "${REPO_ROOT}/web-trace/dist" "Missing web-trace build output"
require_file "${REPO_ROOT}/deploy/docker-compose.yml" "Missing deploy compose file"
require_file "${REPO_ROOT}/deploy/nginx/nginx.conf" "Missing nginx config"

rm -rf "${STAGING_DIR}"
mkdir -p "${STAGING_DIR}"

mkdir -p "${STAGING_DIR}/backend"
cp -R "${REPO_ROOT}/backend/dist" "${STAGING_DIR}/backend/dist"
cp "${REPO_ROOT}/backend/package.json" "${STAGING_DIR}/backend/package.json"
cp "${REPO_ROOT}/backend/Dockerfile.prod" "${STAGING_DIR}/backend/Dockerfile.prod"

mkdir -p "${STAGING_DIR}/pwa"
cp -R "${REPO_ROOT}/pwa/dist" "${STAGING_DIR}/pwa/dist"

mkdir -p "${STAGING_DIR}/web-admin"
cp -R "${REPO_ROOT}/web-admin/dist" "${STAGING_DIR}/web-admin/dist"

mkdir -p "${STAGING_DIR}/web-trace"
cp -R "${REPO_ROOT}/web-trace/dist" "${STAGING_DIR}/web-trace/dist"

cp -R "${REPO_ROOT}/deploy" "${STAGING_DIR}/deploy"
cp "${REPO_ROOT}/README.md" "${STAGING_DIR}/README.md"

ARCHIVE_PATH="${RELEASE_DIR}/agritrace-${VERSION_TAG}.tar.gz"
CHECKSUM_PATH="${RELEASE_DIR}/agritrace-${VERSION_TAG}.sha256"

rm -f "${ARCHIVE_PATH}" "${CHECKSUM_PATH}"
tar -C "${RELEASE_DIR}" -czf "${ARCHIVE_PATH}" "agritrace-${VERSION_TAG}"

sha256sum "${ARCHIVE_PATH}" > "${CHECKSUM_PATH}"

echo "Release bundle created: ${ARCHIVE_PATH}"
echo "Checksum file created: ${CHECKSUM_PATH}"
