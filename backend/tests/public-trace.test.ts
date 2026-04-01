import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'
import { verifyTraceEnvelope } from '../src/trace/signature.js'

const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDYic3BFKRiGxtN
JljjwccKoJ8754E+TlT34CHTrSsFH8Ep+Yg5KT/shQfgAOImnbp01zqd12pFBxv6
73VSxAHKCJ8KZH/lXF25KyyaF/EvcIZ0/gf3t/HPbK0F/Tq9qTtrYKgVA36GdLUo
mJAisgqQ4Z2Xlu6BjRMr7ye9SY8zBxjbblXYTHviVk6dCzxzc47RNpY/3IDLAebP
utR6l5wP21oWvJhRPAhakJC6TfYfs/t8VCjBp6NSJX5nbVhalrfZzp925Mglr4xv
ete2hApVfcJ98GAy1F6W0rCRhbPp3nBoNbAmDRvWHsZ3Jmg7vGpnYHHdTMHpA4wb
Y2ExJlJbAgMBAAECggEASclLb4vVKAkMmJGEoLebV6e8GvGcPNr8YSri2/qaOjjD
3cXGAZRoz/PU5yPl7Dq7Gq1sr/SDpdnyUuPeGsHnyix95VCxtDpxRXPM0wVtjjjN
2HfnxyXLJF9n5i6QIajVMpXRMLfsGW0Tfi3ej7QTnaMDzHAF/edQrRvlcr7qKPyV
jnUjuYfh8cYxOGLjyskCRXdDZDIKMKD3YnAbSyStmGoXWekSvQ1ncrWe0To5U2G9
aeMCZ9Y9DSin0gJj2v3BU7N9etBYRrvX7DUl6r5ZRXeNfB4jTgQPmCvwAjYt+Dhn
CA7L8RIzD2KLvcjZQUE2+MlsgBZi6FUn7sa3Oa6UAQKBgQD0QsKKGLSvRzInr3w3
emGxV7MCizCf6VCZtJjHiQzS4zUDuZ8Fiu88cDbX9btA/YMjASPgn0ulxAx+9eo2
AClJ6xbGa9EzV+xpW1oFWaOAdgBKbnKZPru2D+eD3tqN7d9gCZ6Px11R509TKud2
QUWZmE6SLVEaf5fK0Ha6H2Tb2wKBgQDi8fZ3WO535UjkaS2roZJ42AAa7xKEXVLA
S/kJppJvVbzyIMR4+wekzRVtrE39YVd9shID3yF4ofp+eQ1/pjRuDajukWgCCY3H
aruwwOFo3FEYRr/EVo0P1Q7wMUpw+SBQ+MZPR41OM7Ww1FUOwBB31IWX3RHbyomx
v8ZL0P1rgQKBgD82B6I1Qo0Zn6EliL/Sq/V4/Jpr6ul3N6SPV/pLPUZWBiIwpzaH
/eFmKMs6jHsFICqu4NoAX1NGqPUyLqpK4GSAsiQnQrxGxKd/PIyl5eoYn3qjmoSN
94XmF8PIqEaSiHwSATa0ITJQ6fZb5Ap2Wcyl3a92isaQvnd9+zuvZCqBAoGAc440
qwxzUEVFWlhb0tqQVEvXsd8tlIxYSGXmxo00XtBPRxJ8OAXKHJX4ZUGo7G2WOQBk
v+friRshCyjkQK0GYUs/S0pqpS7sLDAipZtwqw4TlMLhfj170iXwV0kh2Ghhlhk2
EMQkJT+bMhDLxpjxSbLC21LLdxioCAPYGl6tywECgYEAlAQVNYRn79WoWYmcLCH2
BI/Z8bAJXShrUts0bSSApnLVLfUPJr1HjISe/+u5mJkCLAaFgi1/N2Xeg72rHUxO
6oOzAxxJ0RBu6s1B055229OM/ZC5j9Fclt5oUwWUf3XIYjRVxu/7n0sRnjUr3LrE
G8uwb8tylDnHCy9InfR2NIE=
-----END PRIVATE KEY-----`

const TEST_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2InNwRSkYhsbTSZY48HH
CqCfO+eBPk5U9+Ah060rBR/BKfmIOSk/7IUH4ADiJp26dNc6nddqRQcb+u91UsQB
ygifCmR/5VxduSssmhfxL3CGdP4H97fxz2ytBf06vak7a2CoFQN+hnS1KJiQIrIK
kOGdl5bugY0TK+8nvUmPMwcY225V2Ex74lZOnQs8c3OO0TaWP9yAywHmz7rUepec
D9taFryYUTwIWpCQuk32H7P7fFQowaejUiV+Z21YWpa32c6fduTIJa+Mb3rXtoQK
VX3CffBgMtReltKwkYWz6d5waDWwJg0b1h7GdyZoO7xqZ2Bx3UzB6QOMG2NhMSZS
WwIDAQAB
-----END PUBLIC KEY-----`

describe('GET /public/trace/:id', () => {
  let app: FastifyInstance
  const originalNodeEnv = process.env.NODE_ENV
  const testDbFile = path.join(os.tmpdir(), `agrotrace-public-trace-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AGROTRACE_DB_FILE = testDbFile
    process.env.TRACE_SIGNING_PRIVATE_KEY_PEM = TEST_PRIVATE_KEY
    process.env.TRACE_SIGNING_PUBLIC_KEY_PEM = TEST_PUBLIC_KEY

    const { buildApp } = await import('../src/app.js')
    app = await buildApp()

    const { db } = await import('../src/db.js')
    db.prepare('INSERT INTO groups (id, name, location_id) VALUES (?, ?, ?)').run('group-1', 'North Cooperative', null)
    db.prepare('INSERT INTO farms (id, group_id, name, latitude, longitude) VALUES (?, ?, ?, ?, ?)').run(
      'farm-1',
      'group-1',
      'Farm Alpha',
      -8.75,
      13.25
    )
    db.prepare(
      'INSERT INTO product_batches (id, farm_id, product_name, story, nutrition_json, qr_value, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      'batch-123',
      'farm-1',
      'Cassava Flour',
      'Harvested and packed by local members',
      JSON.stringify({ calories: 120 }),
      'agrotrace:batch:batch-123',
      '2026-03-29T10:00:00.000Z'
    )
    db.prepare('INSERT INTO visits (id, farm_id, type, scheduled_at, plan, report) VALUES (?, ?, ?, ?, ?, ?)').run(
      'visit-1',
      'farm-1',
      'peer_evaluation',
      '2026-03-28T09:00:00.000Z',
      'Inspect post-harvest process',
      'Process compliant with checklist'
    )
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    delete process.env.AGROTRACE_DB_FILE
    delete process.env.TRACE_SIGNING_PRIVATE_KEY_PEM
    delete process.env.TRACE_SIGNING_PUBLIC_KEY_PEM
    process.env.NODE_ENV = originalNodeEnv
  })

  it('returns signed provenance payload', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/trace/batch-123' })

    expect(response.statusCode).toBe(200)
    const body = response.json() as {
      payload: { id: string; productName: string; timeline: Array<{ label: string }> }
      signature: string
      publicKeyPem: string
      algorithm: string
    }

    expect(body.payload.id).toBe('batch-123')
    expect(body.payload.productName).toBe('Cassava Flour')
    expect(body.payload.timeline.length).toBeGreaterThan(0)
    expect(verifyTraceEnvelope(body)).toBe(true)
  })

  it('returns 404 for unknown batch id', async () => {
    const response = await app.inject({ method: 'GET', url: '/public/trace/missing-batch' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'Trace record not found' })
  })
})
