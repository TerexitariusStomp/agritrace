import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const srcDir = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(srcDir, '..')
const dbPath = path.join(backendRoot, 'data')
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true })
const configuredDbFile = process.env.AGROTRACE_DB_FILE
const dbFile = configuredDbFile ? path.resolve(configuredDbFile) : path.join(dbPath, 'agrotrace.db')
const dbDir = path.dirname(dbFile)
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

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

    CREATE TABLE IF NOT EXISTS ai_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('transcribe','plant_id')),
      entity_id TEXT,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('queued','processing','completed','failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_created ON ai_jobs(status, created_at);

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      bucket TEXT NOT NULL,
      object_key TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('people','tools','plants','place_before','place_after')),
      created_at TEXT NOT NULL,
      farm_id TEXT,
      visit_id TEXT,
      latitude REAL,
      longitude REAL,
      uploaded_by_user_id TEXT,
      FOREIGN KEY(farm_id) REFERENCES farms(id) ON DELETE SET NULL,
      FOREIGN KEY(visit_id) REFERENCES visits(id) ON DELETE SET NULL,
      FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at);

    CREATE TABLE IF NOT EXISTS sync_actions (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      label TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      user_id TEXT,
      received_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sync_actions_created_at ON sync_actions(created_at);

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

    CREATE TABLE IF NOT EXISTS auth_identities (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      used_at TEXT,
      revoked_at TEXT,
      replaced_by_token_id TEXT,
      user_agent TEXT,
      ip_address TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(replaced_by_token_id) REFERENCES auth_refresh_tokens(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user_id ON auth_refresh_tokens(user_id);
  `)
}
