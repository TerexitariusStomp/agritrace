import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'

describe('GET /health', () => {
  let app: FastifyInstance
  const originalNodeEnv = process.env.NODE_ENV
  const testDbFile = path.join(os.tmpdir(), `agrotrace-health-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AGROTRACE_DB_FILE = testDbFile
    const { buildApp } = await import('../src/app.js')
    app = await buildApp()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    delete process.env.AGROTRACE_DB_FILE
    process.env.NODE_ENV = originalNodeEnv
  })

  it('returns ok true', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ ok: true })
  })
})
