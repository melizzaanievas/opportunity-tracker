import type BetterSqlite3 from "better-sqlite3";
import { logger } from "../lib/logger";

export function runMigrations(client: BetterSqlite3.Database): void {
  logger.info("Running SQLite migrations...");

  client.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT,
      type TEXT NOT NULL DEFAULT 'other',
      status TEXT NOT NULL DEFAULT 'to-apply',
      deadline TEXT,
      summary TEXT,
      key_action_steps TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      opportunity_id INTEGER NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      target_titles TEXT NOT NULL DEFAULT '[]',
      preferred_locations TEXT NOT NULL DEFAULT '[]',
      preferred_job_types TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scout_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT,
      url TEXT NOT NULL UNIQUE,
      description TEXT,
      location TEXT,
      job_type TEXT,
      discovered_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
      telegram_message_id INTEGER,
      notified_at TEXT
    );

    INSERT OR IGNORE INTO preferences (
      id, target_titles, preferred_locations, preferred_job_types, updated_at
    ) VALUES (1, '[]', '[]', '[]', CURRENT_TIMESTAMP);
  `);

  const opportunityColumns = client
    .prepare("PRAGMA table_info(opportunities)")
    .all() as Array<{ name: string }>;
  if (!opportunityColumns.some((column) => column.name === "company")) {
    client.exec("ALTER TABLE opportunities ADD COLUMN company TEXT");
  }

  // Preserve existing completed opportunities under the new pipeline name.
  client.exec("UPDATE opportunities SET status = 'archived' WHERE status = 'completed'");
  // Preserve legacy opportunity categories under the expanded vocabulary.
  client.exec("UPDATE opportunities SET type = 'other' WHERE type = 'hackathon'");

  logger.info("Migrations complete.");
}
