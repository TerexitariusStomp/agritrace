# AgroTrace Approach C Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a production-ready single-VPS AgroTrace platform with PWA + native mobile + manager web + public trace web, PostgreSQL + MinIO + Redis, and local-first AI pipelines.

**Architecture:** Keep a monorepo with isolated apps (`backend`, `mobile`, `web-admin`, `web-trace`, `pwa`) and shared packages for types/auth/client logic. Run API and worker separately, backed by Postgres/MinIO/Redis, and serve all web surfaces behind nginx TLS. Use asynchronous AI jobs so user flows remain responsive while heavy processing runs in the background.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Drizzle ORM, Redis/BullMQ, MinIO, Expo React Native, Vite React PWA, Vitest, Playwright, Docker Compose, nginx, Prometheus/Grafana.

---

### Task 1: Restructure Monorepo and Add Shared Contracts

**Files:**
- Create: `shared/package.json`
- Create: `shared/src/contracts.ts`
- Create: `shared/src/env.ts`
- Create: `web-admin/package.json`
- Create: `web-admin/src/main.tsx`
- Create: `web-trace/package.json`
- Create: `web-trace/src/main.tsx`
- Create: `pwa/package.json`
- Create: `pwa/src/main.tsx`
- Modify: `package.json`

**Step 1: Write the failing workspace test script references**

```json
{
  "scripts": {
    "test:contracts": "npm --workspace shared run test"
  }
}
```

**Step 2: Run test to verify it fails**

Run: `npm run test:contracts`
Expected: FAIL with missing `shared` test script/package.

**Step 3: Write minimal shared contract module**

```ts
export type Role = 'farmer' | 'evaluator' | 'manager' | 'consumer'

export interface UserIdentity {
  id: string
  email: string
  role: Role
}
```

**Step 4: Add workspace package scripts and build wiring**

Run: `npm pkg set workspaces[3]=web-admin workspaces[4]=web-trace workspaces[5]=pwa`

**Step 5: Run workspace install and verify**

Run: `npm install`
Expected: PASS, all workspaces discovered.

**Step 6: Commit**

```bash
git add package.json package-lock.json shared web-admin web-trace pwa
git commit -m "chore: initialize production monorepo app surfaces and shared contracts"
```

### Task 2: Add Backend Testing Harness and App Factory

**Files:**
- Create: `backend/src/app.ts`
- Create: `backend/tests/health.test.ts`
- Create: `backend/vitest.config.ts`
- Modify: `backend/src/index.ts`
- Modify: `backend/package.json`

**Step 1: Write failing health integration test**

```ts
import { buildApp } from '../src/app'
import { describe, it, expect } from 'vitest'

describe('GET /health', () => {
  it('returns ok true', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace backend run test -- health.test.ts`
Expected: FAIL with `buildApp` missing and/or vitest not configured.

**Step 3: Implement minimal app factory**

```ts
export async function buildApp() {
  const app = Fastify({ logger: false })
  app.get('/health', async () => ({ ok: true }))
  return app
}
```

**Step 4: Hook runtime entrypoint to app factory**

```ts
const app = await buildApp()
await app.listen({ host: '0.0.0.0', port })
```

**Step 5: Run tests**

Run: `npm --workspace backend run test`
Expected: PASS for `health.test.ts`.

**Step 6: Commit**

```bash
git add backend/src backend/tests backend/package.json backend/vitest.config.ts
git commit -m "test: add backend app factory and integration harness"
```

### Task 3: Migrate Backend Storage to PostgreSQL + Drizzle

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/db/schema.ts`
- Create: `backend/src/db/client.ts`
- Create: `backend/src/db/migrate.ts`
- Create: `backend/tests/db/users.repository.test.ts`
- Modify: `backend/package.json`
- Modify: `backend/src/app.ts`

**Step 1: Write failing repository test against Postgres schema**

```ts
it('creates a user row', async () => {
  const user = await createUser({ email: 'a@b.com', passwordHash: 'x', role: 'farmer' })
  expect(user.email).toBe('a@b.com')
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace backend run test -- users.repository.test.ts`
Expected: FAIL because repository/schema/client do not exist.

**Step 3: Implement Drizzle schema and client**

```ts
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
})
```

**Step 4: Add migration command**

Run: `npm --workspace backend run db:generate && npm --workspace backend run db:migrate`
Expected: PASS and migration files generated.

**Step 5: Re-run tests**

Run: `npm --workspace backend run test -- users.repository.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add backend/src/db backend/drizzle.config.ts backend/package.json backend/tests/db
git commit -m "feat: migrate backend persistence to PostgreSQL with drizzle"
```

### Task 4: Implement Identity/Auth (Password + JWT + Refresh)

**Files:**
- Create: `backend/src/auth/hash.ts`
- Create: `backend/src/auth/tokens.ts`
- Create: `backend/src/routes/auth.ts`
- Create: `backend/src/routes/me.ts`
- Create: `backend/tests/auth/register-login.test.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/db/schema.ts`

**Step 1: Write failing auth tests**

```ts
it('registers, logs in, and fetches me', async () => {
  const register = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'u@x.com', password: 'Passw0rd!' } })
  expect(register.statusCode).toBe(201)

  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'u@x.com', password: 'Passw0rd!' } })
  expect(login.statusCode).toBe(200)

  const access = login.json().accessToken
  const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${access}` } })
  expect(me.statusCode).toBe(200)
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace backend run test -- register-login.test.ts`
Expected: FAIL with missing routes/auth modules.

**Step 3: Implement minimal auth routes and hashing**

```ts
const hash = await argon2.hash(password)
const valid = await argon2.verify(passwordHash, password)
```

**Step 4: Implement JWT + refresh token rotation**

```ts
return { accessToken: signAccess({ sub: user.id, role: user.role }), refreshToken }
```

**Step 5: Re-run auth tests**

Run: `npm --workspace backend run test -- register-login.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add backend/src/auth backend/src/routes backend/src/db/schema.ts backend/tests/auth
git commit -m "feat: add password-based identity, jwt access, and rotating refresh tokens"
```

### Task 5: Integrate MinIO Media Storage and Metadata Records

**Files:**
- Create: `backend/src/storage/minio.ts`
- Create: `backend/src/routes/media.ts`
- Create: `backend/tests/media/upload-photo.test.ts`
- Modify: `backend/src/db/schema.ts`
- Modify: `backend/src/app.ts`

**Step 1: Write failing media upload test**

```ts
it('uploads photo and returns media asset id', async () => {
  const res = await app.inject({
    method: 'POST',
    url: '/media/photos',
    headers: authHeaders,
    payload: formDataWithImage
  })
  expect(res.statusCode).toBe(201)
  expect(res.json().assetId).toBeTruthy()
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace backend run test -- upload-photo.test.ts`
Expected: FAIL with missing route/storage.

**Step 3: Implement MinIO adapter and metadata insert**

```ts
await minio.putObject('photos', objectKey, fileBuffer, fileBuffer.length, { 'Content-Type': mime })
await db.insert(mediaAssets).values({ id, objectKey, bucket: 'photos', mime, category })
```

**Step 4: Re-run tests**

Run: `npm --workspace backend run test -- upload-photo.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/src/storage backend/src/routes/media.ts backend/src/db/schema.ts backend/tests/media
git commit -m "feat: store uploaded media in minio with persisted metadata"
```

### Task 6: Add Redis Queue + Worker for Local AI Jobs

**Files:**
- Create: `backend/src/jobs/queue.ts`
- Create: `backend/src/jobs/worker.ts`
- Create: `backend/src/ai/transcribe.ts`
- Create: `backend/src/ai/plant-id.ts`
- Create: `backend/tests/jobs/voice-job.test.ts`
- Modify: `backend/package.json`

**Step 1: Write failing queued transcription job test**

```ts
it('processes voice note job and stores transcript', async () => {
  const jobId = await enqueueTranscription({ mediaAssetId })
  await waitForJob(jobId)
  const note = await getVoiceNote(mediaAssetId)
  expect(note.transcript).toContain('stub')
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace backend run test -- voice-job.test.ts`
Expected: FAIL with missing queue/worker.

**Step 3: Implement BullMQ queue and worker skeleton**

```ts
export const aiQueue = new Queue('ai-jobs', { connection })
new Worker('ai-jobs', async (job) => {
  if (job.name === 'transcribe') await runTranscription(job.data)
})
```

**Step 4: Implement local AI adapters (HTTP to local services)**

```ts
const resp = await fetch(`${process.env.LOCAL_WHISPER_URL}/transcribe`, { method: 'POST', body: form })
```

**Step 5: Re-run tests**

Run: `npm --workspace backend run test -- voice-job.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add backend/src/jobs backend/src/ai backend/package.json backend/tests/jobs
git commit -m "feat: add redis-backed ai job pipeline and worker processing"
```

### Task 7: Build Installable PWA for Field and Manager Access

**Files:**
- Create: `pwa/src/app/App.tsx`
- Create: `pwa/src/app/routes.tsx`
- Create: `pwa/src/offline/sync.ts`
- Create: `pwa/public/manifest.webmanifest`
- Create: `pwa/public/sw.js`
- Create: `pwa/tests/pwa-install.spec.ts`

**Step 1: Write failing PWA install/e2e test**

```ts
test('shows install prompt and can create farm offline', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Install AgroTrace')).toBeVisible()
  await page.getByLabel('Farm name').fill('Demo Farm')
  await page.getByText('Save Offline').click()
  await expect(page.getByText('Queued for sync')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace pwa run test:e2e`
Expected: FAIL with missing UI/routes/service worker.

**Step 3: Implement minimal PWA shell with install and offline queue**

```ts
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
```

**Step 4: Re-run tests**

Run: `npm --workspace pwa run test:e2e`
Expected: PASS for install prompt and offline queue behavior.

**Step 5: Commit**

```bash
git add pwa
git commit -m "feat: implement installable pwa with offline field workflow"
```

### Task 8: Build Manager Dashboard Web App

**Files:**
- Create: `web-admin/src/pages/Login.tsx`
- Create: `web-admin/src/pages/Approvals.tsx`
- Create: `web-admin/src/pages/Visits.tsx`
- Create: `web-admin/src/pages/AIModeration.tsx`
- Create: `web-admin/tests/manager-flow.spec.ts`

**Step 1: Write failing manager e2e flow test**

```ts
test('manager approves user and reviews AI result', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name=email]', 'manager@demo.com')
  await page.fill('[name=password]', 'Passw0rd!')
  await page.click('text=Sign in')
  await page.click('text=Approvals')
  await page.click('text=Approve')
  await expect(page.getByText('Approved')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace web-admin run test:e2e`
Expected: FAIL with missing routes/pages.

**Step 3: Implement minimal admin pages and protected routing**

```ts
<Route path="/approvals" element={<RequireRole role="manager"><Approvals /></RequireRole>} />
```

**Step 4: Re-run tests**

Run: `npm --workspace web-admin run test:e2e`
Expected: PASS.

**Step 5: Commit**

```bash
git add web-admin
git commit -m "feat: add manager dashboard for approvals visits and ai moderation"
```

### Task 9: Build Public Traceability Web App and Signed Provenance

**Files:**
- Create: `web-trace/src/pages/TracePage.tsx`
- Create: `web-trace/src/components/Timeline.tsx`
- Create: `backend/src/routes/public-trace.ts`
- Create: `backend/src/trace/signature.ts`
- Create: `web-trace/tests/trace-page.spec.ts`
- Modify: `backend/src/app.ts`

**Step 1: Write failing public trace test**

```ts
test('opens signed trace page by batch id', async ({ page }) => {
  await page.goto('/trace/demo-batch-id')
  await expect(page.getByText('Provenance verified')).toBeVisible()
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace web-trace run test:e2e`
Expected: FAIL with missing route/data source.

**Step 3: Implement signed provenance endpoint and trace UI**

```ts
const signature = createHmac('sha256', secret).update(payload).digest('hex')
return { snapshot, signature }
```

**Step 4: Re-run tests**

Run: `npm --workspace web-trace run test:e2e`
Expected: PASS.

**Step 5: Commit**

```bash
git add web-trace backend/src/routes/public-trace.ts backend/src/trace/signature.ts backend/src/app.ts
git commit -m "feat: add public qr traceability page with signed provenance"
```

### Task 10: Align Native Mobile App with New Auth/Sync APIs

**Files:**
- Modify: `mobile/App.tsx`
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/auth/session.ts`
- Create: `mobile/src/sync/queue.ts`
- Create: `mobile/tests/smoke.login-sync.test.ts`

**Step 1: Write failing mobile integration test**

```ts
it('logs in and queues farm mutation offline', async () => {
  const session = await login('farmer@demo.com', 'Passw0rd!')
  expect(session.accessToken).toBeTruthy()
  const queued = await queueFarmCreate({ name: 'Field Farm' })
  expect(queued).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npm --workspace mobile run test -- login-sync.test.ts`
Expected: FAIL with missing auth/sync modules.

**Step 3: Implement minimal auth client + queue module**

```ts
await fetch(`${API_URL}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) })
```

**Step 4: Re-run tests**

Run: `npm --workspace mobile run test -- login-sync.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add mobile
git commit -m "feat: align native mobile with auth and offline sync contracts"
```

### Task 11: Add VPS Production Stack (Compose, nginx, Local AI, Monitoring)

**Files:**
- Create: `deploy/docker-compose.yml`
- Create: `deploy/nginx/nginx.conf`
- Create: `deploy/env/.env.example`
- Create: `deploy/scripts/backup.sh`
- Create: `deploy/scripts/restore.sh`
- Create: `deploy/monitoring/prometheus.yml`
- Create: `deploy/monitoring/grafana-dashboards/api-overview.json`
- Modify: `README.md`

**Step 1: Write failing deployment smoke script**

```bash
./deploy/scripts/smoke.sh
```

Expected: FAIL because services/configs are missing.

**Step 2: Implement compose stack and nginx routing**

```yaml
services:
  api:
    build: ../backend
  worker:
    build: ../backend
  postgres:
    image: postgres:16
  minio:
    image: minio/minio
  redis:
    image: redis:7
  pwa:
    build: ../pwa
  web-admin:
    build: ../web-admin
  web-trace:
    build: ../web-trace
```

**Step 3: Bring stack up and validate**

Run: `docker compose -f deploy/docker-compose.yml up -d --build`
Expected: PASS with all services healthy.

**Step 4: Run smoke validation**

Run: `./deploy/scripts/smoke.sh`
Expected: PASS with healthy endpoints and web routes.

**Step 5: Commit**

```bash
git add deploy README.md
git commit -m "ops: add single-vps production stack with backups and monitoring"
```

### Task 12: Add CI/CD, Release Automation, APK Publishing, and Final Verification

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`
- Create: `scripts/publish-android-apk.sh`
- Create: `docs/ops/RELEASE-RUNBOOK.md`
- Create: `docs/ops/INCIDENT-RUNBOOK.md`

**Step 1: Write failing CI dry-run check**

Run: `npm run lint && npm run build && npm run test`
Expected: FAIL until all workspace scripts are wired.

**Step 2: Implement CI pipeline**

```yaml
jobs:
  test:
    steps:
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test
```

**Step 3: Implement release and APK publish pipeline**

```bash
eas build --platform android --profile production
cp app-release.apk deploy/public/downloads/agrotrace-<version>.apk
sha256sum deploy/public/downloads/agrotrace-<version>.apk > deploy/public/downloads/SHA256SUMS
```

**Step 4: Run full verification suite**

Run: `npm run build && npm run test && docker compose -f deploy/docker-compose.yml config`
Expected: PASS.

**Step 5: Commit**

```bash
git add .github scripts docs/ops
git commit -m "build: add ci cd release automation and operational runbooks"
```

## Final Validation Checklist (must pass before declaring complete)

1. `npm install` succeeds at monorepo root.
2. `npm run build` succeeds across all workspaces.
3. `npm run test` succeeds across all workspaces.
4. `docker compose -f deploy/docker-compose.yml up -d --build` succeeds.
5. `GET /health` returns `{ ok: true }` through nginx.
6. PWA install prompt appears on supported browsers.
7. Android APK download page serves signed artifact + checksum.
8. Manager can approve memberships and review AI jobs.
9. Public QR trace route renders verified provenance.
10. Backup and restore scripts execute successfully on test snapshot.
