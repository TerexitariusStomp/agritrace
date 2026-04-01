AgroTrace Monorepo
===================

Overview
- Backend API: Node.js + Fastify + TypeScript
- Mobile app: Expo (React Native) skeleton
- Focus: Groups with committees and subgroups, farm visits with rubrics, voice/photo capture stubs, QR traceability, nutrition comparison, and environmental metrics.

Quick Start
- Copy `.env.example` to `backend/.env`.
- Install dependencies: `npm install`.
- Start the backend: `npm run dev:backend`.
  - Defaults to `PORT=4000` (from `backend/.env`).
  - You can override by setting `PORT` when launching, e.g. `PORT=3000 npm run dev:backend`.
- Start the mobile app: install Expo CLI (`npm i -g expo`), then `npm run dev:mobile`.
  - The mobile app reads the API base from `EXPO_PUBLIC_API_URL`.
  - Update `mobile/.env` if you change the backend port or run on a device.

VPS Emulator Setup
- See `docs/VPS-EMULATOR-SETUP.md` for a step-by-step guide to run an Android emulator on a KVM VPS and expose it via WebRTC, and to run this app against it.

Production VPS Deployment (Docker Compose)
- Production stack files live under `deploy/`:
  - `deploy/docker-compose.yml`
  - `deploy/nginx/nginx.conf`
  - `deploy/env/.env.example`
  - `deploy/monitoring/prometheus.yml`
  - `deploy/monitoring/grafana-dashboards/api-overview.json`
  - `deploy/scripts/backup.sh`, `deploy/scripts/restore.sh`
- Services included: `backend`, `worker`, `postgres`, `redis`, `minio`, `pwa`, `web-admin`, `web-trace`, `nginx`, plus monitoring (`prometheus`, `grafana`, exporters, `cadvisor`).
- First-time setup:
  - Copy env template: `cp deploy/env/.env.example deploy/env/.env`.
  - Fill strong secrets in `deploy/env/.env` (JWT access secret, trace signing keys, DB password, MinIO password, Grafana admin password).
  - Ensure frontend bundles exist (`pwa/dist`, `web-admin/dist`, `web-trace/dist`).
- Validate and run:
  - `docker compose --env-file deploy/env/.env -f deploy/docker-compose.yml config`
  - `docker compose --env-file deploy/env/.env -f deploy/docker-compose.yml up -d`
- Routing defaults (`nginx`):
  - `/` -> `pwa`
  - `/api/` -> `backend`
  - `/admin/` -> `web-admin`
  - `/trace/` -> `web-trace`
  - MinIO API/console bind to `127.0.0.1` by default via `MINIO_BIND_ADDRESS` (set to `0.0.0.0` only if external access is required)
- Monitoring:
  - Prometheus and Grafana bind to `127.0.0.1` by default (`PROMETHEUS_BIND_ADDRESS`, `GRAFANA_BIND_ADDRESS`)
  - Default local endpoints: `http://127.0.0.1:9090` (Prometheus), `http://127.0.0.1:3001` (Grafana)
  - Import `deploy/monitoring/grafana-dashboards/api-overview.json` in Grafana.
- Backups:
  - Make scripts executable once: `chmod +x deploy/scripts/backup.sh deploy/scripts/restore.sh`
  - Backup: `./deploy/scripts/backup.sh`
  - Restore: `./deploy/scripts/restore.sh --force deploy/backups/<backup-file>.tar.gz`

CI/CD and Release Automation
- CI workflow: `.github/workflows/ci.yml`
  - Runs on pushes and pull requests.
  - Validates backend/web/mobile tests and builds.
  - Validates deploy assets (`docker compose ... config`, backup/restore script syntax).
- Release workflow: `.github/workflows/release.yml`
  - Runs when a `v*` tag is pushed.
  - Builds `backend`, `pwa`, `web-admin`, and `web-trace`.
  - Packages deploy-ready artifacts via `deploy/scripts/package-release.sh`.
  - Publishes release assets:
    - `release/agritrace-<tag>.tar.gz`
    - `release/agritrace-<tag>.sha256`
- GitHub Pages workflow: `.github/workflows/pages.yml`
  - Builds and deploys `pwa` as the public website.
  - Default URL pattern: `https://<github-username>.github.io/<repo-name>/`
- Local dry run for release bundle:
  - `npm --workspace backend run build`
  - `npm --workspace pwa run build`
  - `npm --workspace web-admin run build`
  - `npm --workspace web-trace run build`
  - `bash deploy/scripts/package-release.sh v0.0.0-local`

Examples
- Backend on default port:
  - Ensure `mobile/.env` contains `EXPO_PUBLIC_API_URL=http://localhost:4000`.
- Backend on 3000:
  - Launch: `PORT=3000 npm run dev:backend`.
  - Update `mobile/.env` to `EXPO_PUBLIC_API_URL=http://localhost:3000`.
- Physical device on same Wi‑Fi:
  - Replace `localhost` with your machine LAN IP, e.g. `EXPO_PUBLIC_API_URL=http://192.168.1.50:4000`.

Health Check
- Backend health endpoint: `GET /health` returns `{ ok: true }`.

Features Implemented
- Group creation with ethics committee constraint (2 agricultural + 1 outsider)
- Subgroups under groups
- Manager approval flow for user memberships
- Visits: ethics, peer evaluation, surprise with rubric + report
- Media: photos categorized (people, tools, plants, place_before, place_after) with geotag
- Voice note ingestion with language + transcript placeholder
- QR code generation for product batches; link story + nutrition data
- Nutrition comparison via Open Food Facts (barcode)
- Environmental metrics: distance from farm to purchase point

Notes
- This is a minimal, runnable foundation with clear extension points for Whisper and PlantNet integrations.
