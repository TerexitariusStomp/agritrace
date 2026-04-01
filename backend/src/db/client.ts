import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { type Sql } from 'postgres'
import { users, type NewUser } from './schema.js'

export type AgrotracePgClient = Sql<Record<string, unknown>>

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required for PostgreSQL operations')
  }
  return url
}

export function createPostgresClient(options?: { connectionString?: string }): AgrotracePgClient {
  const connectionString = options?.connectionString ?? getDatabaseUrl()
  return postgres(connectionString, {
    max: 1
  })
}

export function createDrizzleDb(client: AgrotracePgClient = createPostgresClient()) {
  return drizzle(client, {
    schema: { users }
  })
}

export type AgrotraceDb = ReturnType<typeof createDrizzleDb>

export function createUsersRepository(db: AgrotraceDb) {
  return {
    async create(input: NewUser) {
      await db.insert(users).values(input)
      const created = await this.findById(input.id)
      if (!created) {
        throw new Error(`Failed to fetch created user: ${input.id}`)
      }
      return created
    },
    async findById(id: string) {
      const rows = await db.select().from(users).where(eq(users.id, id)).limit(1)
      return rows[0] ?? null
    }
  }
}
