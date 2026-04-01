import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
const postgresUrl = databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) ? databaseUrl : undefined

async function canConnect(url: string): Promise<boolean> {
  const sql = postgres(url, { max: 1, connect_timeout: 2 })
  try {
    await sql`select 1`
    return true
  } catch {
    return false
  } finally {
    await sql.end({ timeout: 1 })
  }
}

const databaseReady = postgresUrl ? await canConnect(postgresUrl) : false
const describeIfDatabase = databaseReady ? describe : describe.skip

describeIfDatabase('users repository (postgres)', () => {
  it('creates and reads a user record via drizzle', async () => {
    const { createPostgresClient, createDrizzleDb, createUsersRepository } = await import('../../src/db/client.js')
    const { migrateDbFoundation } = await import('../../src/db/migrate.js')

    const client = createPostgresClient({ connectionString: postgresUrl as string })

    try {
      const db = createDrizzleDb(client)
      await migrateDbFoundation(db)

      const usersRepository = createUsersRepository(db)
      const userId = randomUUID()
      await usersRepository.create({ id: userId, name: 'Test Farmer', role: 'farmer', locale: 'en' })

      const found = await usersRepository.findById(userId)
      expect(found).toEqual(expect.objectContaining({
        id: userId,
        name: 'Test Farmer',
        role: 'farmer',
        locale: 'en'
      }))
      expect(found?.createdAt).toBeDefined()
    } finally {
      await client.end({ timeout: 1 })
    }
  })
})

describe('users repository (postgres)', () => {
  it.skipIf(databaseReady)('skips integration when postgres is unavailable', () => {
    expect(databaseReady).toBe(false)
  })
})
