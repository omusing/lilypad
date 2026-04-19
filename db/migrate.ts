// Runs on every app launch before any other DB access.
// Reads schema_version, applies any pending migrations in order, updates version.
// All migrations run inside a single transaction — partial failure rolls back.

import { getDb } from './client';

const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS entries (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date       TEXT    NOT NULL,
        pain_level       INTEGER NOT NULL,
        pain_regions     TEXT    NOT NULL,
        pain_qualities   TEXT,
        triggers         TEXT,
        mood             INTEGER,
        sleep_quality    INTEGER,
        medication_ids   TEXT,
        note             TEXT,
        created_at       TEXT    NOT NULL,
        updated_at       TEXT
      );

      CREATE TABLE IF NOT EXISTS medications (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT    NOT NULL,
        dose        TEXT,
        route       TEXT,
        frequency   TEXT,
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT    NOT NULL
      );

      CREATE TABLE IF NOT EXISTS medication_doses (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        medication_id  INTEGER NOT NULL REFERENCES medications(id),
        taken_at       TEXT    NOT NULL,
        note           TEXT
      );
    `,
  },
  {
    version: 2,
    sql: `ALTER TABLE medications ADD COLUMN catalog_rxcui TEXT;`,
  },
];

export async function runMigrations(): Promise<void> {
  const db = await getDb();

  // Bootstrap: create the full app_settings table on first launch.
  // Migration v1 then handles the other three tables.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id                INTEGER PRIMARY KEY DEFAULT 1,
      patient_name      TEXT,
      morning_reminder  INTEGER NOT NULL DEFAULT 0,
      morning_time      TEXT    NOT NULL DEFAULT '08:00',
      evening_reminder  INTEGER NOT NULL DEFAULT 0,
      evening_time      TEXT    NOT NULL DEFAULT '20:00',
      onboarding_done   INTEGER NOT NULL DEFAULT 0,
      schema_version    INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO app_settings (id) VALUES (1);
  `);

  const row = await db.getFirstAsync<{ schema_version: number }>(
    'SELECT schema_version FROM app_settings WHERE id = 1'
  );
  const currentVersion = row?.schema_version ?? 0;

  const pending = MIGRATIONS.filter(m => m.version > currentVersion);
  if (pending.length === 0) return;

  await db.withTransactionAsync(async () => {
    for (const migration of pending) {
      await db.execAsync(migration.sql);
    }
    const newVersion = pending[pending.length - 1].version;
    await db.runAsync(
      'UPDATE app_settings SET schema_version = ? WHERE id = 1',
      [newVersion]
    );
  });
}
