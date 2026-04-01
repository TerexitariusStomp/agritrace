import type { FastifyInstance } from 'fastify'
import { verifyAccessToken } from '../auth/tokens.js'
import { db } from '../db.js'

type MeRow = {
  id: string
  name: string
  role: 'farmer' | 'evaluator' | 'manager' | 'consumer'
  locale: string
  email: string | null
}

export async function registerMeRoutes(server: FastifyInstance): Promise<void> {
  server.get('/me', async (req, reply) => {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing bearer token' })
    }

    const token = authHeader.slice('Bearer '.length).trim()
    const claims = verifyAccessToken(token)
    if (!claims) {
      return reply.status(401).send({ error: 'Invalid access token' })
    }

    const user = db
      .prepare(
        `SELECT u.id, u.name, u.role, u.locale, ai.email
         FROM users u
         LEFT JOIN auth_identities ai ON ai.user_id = u.id
         WHERE u.id = ?
         LIMIT 1`
      )
      .get(claims.sub) as MeRow | undefined

    if (!user) {
      return reply.status(404).send({ error: 'User not found' })
    }

    return { user }
  })
}
