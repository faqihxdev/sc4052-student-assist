import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { config } from "../lib/config";
import * as schema from "./schema";
import { mkdirSync, existsSync } from "fs";
import { dirname } from "path";

const dbDir = dirname(config.dbPath);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(config.dbPath);
try {
  sqlite.exec("PRAGMA journal_mode = WAL;");
} catch {
  sqlite.exec("PRAGMA journal_mode = DELETE;");
  console.warn("WAL mode unavailable, using DELETE journal mode");
}
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date TEXT,
      reminder_at TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      services TEXT,
      traces TEXT,
      created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    );
  `);

  // Idempotent column addition for existing DBs. SQLite doesn't support
  // "ADD COLUMN IF NOT EXISTS", so we introspect and add only if missing.
  const taskColumns = sqlite
    .query("PRAGMA table_info(tasks)")
    .all() as { name: string }[];
  if (!taskColumns.some((c) => c.name === "reminder_at")) {
    sqlite.exec("ALTER TABLE tasks ADD COLUMN reminder_at TEXT");
  }

  console.log(`Database initialized at ${config.dbPath}`);
}
