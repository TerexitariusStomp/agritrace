import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { verifyAccessToken } from '../auth/tokens.js'
import { db } from '../db.js'
import { buildPhotoObjectKey, getMediaStorage } from '../storage/minio.js'

type MultipartRequest = FastifyRequest & {
  file: () => Promise<any>
}

const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function nowIso(): string {
  return new Date().toISOString()
}

function requireAccessToken(req: FastifyRequest): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const claims = verifyAccessToken(token)
  return claims ? claims.sub : null
}

export async function registerMediaRoutes(server: FastifyInstance): Promise<void> {
  const uploadPhotoHandler = async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = requireAccessToken(req)
    if (!userId) {
      return reply.status(401).send({ error: 'Invalid access token' })
    }

    const mp = await (req as MultipartRequest).file()
    if (!mp) {
      return reply.status(400).send({ error: 'No file uploaded' })
    }

    const fields = mp.fields as Record<string, { value: unknown }>
    const parsed = z
      .object({
        category: z.enum(['people', 'tools', 'plants', 'place_before', 'place_after']),
        farmId: z.string().optional(),
        visitId: z.string().optional(),
        latitude: z.coerce.number().optional(),
        longitude: z.coerce.number().optional()
      })
      .safeParse(
        Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [key, value?.value])
        )
      )

    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid media metadata' })
    }

    const mimeType = (mp.mimetype ?? '').trim()
    if (!mimeType) {
      return reply.status(400).send({ error: 'Missing file mime type' })
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return reply.status(400).send({ error: 'Unsupported media type' })
    }

    if (parsed.data.farmId) {
      const farm = db.prepare('SELECT id FROM farms WHERE id = ? LIMIT 1').get(parsed.data.farmId) as { id: string } | undefined
      if (!farm) {
        return reply.status(404).send({ error: 'Farm not found' })
      }
    }

    if (parsed.data.visitId) {
      const visit = db.prepare('SELECT id FROM visits WHERE id = ? LIMIT 1').get(parsed.data.visitId) as { id: string } | undefined
      if (!visit) {
        return reply.status(404).send({ error: 'Visit not found' })
      }
    }

    const body = await mp.toBuffer()
    if (body.byteLength > MAX_MEDIA_SIZE_BYTES) {
      return reply.status(413).send({ error: 'Uploaded file too large' })
    }

    const id = randomUUID()
    const createdAt = nowIso()
    const storage = getMediaStorage()
    const objectKey = buildPhotoObjectKey({
      category: parsed.data.category,
      id,
      filename: mp.filename ?? 'upload.bin'
    })

    const stored = await storage.adapter.putObject({
      bucket: storage.bucket,
      objectKey,
      body,
      contentType: mimeType
    })

    try {
      db.prepare(
        `INSERT INTO media_assets
        (id, bucket, object_key, mime_type, category, created_at, farm_id, visit_id, latitude, longitude, uploaded_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        stored.bucket,
        stored.objectKey,
        mimeType,
        parsed.data.category,
        createdAt,
        parsed.data.farmId ?? null,
        parsed.data.visitId ?? null,
        parsed.data.latitude ?? null,
        parsed.data.longitude ?? null,
        userId
      )
    } catch (error) {
      await storage.adapter.deleteObject({
        bucket: stored.bucket,
        objectKey: stored.objectKey
      }).catch(() => undefined)

      const message = error instanceof Error ? error.message : ''
      if (message.includes('FOREIGN KEY constraint failed')) {
        return reply.status(400).send({ error: 'Invalid media relationship' })
      }
      throw error
    }

    return reply.status(201).send({
      id,
      bucket: stored.bucket,
      objectKey: stored.objectKey,
      filePath: stored.objectKey,
      mimeType,
      category: parsed.data.category,
      createdAt,
      provider: storage.provider
    })
  }

  server.post('/media/photos', async (req, reply) => uploadPhotoHandler(req, reply))
  server.post('/photos', async (req, reply) => uploadPhotoHandler(req, reply))
}
