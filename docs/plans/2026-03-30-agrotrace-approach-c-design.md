# AgroTrace Approach C Design

Date: 2026-03-30
Author: OpenCode
Status: Approved by user

## Goal

Make the entire AgroTrace product production-ready on a single VPS, including:
- installable website experience (PWA) for desktop and phones,
- direct Android APK distribution from website (no Play Store dependency),
- maintained native mobile app,
- manager dashboard,
- public consumer traceability pages,
- local-first AI and enrichment pipelines with minimal external dependency.

## Product Decisions Confirmed

- Deployment target: single VPS.
- Scope: full ecosystem (mobile, manager web, public trace web, backend).
- Data stack: migrate to PostgreSQL and MinIO.
- Auth: user-created identities with password.
- Distribution:
  - Android: direct APK download.
  - iOS: PWA install path (Add to Home Screen).
- AI/integrations: as local as possible.

## Architecture

### Monorepo Services

- `backend`: API service (Fastify/TypeScript), auth, domain logic, sync endpoints.
- `worker`: asynchronous jobs for media processing, transcription, plant identification, enrichment.
- `web-admin`: manager dashboard web app.
- `web-trace`: public consumer traceability web app.
- `mobile`: native mobile app (Expo React Native), still supported.
- `pwa`: installable web app for field users and managers when appropriate.

### VPS Runtime Topology

All services run under Docker Compose behind `nginx` TLS termination:
- `nginx` (reverse proxy + TLS + static assets + APK delivery)
- `api` (backend)
- `worker`
- `postgres`
- `minio`
- `redis`
- `web-admin`
- `web-trace`
- `pwa`
- optional `prometheus`, `grafana`, and log aggregation service.

## Component and User Flows

### 1. Field Operations (PWA + Native)

- Login with password identity.
- Create/manage group context, farms, and visits.
- Capture photos (categorized), audio notes, geotags.
- Offline operation via local storage and sync queue.
- Sync pushes local mutations and pulls server changes.

### 2. Manager Dashboard

- Approve memberships and role changes.
- Configure committee composition and subgroup assignments.
- Schedule and inspect visits, rubrics, and reports.
- Monitor AI output confidence and retry/override failed jobs.
- View operations and data quality metrics.

### 3. Public Consumer Traceability

- Scan QR or open short link to batch page.
- View farm story, timeline, environmental indicators, and nutrition info.
- Read signed provenance snapshot derived from backend source of truth.

### 4. Distribution Paths

- Website hosts signed Android APK files + release notes/checksum.
- Website promotes PWA install for Android and iOS.
- Native app remains available for deep device capability and future store paths.

## Data and Storage Design

### PostgreSQL Domain Model (Core)

- Identity and access: `users`, `password_credentials`, `sessions`, `refresh_tokens`, `roles`, `permissions`.
- Organization: `groups`, `subgroups`, `memberships`, `committees`, `committee_members`.
- Field operations: `farms`, `visits`, `rubrics`, `reports`.
- Traceability: `product_batches`, `scans`, `provenance_snapshots`.
- Media and AI: `media_assets`, `voice_notes`, `plant_predictions`, `ai_jobs`, `job_attempts`.
- System: `audit_events`, `notifications`, `sync_cursors`.

### MinIO Object Storage

- Buckets by asset class: `photos`, `audio`, `exports`, `apk`.
- Metadata stored in database with checksum, media type, capture context, and AI processing state.
- Signed URL strategy for private assets; public-only for explicit consumer-safe assets.

### Redis

- Queue broker / transient job state.
- Rate-limit counters.
- Session and sync short-lived state.

## Offline Sync Model

- Client mutation log with idempotency keys.
- Server endpoints:
  - push: submit mutation batch,
  - pull: fetch changes since cursor,
  - ack: confirm applied changes.
- Conflict policy:
  - default `server_wins`,
  - field-level merge for safe additive data,
  - conflict records exposed to manager/admin review.

## Local-First AI and Enrichment

### Transcription

- Local service using `whisper.cpp` or `faster-whisper`.
- Worker sends uploaded audio, stores transcript, language, confidence, and segments.

### Plant Identification

- Local inference service for species classification.
- Store top-k species predictions, confidence, and model version.
- Low confidence triggers review queue.

### Nutrition and Product Enrichment

- Mirror and normalize nutrition data locally (OpenFoodFacts/USDA snapshots).
- Public batch pages query local DB first.
- External calls only as optional maintenance refresh tasks.

### Optional Local LLM Assistance

- Local model endpoint (e.g., Ollama) for summarization/classification tasks.
- Non-blocking and fallback-safe design.

## Security Baseline

- Passwords hashed with Argon2.
- Access tokens short-lived, refresh token rotation and revocation.
- RBAC checks in API layer and route guards.
- Strict schema validation for all write endpoints.
- Upload restrictions (mime, size, scan hooks).
- Security headers, CORS allowlist, and request throttling.
- Signed batch/provenance payloads for public trust.
- Secrets externalized in VPS environment files, not in repo.

## Reliability and Operations

- Health checks and restart policies per service.
- Durable queues + retry/backoff + dead-letter handling.
- Structured logs with request/job correlation IDs.
- Metrics and alerts for API error rates, queue depth, AI failures, disk and memory pressure.
- Daily backups (Postgres + MinIO) and scheduled restore drills.
- Rollback-ready image tags for deployment recovery.

## Testing and Release Quality Gates

- Unit tests: service and utility logic.
- Integration tests: API + Postgres + MinIO interactions.
- End-to-end tests: critical flows in PWA and manager/public web.
- Sync contract tests for native/PWA compatibility.
- Pre-release smoke suite on staging-like VPS stack.
- Post-deploy health and transactional smoke checks.

## Risks and Mitigations

- **Single VPS resource pressure**: isolate worker concurrency, set queue quotas, add model service limits.
- **AI latency on CPU-only hosts**: prioritize async UX and progressive result updates.
- **Offline conflict complexity**: preserve immutable event trail and explicit conflict views.
- **APK trust and integrity**: publish checksums/signatures and enforce HTTPS-only download path.
- **Model quality drift**: version model outputs and monitor confidence trends.

## Phased Delivery Strategy (within Approach C)

1. Foundation hardening and infra migration (Postgres, MinIO, Redis, Docker).
2. Identity, RBAC, and secure session lifecycle.
3. PWA field operations + offline sync protocol.
4. Native mobile alignment with shared API contracts.
5. Manager dashboard and moderation workflows.
6. Public trace web with signed provenance snapshots.
7. Local AI pipelines and nutrition mirror.
8. Observability, backup/restore drills, and release automation.

## Out-of-Scope for Initial Production Cut

- Multi-region failover.
- Kubernetes orchestration.
- Full enterprise SSO federation.

These can be added after stable single-VPS production operation.
