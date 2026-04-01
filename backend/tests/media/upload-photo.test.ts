import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'

function buildMultipartPayload(boundary: string, options?: { farmId?: string; mimeType?: string }) {
  const chunks: Buffer[] = []
  const push = (value: string | Buffer) => {
    chunks.push(typeof value === 'string' ? Buffer.from(value) : value)
  }

  push(`--${boundary}\r\n`)
  push('Content-Disposition: form-data; name="category"\r\n\r\n')
  push('plants\r\n')

  push(`--${boundary}\r\n`)
  push('Content-Disposition: form-data; name="latitude"\r\n\r\n')
  push('-15.123\r\n')

  push(`--${boundary}\r\n`)
  push('Content-Disposition: form-data; name="longitude"\r\n\r\n')
  push('45.456\r\n')

  if (options?.farmId) {
    push(`--${boundary}\r\n`)
    push('Content-Disposition: form-data; name="farmId"\r\n\r\n')
    push(`${options.farmId}\r\n`)
  }

  push(`--${boundary}\r\n`)
  push('Content-Disposition: form-data; name="photo"; filename="leaf.jpg"\r\n')
  push(`Content-Type: ${options?.mimeType ?? 'image/jpeg'}\r\n\r\n`)
  push(Buffer.from('fake-jpeg-bytes'))
  push('\r\n')

  push(`--${boundary}--\r\n`)
  return Buffer.concat(chunks)
}

function restoreEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

describe('POST /media/photos', () => {
  let app: FastifyInstance
  let accessToken = ''
  const originalNodeEnv = process.env.NODE_ENV
  const originalMinioEnv = {
    endpoint: process.env.MINIO_ENDPOINT,
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    port: process.env.MINIO_PORT,
    useSsl: process.env.MINIO_USE_SSL,
    bucket: process.env.MINIO_BUCKET
  }
  const testDbFile = path.join(os.tmpdir(), `agrotrace-media-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AGROTRACE_DB_FILE = testDbFile
    process.env.JWT_ACCESS_SECRET = 'test-access-secret'
    process.env.JWT_ACCESS_TTL = '15m'
    delete process.env.MINIO_ENDPOINT
    delete process.env.MINIO_ACCESS_KEY
    delete process.env.MINIO_SECRET_KEY
    delete process.env.MINIO_PORT
    delete process.env.MINIO_USE_SSL
    delete process.env.MINIO_BUCKET

    const { buildApp } = await import('../../src/app.js')
    app = await buildApp()

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Media Tester',
        email: 'media.tester@example.com',
        password: 'Password123!',
        role: 'farmer'
      }
    })

    expect(registerResponse.statusCode).toBe(201)
    accessToken = registerResponse.json().accessToken as string
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    delete process.env.AGROTRACE_DB_FILE
    delete process.env.JWT_ACCESS_SECRET
    delete process.env.JWT_ACCESS_TTL
    process.env.NODE_ENV = originalNodeEnv
    restoreEnvValue('MINIO_ENDPOINT', originalMinioEnv.endpoint)
    restoreEnvValue('MINIO_ACCESS_KEY', originalMinioEnv.accessKey)
    restoreEnvValue('MINIO_SECRET_KEY', originalMinioEnv.secretKey)
    restoreEnvValue('MINIO_PORT', originalMinioEnv.port)
    restoreEnvValue('MINIO_USE_SSL', originalMinioEnv.useSsl)
    restoreEnvValue('MINIO_BUCKET', originalMinioEnv.bucket)
  })

  it('uploads a photo and returns asset id + object key', async () => {
    const boundary = `----agrotrace-boundary-${Date.now()}`
    const payload = buildMultipartPayload(boundary)

    const response = await app.inject({
      method: 'POST',
      url: '/media/photos',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        objectKey: expect.any(String)
      })
    )
  })

  it('returns 404 when farmId does not exist', async () => {
    const boundary = `----agrotrace-boundary-${Date.now()}`
    const payload = buildMultipartPayload(boundary, { farmId: 'missing-farm-id' })

    const response = await app.inject({
      method: 'POST',
      url: '/media/photos',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    })

    expect(response.statusCode).toBe(404)
  })
})
