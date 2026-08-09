import type BetterSqlite3 from "better-sqlite3";
import { logger } from "../lib/logger";

export function runMigrations(client: BetterSqlite3.Database): void {
  logger.info("Running SQLite migrations...");

  client.exec(`
    CREATE TABLE IF NOT EXISTS opportunities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
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
  `);

  logger.info("Migrations complete.");
}
