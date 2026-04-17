// Migration tests using better-sqlite3 (pure Node.js — no simulator needed).
// Same SQL dialect as expo-sqlite. Tests run with: npm test

import Database from 'better-sqlite3';

// ─── Migration SQL extracted from db/migrate.ts ──────────────────────────────
// Keep this in sync with MIGRATIONS in db/migrate.ts.
// When a new migration is added there, add a corresponding entry here.

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
];

// ─── Test helper ─────────────────────────────────────────────────────────────

function openFreshDb(): Database.Database {
  const db = new Database(':memory:');
  // Mirrors the bootstrap in db/migrate.ts — full app_settings on first launch.
  db.exec(`
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
  return db;
}

function runMigrations(db: Database.Database, fromVersion = 0): void {
  const pending = MIGRATIONS.filter(m => m.version > fromVersion);
  if (pending.length === 0) return;

  db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.sql);
    }
    const newVersion = pending[pending.length - 1].version;
    db.prepare('UPDATE app_settings SET schema_version = ? WHERE id = 1').run(newVersion);
  })();
}

function getSchemaVersion(db: Database.Database): number {
  const row = db.prepare('SELECT schema_version FROM app_settings WHERE id = 1').get() as { schema_version: number };
  return row.schema_version;
}

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(name);
  return row !== undefined;
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some(c => c.name === column);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Migration v1 — fresh install', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openFreshDb();
    runMigrations(db);
  });

  afterEach(() => db.close());

  test('schema_version is set to 1', () => {
    expect(getSchemaVersion(db)).toBe(1);
  });

  test('all four tables exist', () => {
    expect(tableExists(db, 'app_settings')).toBe(true);
    expect(tableExists(db, 'entries')).toBe(true);
    expect(tableExists(db, 'medications')).toBe(true);
    expect(tableExists(db, 'medication_doses')).toBe(true);
  });

  test('entries table has required columns', () => {
    const required = [
      'id', 'entry_date', 'pain_level', 'pain_regions',
      'pain_qualities', 'triggers', 'mood', 'sleep_quality',
      'medication_ids', 'note', 'created_at', 'updated_at',
    ];
    for (const col of required) {
      expect(columnExists(db, 'entries', col)).toBe(true);
    }
  });

  test('medications table has required columns', () => {
    const required = ['id', 'name', 'dose', 'route', 'frequency', 'is_active', 'created_at'];
    for (const col of required) {
      expect(columnExists(db, 'medications', col)).toBe(true);
    }
  });

  test('medication_doses table has required columns', () => {
    const required = ['id', 'medication_id', 'taken_at', 'note'];
    for (const col of required) {
      expect(columnExists(db, 'medication_doses', col)).toBe(true);
    }
  });

  test('app_settings row exists with correct defaults', () => {
    const row = db.prepare('SELECT * FROM app_settings WHERE id = 1').get() as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.morning_reminder).toBe(0);
    expect(row.evening_reminder).toBe(0);
    expect(row.morning_time).toBe('08:00');
    expect(row.evening_time).toBe('20:00');
    expect(row.onboarding_done).toBe(0);
  });
});

describe('Migration idempotency', () => {
  test('running migrations twice does not error', () => {
    const db = openFreshDb();
    expect(() => {
      runMigrations(db);
      runMigrations(db); // second run — all versions already applied, should no-op
    }).not.toThrow();
    expect(getSchemaVersion(db)).toBe(1);
    db.close();
  });
});

describe('Data survival across migrations', () => {
  test('pre-existing entry row survives migration', () => {
    const db = openFreshDb();
    runMigrations(db);

    // Insert a representative entry under the current schema
    db.prepare(`
      INSERT INTO entries
        (entry_date, pain_level, pain_regions, created_at)
      VALUES ('2026-04-10', 7, '["lower_back","hips"]', '2026-04-10T09:00:00Z')
    `).run();

    // Simulate a future migration (v2+) by just re-running current migrations
    // In practice: add a v2 migration here and assert the row is intact after
    runMigrations(db, 1); // no-op since already at v1

    const row = db.prepare('SELECT * FROM entries WHERE entry_date = ?').get('2026-04-10') as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.pain_level).toBe(7);
    expect(row.pain_regions).toBe('["lower_back","hips"]');
  });

  test('pre-existing medication row survives migration', () => {
    const db = openFreshDb();
    runMigrations(db);

    db.prepare(`
      INSERT INTO medications (name, dose, route, frequency, created_at)
      VALUES ('Ibuprofen', '400mg', 'oral', 'as needed', '2026-04-01T08:00:00Z')
    `).run();

    runMigrations(db, 1); // no-op

    const row = db.prepare('SELECT * FROM medications WHERE name = ?').get('Ibuprofen') as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.dose).toBe('400mg');
    expect(row.is_active).toBe(1);
  });
});

// ─── Template for future migrations ──────────────────────────────────────────
// When you add migration v2 to db/migrate.ts, copy this block and fill it in:
//
// describe('Migration v2 — <description>', () => {
//   test('upgrades from v1 correctly', () => {
//     const db = openFreshDb();
//     runMigrations(db, 0);  // bring to v1
//
//     // Insert rows under v1 schema
//     db.prepare(`INSERT INTO entries (...) VALUES (...)`).run();
//
//     runMigrations(db, 1);  // apply v2
//     expect(getSchemaVersion(db)).toBe(2);
//
//     // Assert new column exists
//     expect(columnExists(db, 'entries', 'new_column')).toBe(true);
//
//     // Assert old row is intact
//     const row = db.prepare('SELECT * FROM entries WHERE ...').get();
//     expect(row.new_column).toBe(<default value>);
//   });
// });
