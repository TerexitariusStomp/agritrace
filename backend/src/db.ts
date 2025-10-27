import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const dbPath = path.resolve(process.cwd(), 'backend', 'data')
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true })
const dbFile = path.join(dbPath, 'agrotrace.db')

export const db = new Database(dbFile)

// Enable foreign keys
db.exec('PRAGMA foreign_keys = ON;')

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('farmer','evaluator','manager','consumer')),
      locale TEXT DEFAULT 'en'
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT,
      latitude REAL,
      longitude REAL
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location_id TEXT,
      FOREIGN KEY(location_id) REFERENCES locations(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS subgroups (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_members (
      user_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('member','lead','manager')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      PRIMARY KEY(user_id, group_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS committees (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ethics')),
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS committee_members (
      committee_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      domain TEXT NOT NULL CHECK(domain IN ('agricultural','outsider')),
      PRIMARY KEY(committee_id, user_id),
      FOREIGN KEY(committee_id) REFERENCES committees(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ethics','peer_evaluation','surprise')),
      scheduled_at TEXT,
      lead_user_id TEXT,
      plan TEXT,
      rubric_json TEXT,
      report TEXT,
      FOREIGN KEY(farm_id) REFERENCES farms(id) ON DELETE CASCADE,
      FOREIGN KEY(lead_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      farm_id TEXT,
      visit_id TEXT,
      category TEXT NOT NULL CHECK(category IN ('people','tools','plants','place_before','place_after')),
      file_path TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      species TEXT,
      captured_at TEXT,
      FOREIGN KEY(farm_id) REFERENCES farms(id) ON DELETE SET NULL,
      FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS voice_notes (
      id TEXT PRIMARY KEY,
      farm_id TEXT,
      visit_id TEXT,
      file_path TEXT NOT NULL,
      language TEXT,
      transcript TEXT,
      recorded_at TEXT,
      FOREIGN KEY(farm_id) REFERENCES farms(id) ON DELETE SET NULL,
      FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS planting_events (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      species TEXT,
      count INTEGER,
      planted_at TEXT NOT NULL,
      FOREIGN KEY(farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      farm_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      story TEXT,
      nutrition_json TEXT,
      qr_value TEXT,
      created_at TEXT,
      FOREIGN KEY(farm_id) REFERENCES farms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      scanned_at TEXT,
      distance_km REAL,
      FOREIGN KEY(batch_id) REFERENCES product_batches(id) ON DELETE CASCADE
    );
  `)
}

