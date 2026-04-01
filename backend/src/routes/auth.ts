import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { hashPassword, verifyPassword } from '../auth/hash.js'
import {
  createAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt
} from '../auth/tokens.js'
import { db } from '../db.js'

type IdentityUserRow = {
  id: string
  name: string
  role: 'farmer' | 'evaluator' | 'manager' | 'consumer'
  locale: string
  email: string
  password_hash: string
}

function getIdentityUserByEmail(email: string): IdentityUserRow | undefined {
  return db
    .prepare(
      `SELECT u.id, u.name, u.role, u.locale, ai.email, ai.password_hash
       FROM auth_identities ai
       JOIN users u ON u.id = ai.user_id
       WHERE ai.email = ?
       LIMIT 1`
    )
    .get(email) as IdentityUserRow | undefined
}

function issueRefreshToken(input: { userId: string; userAgent: string | null; ipAddress: string | null }) {
  const refreshToken = generateRefreshToken()
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const refreshTokenId = randomUUID()

  db.prepare(
    `INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    refreshTokenId,
    input.userId,
    refreshTokenHash,
    refreshTokenExpiresAt(),
    input.userAgent,
    input.ipAddress
  )

  return refreshToken
}

export async function registerAuthRoutes(server: FastifyInstance): Promise<void> {
  server.post('/auth/register', async (req, reply) => {
    const bodyResult = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(['farmer', 'evaluator', 'manager', 'consumer']).default('consumer'),
        locale: z.string().default('en')
      })
      .safeParse(req.body)

    if (!bodyResult.success) {
      return reply.status(400).send({ error: 'Invalid request payload' })
    }

    const body = bodyResult.data

    const normalizedEmail = body.email.trim().toLowerCase()
    const existing = getIdentityUserByEmail(normalizedEmail)
    if (existing) {
      return reply.status(409).send({ error: 'Email already registered' })
    }

    const userId = randomUUID()
    const passwordHash = await hashPassword(body.password)

    const createUser = db.transaction(() => {
      db.prepare('INSERT INTO users (id,name,role,locale) VALUES (?,?,?,?)').run(userId, body.name, body.role, body.locale)
      db.prepare('INSERT INTO auth_identities (user_id,email,password_hash) VALUES (?,?,?)').run(
        userId,
        normalizedEmail,
        passwordHash
      )
    })
    try {
      createUser()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('UNIQUE constraint failed: auth_identities.email')) {
        return reply.status(409).send({ error: 'Email already registered' })
      }
      throw error
    }

    const refreshToken = issueRefreshToken({
      userId,
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null
    })

    const accessToken = createAccessToken({ sub: userId, role: body.role })

    return reply.status(201).send({
      user: { id: userId, name: body.name, email: normalizedEmail, role: body.role, locale: body.locale },
      accessToken,
      refreshToken
    })
  })

  server.post('/auth/login', async (req, reply) => {
    const bodyResult = z
      .object({
        email: z.string().email(),
        password: z.string().min(1)
      })
      .safeParse(req.body)

    if (!bodyResult.success) {
      return reply.status(400).send({ error: 'Invalid request payload' })
    }

    const body = bodyResult.data

    const normalizedEmail = body.email.trim().toLowerCase()
    const user = getIdentityUserByEmail(normalizedEmail)
    if (!user) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const passwordValid = await verifyPassword(user.password_hash, body.password)
    if (!passwordValid) {
      return reply.status(401).send({ error: 'Invalid credentials' })
    }

    const refreshToken = issueRefreshToken({
      userId: user.id,
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null
    })

    const accessToken = createAccessToken({ sub: user.id, role: user.role })

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, locale: user.locale },
      accessToken,
      refreshToken
    }
  })

  server.post('/auth/refresh', async (req, reply) => {
    const bodyResult = z
      .object({
        refreshToken: z.string().min(20)
      })
      .safeParse(req.body)

    if (!bodyResult.success) {
      return reply.status(400).send({ error: 'Invalid request payload' })
    }

    const body = bodyResult.data

    const tokenHash = hashRefreshToken(body.refreshToken)
    const existing = db
      .prepare(
        `SELECT rt.id, rt.user_id, rt.expires_at, rt.used_at, rt.revoked_at, u.role
         FROM auth_refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
         WHERE rt.token_hash = ?
         LIMIT 1`
      )
      .get(tokenHash) as
      | {
          id: string
          user_id: string
          expires_at: string
          used_at: string | null
          revoked_at: string | null
          role: 'farmer' | 'evaluator' | 'manager' | 'consumer'
        }
      | undefined

    if (!existing) {
      return reply.status(401).send({ error: 'Invalid refresh token' })
    }

    const now = new Date().toISOString()
    const isExpired = new Date(existing.expires_at).getTime() <= Date.now()

    if (existing.used_at || existing.revoked_at || isExpired) {
      db.prepare('UPDATE auth_refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').run(
        now,
        existing.user_id
      )
      return reply.status(401).send({ error: 'Refresh token is no longer valid' })
    }

    const newRefreshToken = generateRefreshToken()
    const newRefreshTokenHash = hashRefreshToken(newRefreshToken)
    const newRefreshTokenId = randomUUID()

    const rotateToken = db.transaction(() => {
      db.prepare(
        `INSERT INTO auth_refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip_address)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        newRefreshTokenId,
        existing.user_id,
        newRefreshTokenHash,
        refreshTokenExpiresAt(),
        req.headers['user-agent'] ?? null,
        req.ip ?? null
      )

      const result = db
        .prepare(
          `UPDATE auth_refresh_tokens
           SET used_at = ?, revoked_at = ?, replaced_by_token_id = ?
           WHERE id = ? AND used_at IS NULL AND revoked_at IS NULL`
        )
        .run(now, now, newRefreshTokenId, existing.id)

      if (result.changes !== 1) {
        throw new Error('Refresh token already rotated')
      }
    })

    try {
      rotateToken()
    } catch {
      return reply.status(401).send({ error: 'Refresh token is no longer valid' })
    }

    const accessToken = createAccessToken({ sub: existing.user_id, role: existing.role })

    return {
      accessToken,
      refreshToken: newRefreshToken
    }
  })
}
