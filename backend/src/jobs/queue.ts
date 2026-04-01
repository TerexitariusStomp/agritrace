import { randomUUID } from 'node:crypto'
import { createClient } from 'redis'
import { db } from '../db.js'

export type AiJobType = 'transcribe' | 'plant_id'

type TranscribePayload = {
  voiceNoteId: string
}

type PlantIdPayload = {
  photoId: string
}

type JobPayload = TranscribePayload | PlantIdPayload

type EnqueueJobInput = {
  type: AiJobType
  entityId: string
  payload: JobPayload
}

const JOB_QUEUE_KEY = 'agrotrace:ai-jobs'

let redisClientPromise: Promise<ReturnType<typeof createClient> | null> | null = null
let redisDisabledUntilMs = 0

function nowIso(): string {
  return new Date().toISOString()
}

async function getRedisClient(): Promise<ReturnType<typeof createClient> | null> {
  const redisUrl = process.env.REDIS_URL?.trim()
  if (!redisUrl) {
    return null
  }

  if (Date.now() < redisDisabledUntilMs) {
    return null
  }

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({
        url: redisUrl,
        socket: {
          connectTimeout: 250,
          reconnectStrategy: () => false
        }
      })
      try {
        await client.connect()
        return client
      } catch {
        redisDisabledUntilMs = Date.now() + 5_000
        try {
          await client.disconnect()
        } catch {
          // no-op
        }
        return null
      }
    })()
  }

  const client = await redisClientPromise
  if (!client) {
    redisClientPromise = null
  }
  return client
}

async function disableRedisClient(): Promise<void> {
  redisDisabledUntilMs = Date.now() + 5_000
  const current = redisClientPromise
  redisClientPromise = null
  if (!current) {
    return
  }
  const client = await current
  if (client) {
    try {
      await client.disconnect()
    } catch {
      // no-op
    }
  }
}

export async function enqueueAiJob(input: EnqueueJobInput): Promise<string> {
  const id = randomUUID()
  const timestamp = nowIso()

  db.prepare(
    `INSERT INTO ai_jobs
      (id, type, entity_id, payload_json, status, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'queued', 0, ?, ?)`
  ).run(id, input.type, input.entityId, JSON.stringify(input.payload), timestamp, timestamp)

  const redisClient = await getRedisClient()
  if (redisClient) {
    try {
      await redisClient.rPush(JOB_QUEUE_KEY, id)
    } catch {
      await disableRedisClient()
    }
  }

  return id
}

export async function enqueueTranscriptionJob(voiceNoteId: string): Promise<string> {
  return enqueueAiJob({
    type: 'transcribe',
    entityId: voiceNoteId,
    payload: { voiceNoteId }
  })
}

export async function dequeueAiJobId(): Promise<string | null> {
  const redisClient = await getRedisClient()
  if (redisClient) {
    try {
      const jobId = await redisClient.lPop(JOB_QUEUE_KEY)
      if (jobId) {
        return jobId
      }
    } catch {
      await disableRedisClient()
    }
  }

  return null
}
