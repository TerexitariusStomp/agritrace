import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db.js'
import { signTracePayload } from '../trace/signature.js'

type BatchTraceRow = {
  id: string
  product_name: string
  story: string | null
  nutrition_json: string | null
  created_at: string | null
  farm_name: string
}

type VisitRow = {
  id: string
  type: string
  scheduled_at: string | null
  report: string | null
}

type ScanAggregateRow = {
  total_scans: number
  last_scan_at: string | null
}

export async function registerPublicTraceRoutes(server: FastifyInstance): Promise<void> {
  server.get('/public/trace/:id', async (req, reply) => {
    const params = z.object({ id: z.string().min(1) }).parse(req.params)

    const batch = db
      .prepare(
        `SELECT b.id, b.product_name, b.story, b.nutrition_json, b.created_at, f.name AS farm_name
         FROM product_batches b
         JOIN farms f ON f.id = b.farm_id
         WHERE b.id = ?
         LIMIT 1`
      )
      .get(params.id) as BatchTraceRow | undefined

    if (!batch) {
      return reply.status(404).send({ error: 'Trace record not found' })
    }

    const visits = db
      .prepare(
        `SELECT id, type, scheduled_at, report
         FROM visits
         WHERE farm_id = (SELECT farm_id FROM product_batches WHERE id = ?)
         ORDER BY COALESCE(scheduled_at, '') ASC, id ASC`
      )
      .all(params.id) as VisitRow[]

    const scanStats = db
      .prepare(
        `SELECT COUNT(*) AS total_scans, MAX(scanned_at) AS last_scan_at
         FROM scans
         WHERE batch_id = ?`
      )
      .get(params.id) as ScanAggregateRow

    const timeline: Array<{ at: string; label: string; detail?: string }> = []

    if (batch.created_at) {
      timeline.push({ at: batch.created_at, label: 'Batch created' })
    }

    for (const visit of visits) {
      timeline.push({
        at: visit.scheduled_at ?? batch.created_at ?? new Date(0).toISOString(),
        label: `Visit: ${visit.type.replaceAll('_', ' ')}`,
        detail: visit.report ?? undefined
      })
    }

    if (scanStats.total_scans > 0 && scanStats.last_scan_at) {
      timeline.push({
        at: scanStats.last_scan_at,
        label: 'Consumer scans',
        detail: `${scanStats.total_scans} total scan(s)`
      })
    }

    timeline.sort((a, b) => a.at.localeCompare(b.at))

    const payload = {
      id: batch.id,
      productName: batch.product_name,
      farmName: batch.farm_name,
      story: batch.story,
      nutrition: batch.nutrition_json ? JSON.parse(batch.nutrition_json) : null,
      createdAt: batch.created_at,
      timeline
    }

    return signTracePayload(payload)
  })
}
