import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import { z } from 'zod'
import { db, migrate } from './db.js'
import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { getDistance } from 'geolib'

const server = Fastify({ logger: true })
// Basic CORS without plugin (compatible with Fastify v4)
server.addHook('onRequest', async (req, reply) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
  if (req.method === 'OPTIONS') {
    reply.code(204)
    return reply.send()
  }
})
await server.register(multipart)

// Init DB
migrate()

function now() { return new Date().toISOString() }

// Health
server.get('/health', async () => ({ ok: true }))

// Users (minimal)
server.post('/users', async (req, res) => {
  const schema = z.object({ name: z.string(), role: z.enum(['farmer','evaluator','manager','consumer']), locale: z.string().default('en') })
  const body = schema.parse(req.body)
  const id = randomUUID()
  db.prepare('INSERT INTO users (id,name,role,locale) VALUES (?,?,?,?)').run(id, body.name, body.role, body.locale)
  return { id, ...body }
})

// Locations
server.post('/locations', async (req) => {
  const schema = z.object({ name: z.string(), latitude: z.number(), longitude: z.number() })
  const b = schema.parse(req.body)
  const id = randomUUID()
  db.prepare('INSERT INTO locations (id,name,latitude,longitude) VALUES (?,?,?,?)').run(id, b.name, b.latitude, b.longitude)
  return { id, ...b }
})

// Groups with subgroups and committees
server.post('/groups', async (req, res) => {
  const schema = z.object({ name: z.string(), locationId: z.string().optional(), subgroups: z.array(z.string()).optional(), ethicsCommittee: z.array(z.object({ userId: z.string(), domain: z.enum(['agricultural','outsider']) })).length(3) })
  const b = schema.parse(req.body)
  // Validate committee composition: exactly 2 agricultural and 1 outsider
  const agCount = b.ethicsCommittee.filter(m => m.domain === 'agricultural').length
  const outCount = b.ethicsCommittee.filter(m => m.domain === 'outsider').length
  if (agCount !== 2 || outCount !== 1) {
    return res.status(400).send({ error: 'Ethics committee must be 2 agricultural + 1 outsider' })
  }
  const id = randomUUID()
  db.prepare('INSERT INTO groups (id,name,location_id) VALUES (?,?,?)').run(id, b.name, b.locationId ?? null)
  // Subgroups
  if (b.subgroups?.length) {
    const stmt = db.prepare('INSERT INTO subgroups (id,group_id,name) VALUES (?,?,?)')
    for (const name of b.subgroups) stmt.run(randomUUID(), id, name)
  }
  // Committee
  const committeeId = randomUUID()
  db.prepare('INSERT INTO committees (id,group_id,type) VALUES (?,?,?)').run(committeeId, id, 'ethics')
  const cmStmt = db.prepare('INSERT INTO committee_members (committee_id,user_id,domain) VALUES (?,?,?)')
  for (const m of b.ethicsCommittee) cmStmt.run(committeeId, m.userId, m.domain)
  return { id }
})

// Membership request and manager approval
server.post('/groups/:groupId/memberships', async (req, res) => {
  const params = z.object({ groupId: z.string() }).parse(req.params)
  const body = z.object({ userId: z.string(), role: z.enum(['member','lead','manager']).default('member') }).parse(req.body)
  db.prepare('INSERT OR REPLACE INTO group_members (user_id,group_id,role,status) VALUES (?,?,?,?)').run(body.userId, params.groupId, body.role, 'pending')
  return { ok: true }
})

server.post('/groups/:groupId/memberships/:userId/approve', async (req) => {
  const p = z.object({ groupId: z.string(), userId: z.string() }).parse(req.params)
  db.prepare('UPDATE group_members SET status = ? WHERE user_id = ? AND group_id = ?').run('approved', p.userId, p.groupId)
  return { ok: true }
})

// Farms
server.post('/farms', async (req) => {
  const b = z.object({ groupId: z.string(), name: z.string(), latitude: z.number().optional(), longitude: z.number().optional() }).parse(req.body)
  const id = randomUUID()
  db.prepare('INSERT INTO farms (id,group_id,name,latitude,longitude) VALUES (?,?,?,?,?)').run(id, b.groupId, b.name, b.latitude ?? null, b.longitude ?? null)
  return { id, ...b }
})

// Visits with rubric and plan
server.post('/visits', async (req) => {
  const b = z.object({ farmId: z.string(), type: z.enum(['ethics','peer_evaluation','surprise']), scheduledAt: z.string().datetime().optional(), leadUserId: z.string().optional(), plan: z.string().optional(), rubric: z.record(z.any()).optional() }).parse(req.body)
  const id = randomUUID()
  db.prepare('INSERT INTO visits (id,farm_id,type,scheduled_at,lead_user_id,plan,rubric_json) VALUES (?,?,?,?,?,?,?)')
    .run(id, b.farmId, b.type, b.scheduledAt ?? null, b.leadUserId ?? null, b.plan ?? null, b.rubric ? JSON.stringify(b.rubric) : null)
  return { id }
})

server.post('/visits/:visitId/report', async (req) => {
  const p = z.object({ visitId: z.string() }).parse(req.params)
  const b = z.object({ report: z.string() }).parse(req.body)
  db.prepare('UPDATE visits SET report = ? WHERE id = ?').run(b.report, p.visitId)
  return { ok: true }
})

// Media upload stubs (store files locally in backend/uploads)
import path from 'node:path'
import fs from 'node:fs'
const uploadsDir = path.resolve(process.cwd(), 'backend', 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })

server.post('/photos', async (req) => {
  const mp = await req.file()
  if (!mp) return { error: 'No file' }
  const fields = mp.fields as any
  const meta = z.object({ category: z.enum(['people','tools','plants','place_before','place_after']), farmId: z.string().optional(), visitId: z.string().optional(), latitude: z.coerce.number().optional(), longitude: z.coerce.number().optional(), species: z.string().optional(), capturedAt: z.string().optional() }).parse({ ...Object.fromEntries(Object.entries(fields).map(([k,v]: any) => [k, v.value])) })
  const id = randomUUID()
  const filePath = path.join(uploadsDir, `${id}-${mp.filename}`)
  await fs.promises.writeFile(filePath, await mp.toBuffer())
  db.prepare('INSERT INTO photos (id,farm_id,visit_id,category,file_path,latitude,longitude,species,captured_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, meta.farmId ?? null, meta.visitId ?? null, meta.category, filePath, meta.latitude ?? null, meta.longitude ?? null, meta.species ?? null, meta.capturedAt ?? now())
  return { id, filePath }
})

server.post('/voice-notes', async (req) => {
  const mp = await req.file()
  if (!mp) return { error: 'No file' }
  const fields = mp.fields as any
  const meta = z.object({ farmId: z.string().optional(), visitId: z.string().optional(), language: z.string().default('auto'), recordedAt: z.string().optional() }).parse({ ...Object.fromEntries(Object.entries(fields).map(([k,v]: any) => [k, v.value])) })
  const id = randomUUID()
  const filePath = path.join(uploadsDir, `${id}-${mp.filename}`)
  await fs.promises.writeFile(filePath, await mp.toBuffer())
  // Transcription stub — to be replaced with Whisper integration
  const transcript = `[stub transcript ${meta.language}]` 
  db.prepare('INSERT INTO voice_notes (id,farm_id,visit_id,file_path,language,transcript,recorded_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, meta.farmId ?? null, meta.visitId ?? null, filePath, meta.language, transcript, meta.recordedAt ?? now())
  return { id, filePath, transcript }
})

// Plant identification stub
server.post('/identify-plant', async (req) => {
  const schema = z.object({ photoId: z.string() })
  const { photoId } = schema.parse(req.body)
  // Placeholder species
  const species = 'Unknown species (stub)'
  db.prepare('UPDATE photos SET species = ? WHERE id = ?').run(species, photoId)
  return { species }
})

// Product traceability and QR codes
server.post('/batches', async (req) => {
  const b = z.object({ farmId: z.string(), productName: z.string(), story: z.string().optional(), nutrition: z.record(z.any()).optional() }).parse(req.body)
  const id = randomUUID()
  const qrValue = `agrotrace:batch:${id}`
  db.prepare('INSERT INTO product_batches (id,farm_id,product_name,story,nutrition_json,qr_value,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, b.farmId, b.productName, b.story ?? null, b.nutrition ? JSON.stringify(b.nutrition) : null, qrValue, now())
  const qrPng = await QRCode.toDataURL(qrValue)
  return { id, qrValue, qrPng }
})

server.get('/batches/:id', async (req, res) => {
  const p = z.object({ id: z.string() }).parse(req.params)
  const row = db.prepare('SELECT * FROM product_batches WHERE id = ?').get(p.id)
  if (!row) return res.status(404).send({ error: 'Not found' })
  row.nutrition = row.nutrition_json ? JSON.parse(row.nutrition_json) : null
  delete row.nutrition_json
  return row
})

// Record a consumer scan and compute distance traveled
server.post('/batches/:id/scan', async (req, res) => {
  const p = z.object({ id: z.string() }).parse(req.params)
  const b = z.object({ latitude: z.number(), longitude: z.number() }).parse(req.body)
  const batch = db.prepare('SELECT * FROM product_batches WHERE id = ?').get(p.id)
  if (!batch) return res.status(404).send({ error: 'Not found' })
  const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(batch.farm_id)
  let distanceKm: number | null = null
  if (farm?.latitude != null && farm?.longitude != null) {
    distanceKm = getDistance(
      { latitude: Number(farm.latitude), longitude: Number(farm.longitude) },
      { latitude: b.latitude, longitude: b.longitude }
    ) / 1000
  }
  const id = randomUUID()
  db.prepare('INSERT INTO scans (id,batch_id,latitude,longitude,scanned_at,distance_km) VALUES (?,?,?,?,?,?)')
    .run(id, p.id, b.latitude, b.longitude, now(), distanceKm)
  return { id, distanceKm }
})

// Nutrition comparison via Open Food Facts (barcode)
server.post('/nutrition/compare', async (req) => {
  const b = z.object({ barcodes: z.array(z.string()).min(1).max(5) }).parse(req.body)
  const base = process.env.OPENFOODFACTS_BASE || 'https://world.openfoodfacts.org/api/v0'
  const results = [] as any[]
  for (const code of b.barcodes) {
    try {
      const resp = await fetch(`${base}/product/${code}.json`)
      const data = await resp.json()
      results.push({ code, found: data.status === 1, product: data.product ? { product_name: data.product.product_name, nutriments: data.product.nutriments } : null })
    } catch (e) {
      results.push({ code, found: false, error: 'fetch_failed' })
    }
  }
  return { results }
})

const port = Number(process.env.PORT || 4000)
server.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`AgroTrace backend on :${port}`))
  .catch((err) => { console.error(err); process.exit(1) })
