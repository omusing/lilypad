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
  {
    version: 2,
    sql: `ALTER TABLE medications ADD COLUMN catalog_rxcui TEXT;`,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE medication_doses ADD COLUMN quantity   INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE medication_doses ADD COLUMN updated_at TEXT;
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

function runMigrations(db: Database.Database, fromVersion = 0, toVersion?: number): void {
  const pending = MIGRATIONS.filter(
    m => m.version > fromVersion && (toVersion === undefined || m.version <= toVersion)
  );
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

  test('schema_version is set to 3 (latest)', () => {
    expect(getSchemaVersion(db)).toBe(3);
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
    const required = ['id', 'medication_id', 'taken_at', 'note', 'quantity', 'updated_at'];
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
      runMigrations(db, getSchemaVersion(db)); // second run — already at latest, no-op
    }).not.toThrow();
    expect(getSchemaVersion(db)).toBe(3);
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

    runMigrations(db, getSchemaVersion(db)); // no-op — already at latest

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

    runMigrations(db, getSchemaVersion(db)); // no-op — already at latest

    const row = db.prepare('SELECT * FROM medications WHERE name = ?').get('Ibuprofen') as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.dose).toBe('400mg');
    expect(row.is_active).toBe(1);
  });
});

describe('Migration v2 — catalog_rxcui on medications', () => {
  test('upgrades from v1: catalog_rxcui column added, schema_version = 2', () => {
    const db = openFreshDb();
    runMigrations(db, 0, 1); // bring to v1 only
    expect(getSchemaVersion(db)).toBe(1);
    expect(columnExists(db, 'medications', 'catalog_rxcui')).toBe(false);

    runMigrations(db, 1, 2); // apply v2
    expect(getSchemaVersion(db)).toBe(2);
    expect(columnExists(db, 'medications', 'catalog_rxcui')).toBe(true);
    db.close();
  });

  test('existing medication row survives v1→v2, catalog_rxcui defaults to NULL', () => {
    const db = openFreshDb();
    runMigrations(db, 0, 1); // bring to v1 only

    db.prepare(
      `INSERT INTO medications (name, dose, route, frequency, created_at)
       VALUES ('Ibuprofen', '400mg', 'oral', 'as needed', '2026-04-01T08:00:00Z')`
    ).run();

    runMigrations(db, 1, 2); // apply v2

    const row = db.prepare('SELECT * FROM medications WHERE name = ?').get('Ibuprofen') as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.dose).toBe('400mg');
    expect(row.is_active).toBe(1);
    expect(row.catalog_rxcui).toBeNull();
    db.close();
  });

  test('fresh install at v3 has catalog_rxcui column', () => {
    const db = openFreshDb();
    runMigrations(db);
    expect(getSchemaVersion(db)).toBe(3);
    expect(columnExists(db, 'medications', 'catalog_rxcui')).toBe(true);
    db.close();
  });
});

describe('Migration v3 — quantity and updated_at on medication_doses', () => {
  test('upgrades from v2: quantity + updated_at columns added, schema_version = 3', () => {
    const db = openFreshDb();
    runMigrations(db, 0, 2); // bring to v2 only
    expect(getSchemaVersion(db)).toBe(2);
    expect(columnExists(db, 'medication_doses', 'quantity')).toBe(false);
    expect(columnExists(db, 'medication_doses', 'updated_at')).toBe(false);

    runMigrations(db, 2, 3); // apply v3
    expect(getSchemaVersion(db)).toBe(3);
    expect(columnExists(db, 'medication_doses', 'quantity')).toBe(true);
    expect(columnExists(db, 'medication_doses', 'updated_at')).toBe(true);
    db.close();
  });

  test('existing dose row survives v2→v3, quantity defaults to 1, updated_at defaults to NULL', () => {
    const db = openFreshDb();
    runMigrations(db, 0, 2);

    db.prepare(
      `INSERT INTO medications (name, dose, route, frequency, created_at)
       VALUES ('Ibuprofen', '400mg', 'oral', 'as needed', '2026-04-01T08:00:00Z')`
    ).run();

    const medId = (db.prepare('SELECT id FROM medications WHERE name = ?').get('Ibuprofen') as { id: number }).id;

    db.prepare(
      `INSERT INTO medication_doses (medication_id, taken_at, note)
       VALUES (?, '2026-04-10T09:00:00Z', NULL)`
    ).run(medId);

    runMigrations(db, 2, 3);

    const row = db.prepare('SELECT * FROM medication_doses WHERE medication_id = ?').get(medId) as Record<string, unknown>;
    expect(row).toBeDefined();
    expect(row.taken_at).toBe('2026-04-10T09:00:00Z');
    expect(row.quantity).toBe(1);
    expect(row.updated_at).toBeNull();
    db.close();
  });

  test('fresh install at v3 has quantity and updated_at columns', () => {
    const db = openFreshDb();
    runMigrations(db);
    expect(getSchemaVersion(db)).toBe(3);
    expect(columnExists(db, 'medication_doses', 'quantity')).toBe(true);
    expect(columnExists(db, 'medication_doses', 'updated_at')).toBe(true);
    db.close();
  });

  test('quantity column accepts values > 1', () => {
    const db = openFreshDb();
    runMigrations(db);

    db.prepare(
      `INSERT INTO medications (name, dose, route, frequency, created_at)
       VALUES ('Gabapentin', '300mg', 'oral', 'as needed', '2026-04-01T08:00:00Z')`
    ).run();

    const medId = (db.prepare('SELECT id FROM medications WHERE name = ?').get('Gabapentin') as { id: number }).id;

    db.prepare(
      `INSERT INTO medication_doses (medication_id, taken_at, quantity, note)
       VALUES (?, '2026-04-10T09:00:00Z', 2, NULL)`
    ).run(medId);

    const row = db.prepare('SELECT * FROM medication_doses WHERE medication_id = ?').get(medId) as Record<string, unknown>;
    expect(row.quantity).toBe(2);
    db.close();
  });

  test('SUM(quantity) correctly aggregates multi-dose sessions', () => {
    const db = openFreshDb();
    runMigrations(db);

    db.prepare(
      `INSERT INTO medications (name, dose, route, frequency, created_at)
       VALUES ('Naproxen', '220mg', 'oral', 'daily', '2026-04-01T08:00:00Z')`
    ).run();

    const medId = (db.prepare('SELECT id FROM medications WHERE name = ?').get('Naproxen') as { id: number }).id;

    db.prepare(`INSERT INTO medication_doses (medication_id, taken_at, quantity) VALUES (?, '2026-04-10T09:00:00Z', 2)`).run(medId);
    db.prepare(`INSERT INTO medication_doses (medication_id, taken_at, quantity) VALUES (?, '2026-04-11T09:00:00Z', 1)`).run(medId);

    const row = db.prepare(
      `SELECT medication_id, SUM(quantity) as total FROM medication_doses WHERE medication_id = ? GROUP BY medication_id`
    ).get(medId) as { total: number };
    expect(row.total).toBe(3);
    db.close();
  });
});
