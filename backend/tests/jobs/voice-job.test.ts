import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'

function buildVoiceMultipartPayload(boundary: string): Buffer {
  const chunks: Buffer[] = []
  const push = (value: string | Buffer) => {
    chunks.push(typeof value === 'string' ? Buffer.from(value) : value)
  }

  push(`--${boundary}\r\n`)
  push('Content-Disposition: form-data; name="language"\r\n\r\n')
  push('pt\r\n')

  push(`--${boundary}\r\n`)
  push('Content-Disposition: form-data; name="voice"; filename="note.wav"\r\n')
  push('Content-Type: audio/wav\r\n\r\n')
  push(Buffer.from('fake-audio-bytes'))
  push('\r\n')

  push(`--${boundary}--\r\n`)
  return Buffer.concat(chunks)
}

describe('voice transcription queue jobs', () => {
  let app: FastifyInstance
  const originalNodeEnv = process.env.NODE_ENV
  const originalRedisUrl = process.env.REDIS_URL
  const testDbFile = path.join(os.tmpdir(), `agrotrace-voice-jobs-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.REDIS_URL = 'redis://127.0.0.1:0'
    process.env.AGROTRACE_DB_FILE = testDbFile

    const { buildApp } = await import('../../src/app.js')
    app = await buildApp()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    delete process.env.AGROTRACE_DB_FILE
    if (originalRedisUrl === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = originalRedisUrl
    }
    process.env.NODE_ENV = originalNodeEnv
  })

  it('enqueues and processes transcription job, then persists transcript', async () => {
    const boundary = `----agrotrace-voice-boundary-${Date.now()}`
    const payload = buildVoiceMultipartPayload(boundary)

    const response = await app.inject({
      method: 'POST',
      url: '/voice-notes',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    })

    expect(response.statusCode).toBe(200)
    const body = response.json() as { id: string }

    const { runWorkerOnce } = await import('../../src/jobs/worker.js')
    const processed = await runWorkerOnce()

    expect(processed).toBe(true)

    const { db } = await import('../../src/db.js')
    const voiceNote = db
      .prepare('SELECT transcript FROM voice_notes WHERE id = ? LIMIT 1')
      .get(body.id) as { transcript: string | null } | undefined
    const job = db
      .prepare('SELECT status, attempts FROM ai_jobs WHERE entity_id = ? AND type = ? LIMIT 1')
      .get(body.id, 'transcribe') as { status: string; attempts: number } | undefined

    expect(voiceNote?.transcript).toBe('[transcribed:pt] note.wav')
    expect(job).toEqual({ status: 'completed', attempts: 1 })
  })

  it('processes queued jobs directly from DB when queue broker is unavailable', async () => {
    const now = new Date().toISOString()
    const voiceNoteId = `voice-${Date.now()}`
    const jobId = `job-${Date.now()}`
    const { db } = await import('../../src/db.js')

    db.prepare(
      'INSERT INTO voice_notes (id, file_path, language, transcript, recorded_at) VALUES (?, ?, ?, ?, ?)'
    ).run(voiceNoteId, '/tmp/manual.wav', 'en', '[queued transcription en]', now)

    db.prepare(
      `INSERT INTO ai_jobs (id, type, entity_id, payload_json, status, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'queued', 0, ?, ?)`
    ).run(jobId, 'transcribe', voiceNoteId, JSON.stringify({ voiceNoteId }), now, now)

    const { runWorkerOnce } = await import('../../src/jobs/worker.js')
    const processed = await runWorkerOnce()

    expect(processed).toBe(true)

    const voiceNote = db
      .prepare('SELECT transcript FROM voice_notes WHERE id = ? LIMIT 1')
      .get(voiceNoteId) as { transcript: string | null } | undefined
    const job = db
      .prepare('SELECT status, attempts FROM ai_jobs WHERE id = ? LIMIT 1')
      .get(jobId) as { status: string; attempts: number } | undefined

    expect(voiceNote?.transcript).toBe('[transcribed:en] manual.wav')
    expect(job).toEqual({ status: 'completed', attempts: 1 })
  })
})
