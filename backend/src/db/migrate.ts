import { sql } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { createDrizzleDb, createPostgresClient, type AgrotraceDb } from './client.js'

export async function migrateDbFoundation(db: AgrotraceDb): Promise<void> {
  await db.execute(sql`
    DO $$
    BEGIN
      CREATE TYPE user_role AS ENUM ('farmer', 'evaluator', 'manager', 'consumer');
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$;
  `)

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      name text NOT NULL,
      role user_role NOT NULL,
      locale text NOT NULL DEFAULT 'en',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)
}

export async function initializePostgresFoundation(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    return
  }

  if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    return
  }

  const client = createPostgresClient({ connectionString: databaseUrl })

  try {
    const db = createDrizzleDb(client)
    await migrateDbFoundation(db)
  } finally {
    await client.end({ timeout: 1 })
  }
}

const executedFile = process.argv[1] ? pathToFileURL(process.argv[1]).href : ''

if (import.meta.url === executedFile) {
  initializePostgresFoundation()
    .then(() => {
      console.log('PostgreSQL foundation migration complete')
    })
    .catch((error) => {
      console.error('PostgreSQL foundation migration failed', error)
      process.exit(1)
    })
}
