import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'

export type AccessTokenClaims = {
  sub: string
  role: string
  iat?: number
  exp?: number
}

function getAccessTokenSecret(): string {
  const configured = process.env.JWT_ACCESS_SECRET
  if (configured) {
    return configured
  }

  const mode = process.env.NODE_ENV
  if (mode === 'development' || mode === 'test') {
    return 'dev-access-secret-change-me'
  }

  throw new Error('JWT_ACCESS_SECRET must be set outside development/test')
}

function getAccessTokenTtl(): SignOptions['expiresIn'] {
  return (process.env.JWT_ACCESS_TTL ?? '15m') as SignOptions['expiresIn']
}

function getRefreshTokenTtlDays(): number {
  const value = Number(process.env.JWT_REFRESH_TTL_DAYS ?? '30')
  if (!Number.isFinite(value) || value <= 0) {
    return 30
  }
  return value
}

function getTokenIssuer(): string {
  return process.env.JWT_ISSUER ?? 'agrotrace-api'
}

function getTokenAudience(): string {
  return process.env.JWT_AUDIENCE ?? 'agrotrace-client'
}

export function createAccessToken(input: { sub: string; role: string }): string {
  return jwt.sign({ sub: input.sub, role: input.role }, getAccessTokenSecret(), {
    algorithm: 'HS256',
    issuer: getTokenIssuer(),
    audience: getTokenAudience(),
    expiresIn: getAccessTokenTtl()
  })
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
  try {
    const decoded = jwt.verify(token, getAccessTokenSecret(), {
      algorithms: ['HS256'],
      issuer: getTokenIssuer(),
      audience: getTokenAudience()
    })
    if (!decoded || typeof decoded !== 'object') {
      return null
    }

    const sub = decoded.sub
    const role = decoded.role

    if (typeof sub !== 'string' || typeof role !== 'string') {
      return null
    }

    return {
      sub,
      role,
      iat: typeof decoded.iat === 'number' ? decoded.iat : undefined,
      exp: typeof decoded.exp === 'number' ? decoded.exp : undefined
    }
  } catch {
    return null
  }
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url')
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function refreshTokenExpiresAt(): string {
  const expires = new Date()
  expires.setDate(expires.getDate() + getRefreshTokenTtlDays())
  return expires.toISOString()
}
