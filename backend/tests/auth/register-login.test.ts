import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import os from 'node:os'
import path from 'node:path'

describe('auth register/login/refresh flow', () => {
  let app: FastifyInstance
  const originalNodeEnv = process.env.NODE_ENV
  const testDbFile = path.join(os.tmpdir(), `agrotrace-auth-${Date.now()}.db`)

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.AGROTRACE_DB_FILE = testDbFile
    process.env.JWT_ACCESS_SECRET = 'test-access-secret'
    process.env.JWT_ACCESS_TTL = '15m'

    const { buildApp } = await import('../../src/app.js')
    app = await buildApp()
  })

  afterAll(async () => {
    if (app) {
      await app.close()
    }
    delete process.env.AGROTRACE_DB_FILE
    delete process.env.JWT_ACCESS_SECRET
    delete process.env.JWT_ACCESS_TTL
    process.env.NODE_ENV = originalNodeEnv
  })

  it('registers, logs in, reads /me, and rotates refresh tokens', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Alice Farmer',
        email: 'alice@example.com',
        password: 'Password123!',
        role: 'farmer'
      }
    })

    expect(registerResponse.statusCode).toBe(201)
    const registerBody = registerResponse.json()
    expect(registerBody.user.email).toBe('alice@example.com')
    expect(typeof registerBody.accessToken).toBe('string')
    expect(typeof registerBody.refreshToken).toBe('string')

    const meResponse = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${registerBody.accessToken}`
      }
    })

    expect(meResponse.statusCode).toBe(200)
    expect(meResponse.json().user).toEqual(
      expect.objectContaining({
        email: 'alice@example.com',
        role: 'farmer'
      })
    )

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'alice@example.com',
        password: 'Password123!'
      }
    })

    expect(loginResponse.statusCode).toBe(200)
    const loginBody = loginResponse.json()
    expect(typeof loginBody.refreshToken).toBe('string')

    const refresh1Response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: loginBody.refreshToken }
    })

    expect(refresh1Response.statusCode).toBe(200)
    const refresh1Body = refresh1Response.json()
    expect(typeof refresh1Body.accessToken).toBe('string')
    expect(typeof refresh1Body.refreshToken).toBe('string')
    expect(refresh1Body.refreshToken).not.toBe(loginBody.refreshToken)

    const replayOldRefresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: loginBody.refreshToken }
    })

    expect(replayOldRefresh.statusCode).toBe(401)

    const refresh2Response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: refresh1Body.refreshToken }
    })

    expect(refresh2Response.statusCode).toBe(401)
  })

  it('rejects invalid auth and refresh requests', async () => {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: 'Bob Evaluator',
        email: 'bob@example.com',
        password: 'Password123!',
        role: 'evaluator'
      }
    })

    expect(registerResponse.statusCode).toBe(201)

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'bob@example.com',
        password: 'WrongPassword!'
      }
    })

    expect(wrongPassword.statusCode).toBe(401)

    const missingBearer = await app.inject({
      method: 'GET',
      url: '/me'
    })
    expect(missingBearer.statusCode).toBe(401)

    const invalidBearer = await app.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: 'Bearer not-a-real-token'
      }
    })
    expect(invalidBearer.statusCode).toBe(401)

    const invalidRefreshToken = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {
        refreshToken: `${'x'.repeat(24)}${Date.now()}`
      }
    })
    expect(invalidRefreshToken.statusCode).toBe(401)
  })

  it('rejects duplicate registration with 409', async () => {
    const payload = {
      name: 'Duplicate User',
      email: 'duplicate@example.com',
      password: 'Password123!',
      role: 'consumer'
    }

    const first = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload
    })
    expect(first.statusCode).toBe(201)

    const second = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload
    })
    expect(second.statusCode).toBe(409)
  })

  it('returns 400 for malformed auth payloads', async () => {
    const badRegister = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        name: '',
        email: 'not-an-email',
        password: 'short'
      }
    })
    expect(badRegister.statusCode).toBe(400)

    const badLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'still-not-email',
        password: ''
      }
    })
    expect(badLogin.statusCode).toBe(400)

    const badRefresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {
        refreshToken: 'tiny'
      }
    })
    expect(badRefresh.statusCode).toBe(400)
  })
})
