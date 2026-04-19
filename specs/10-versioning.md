# Versioning and Data Migration

This spec describes how Lilypad versions its data structures, how migrations run,
and what is required to ship a new version. For the decisions behind these policies
see [decisions/006-versioning-policy.md](decisions/006-versioning-policy.md).

---

## Principles

**Forward-only.** Data always migrates forward. A user who installs any newer version
of the app on top of any older version must have their data intact. There is no rollback,
no downgrade path, no undo.

**Additive within a major version.** All schema changes within `1.x.x` must be additive
(new columns, new tables, new fields). Destructive changes (rename, drop, type change)
require a new major app version with an explicit migration.

**Converters ship forever.** Every converter ever written for a data structure ships
in every release. App version `5.0` must be able to migrate data from version `1.0`.
A converter is never removed once released. This is not negotiable — a user who hasn't
opened the app in two years must still be able to upgrade.

**Plain strings are the user's data.** Values written to SQLite by the user are owned
by the user. The app never overwrites them from an external reference (catalog, lookup
table) during or after a migration. Migrations may add columns; they never rewrite
user-entered values.

---

## Data Structures and Their Version Numbers

Lilypad has three versioned data structures. All three version numbers are declared
in a single manifest file.

### Manifest

```typescript
// constants/versions.ts  — single source of truth for all version numbers

export const VERSIONS = {
  /** SQLite schema version. Incremented by db/migrate.ts. */
  db: 2,

  /** Export JSON format version. Incremented when export structure changes. */
  export: 1,

  /** Medication catalog build date (YYYY-MM). Informational only — not used for migration. */
  catalog: '2026-04',
} as const;
```

This file is the manifest. Any code that needs a version number reads it from here.
No version number is hard-coded anywhere else.

When a migration adds a new schema version, update `VERSIONS.db`.
When the export format changes, update `VERSIONS.export`.
When the catalog is regenerated, update `VERSIONS.catalog`.

---

### 1. SQLite Schema (`VERSIONS.db`)

Tracked in `app_settings.schema_version`. Starts at 1.

All migrations live in `db/migrate.ts` as an array of `{ version, sql }` objects.
On every app launch, the migration runner compares `schema_version` to the highest
known version and runs all pending migrations in order.

See [05-data-schema.md](05-data-schema.md) for the current table definitions.
See [decisions/006-versioning-policy.md](decisions/006-versioning-policy.md)
for the full policy (additive-only, immutable migrations, programmatic test construction).

**Current migration history:**

| Version | Change | App version shipped |
|---|---|---|
| 1 | Initial schema | 1.0.0 |
| 2 | `medications.catalog_rxcui TEXT` | 1.x.x (pending) |

---

### 2. Export JSON Format (`VERSIONS.export`)

Every exported JSON file includes both version numbers in its header:

```json
{
  "export_version": 1,
  "app_version": "1.0.0",
  "exported_at": "2026-04-18T12:00:00Z",
  "entries": [...],
  "medications": [...],
  "medication_doses": [...]
}
```

`export_version` is independent of `VERSIONS.db` and the app version. It increments
only when the structure of the export JSON itself changes (renamed key, removed field,
restructured nested object). Adding a new optional field does not require a version bump
(importers skip unknown keys).

**Import compatibility requirement:** `lib/import.ts` must handle every `export_version`
ever released. All converters ship in every build. There is no minimum supported export
version. A user who created a backup with `export_version: 1` must be able to import it
into any future version of the app.

**Current export version history:**

| export_version | Changes | App version shipped |
|---|---|---|
| 1 | Initial export format | 1.0.0 |

---

### 3. Medication Catalog (`VERSIONS.catalog`)

The catalog is compile-time app data — a TypeScript array bundled in the JS build.
It does not migrate user data. `VERSIONS.catalog` is a build-date string for audit
and debugging purposes only (e.g., identifying which catalog shipped with a crash report).

No migration runner is needed for the catalog. When the catalog file is replaced
(V1.1 pipeline, or a manual update), the new version ships with the next app release.
See [09-medicine-list.md](09-medicine-list.md) for catalog maintenance instructions.

---

## Migration Runner

`db/migrate.ts` runs on every app launch before the app renders. The app does not
render until it completes.

**Bootstrap sequence on fresh install:** The migration runner cannot read
`schema_version` from a table that doesn't exist yet. The startup sequence handles
this explicitly:

1. Open the database file (creates it if absent)
2. If `app_settings` does not exist, create it with all defaults including
   `schema_version = 0` — this is the only time the row is created
3. Call `runMigrations()` — reads `schema_version`, runs all pending migrations
   in order, updates `schema_version` to the highest applied version

On a fresh install `schema_version` starts at `0`, so all migrations run. The final
`schema_version` after a fresh install is always `VERSIONS.db`.

**Multi-version skip guarantee:** A user who has never updated the app may be many
versions behind. The migration runner guarantees correctness for any gap by running
every pending migration in version order — never skipping, never batching. If a
user upgrades from v1 directly to v5, migrations 2, 3, 4, and 5 all run in sequence.
Each migration only knows about the schema state left by the previous one. This
property must be verified by the "skip upgrade" test (see Migration Test Requirements).

```
Launch
  │
  ▼
runMigrations()
  │
  ├─ Read schema_version from app_settings
  ├─ Filter MIGRATIONS to those with version > schema_version
  ├─ Run each pending migration in a transaction
  │    ├─ If any migration fails → log error, re-throw (app will show error state)
  │    └─ If all pass → update schema_version to highest migrated version
  └─ Return
```

**Failure handling:** If a migration fails, the app surfaces an error state rather
than crashing silently or proceeding with a partially migrated schema. The user is
shown a message indicating the app cannot start and should be reinstalled. This is
the last resort — it means a migration was shipped with a bug. The testing requirements
below exist to prevent this.

---

## Test Fixtures

### DB schema migration tests — programmatic construction (default)

Migration tests construct historical database state programmatically by running
migrations up to version N-1, then inserting representative rows, then running
migration N. No committed snapshot file is required.

```typescript
test('migration v2: catalog_rxcui column added', async () => {
  const db = await buildSchemaAtVersion(1);       // runs MIGRATIONS[0] only
  await db.execAsync(`INSERT INTO medications (name, is_active, created_at)
                      VALUES ('Ibuprofen', 1, '2026-01-01T00:00:00Z')`);

  await runMigrations(db);                        // applies v2

  const row = await db.getFirstAsync(
    `SELECT * FROM medications WHERE name = 'Ibuprofen'`
  );
  expect(row.catalog_rxcui).toBeNull();            // pre-existing rows get NULL
  expect(await schemaVersionOf(db)).toBe(2);
});
```

This is sufficient for additive-only migrations. The test is always in sync with
the code because it builds the old state from the same migration array.

**Committed SQL seed files** (committed as text, not binary) are used when
programmatic construction cannot reproduce a specific edge case — for example,
a production data pattern that triggered a migration bug. Add them when the pain
justifies it:

```
test/fixtures/
  seed_v1_edge_case.sql   # Only if a specific production scenario needs covering
```

Binary `.db` files are not committed to the repo. They are unreadable as diffs,
bloat git history, and go stale silently.

### Export format tests — committed JSON fixtures

Export fixtures are plain JSON text files, committed to the repo. Unlike SQLite
state, export files cannot be programmatically constructed from the migration
history — they represent a specific serialisation format that must be tested
against its actual structure.

```
test/fixtures/
  export/
    v1.json    # Representative export at export_version 1
```

Each fixture must contain realistic data (a few entries, medications, doses).
When a new `export_version` is added, commit a fixture representing the previous
format before changing the export writer.

---

## Migration Test Requirements

Migration tests live in `db/__tests__/migrate.test.ts` and run with `npm test`
using `expo-sqlite` — the same database implementation used in production. Tests
are async throughout. This ensures test behaviour matches the app exactly, at the
cost of requiring the Expo test environment rather than plain Node.

**Required tests for every new migration (version N):**

| Test | What it verifies |
|---|---|
| Fresh install | All tables created, `schema_version` = N |
| Upgrade from v(N-1) programmatic state | Run migrations 1..N-1, insert representative rows, run migration N — no error, `schema_version` = N |
| Skip upgrade (v1 → N) | Run migration 1 only, insert rows, then run full `runMigrations()` — all pending migrations apply in order, final `schema_version` = N. Testing from v1 is the most extreme gap and implies correctness for all intermediate starting points. |
| Data survival | Representative rows inserted at v(N-1) are readable with correct values after migration N runs |
| New column defaults | New nullable columns are NULL for pre-existing rows; new columns with DEFAULT have the correct default |
| Idempotency | Running `runMigrations()` twice on an already-migrated DB does not error |

The data survival test is the most important. Build the pre-migration state programmatically
(run migrations 1..N-1 then insert rows), not from a committed binary file — the
programmatic state is always in sync with the migration array and produces readable diffs.

**Required tests for every new export version:**

| Test | What it verifies |
|---|---|
| Round-trip | Export → import on the current version produces identical data |
| Import `v(N-1).json` fixture | Older export imports without error on the current version |
| Import `v1.json` fixture | Oldest export fixture imports without error on the current version |
| Unknown keys ignored | Export with extra unknown fields imports without error |
| Missing optional keys | Export with missing optional fields imports with correct defaults |

---

## Checklist: Adding a New DB Schema Version

1. Add a migration object to `MIGRATIONS` in `db/migrate.ts`:
   ```ts
   { version: N, sql: `ALTER TABLE ... ` }
   ```
2. Update `VERSIONS.db` in `constants/versions.ts` to `N`.
3. Write migration tests in `db/__tests__/migrate.test.ts` using programmatic
   construction (run migrations 1..N-1, insert representative rows, run migration N,
   assert). See the Test Fixtures section above for the pattern.
4. Run `npm test` — all tests must pass.
5. Update the migration history table in this spec.
6. Commit message: `db: migration v{N} — <what changed>`

## Checklist: Emergency Hotfix Migration

Use this when a released migration is broken and users need a repair in the next version.

### The constraint: you cannot edit a released migration

Once a migration version has shipped, its SQL block in `MIGRATIONS` is immutable.
Users on the broken version already ran it. Editing it would only affect fresh installs,
not the users who need the fix. The repair must be a new migration at the next version.

### Reconstructing what users are actually in

Because every migration ships in every build as an immutable array, Claude (or any
developer) can reconstruct the exact DB state of any user at any released version by:

1. Checking out the git tag for that version: `git show v2.4.0:db/migrate.ts`
2. Running all migrations up to that version in an in-memory database
3. Applying the broken migration on top to see the exact damage

This is the same pattern as the programmatic migration tests — the git tag is the
anchor, the MIGRATIONS array is the reconstruction recipe.

### Writing the repair migration

The repair migration (v2.6 in this example) must handle all user states it will
encounter in the wild:

- Users who upgraded `2.4 → 2.5` and got the broken migration applied
- Users who are on a fresh install of `2.5` (may or may not need repair)
- Users who will do a fresh install of `2.6` (must not error)

**SQLite limitation:** You cannot alter a column type, rename a column, or remove a
column with a single ALTER TABLE statement. If the broken migration created a column
with the wrong type or default, the repair requires a full table rebuild:

```sql
-- Example: v2.5 added medications.catalog_source with wrong DEFAULT,
-- and v2.6 repairs it by rebuilding the table with the correct schema.

CREATE TABLE medications_new (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  dose            TEXT,
  route           TEXT,
  frequency       TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL,
  catalog_rxcui   TEXT,
  catalog_source  TEXT    NOT NULL DEFAULT 'user'   -- corrected default
);
INSERT INTO medications_new SELECT
  id, name, dose, route, frequency, is_active, created_at, catalog_rxcui,
  COALESCE(NULLIF(catalog_source, ''), 'user')      -- repair bad values in place
FROM medications;
DROP TABLE medications;
ALTER TABLE medications_new RENAME TO medications;
```

The repair migration must be wrapped in a transaction (the migration runner already
does this). If it fails, the DB rolls back — do not attempt a partial repair.

### Testing the repair

The hotfix migration requires one additional test case beyond the standard set:

| Test | What it verifies |
|---|---|
| Full chain upgrade (v2.4 → v2.5 → v2.6) | Data survives the broken migration and the repair — run MIGRATIONS programmatically through the version in each git tag to reconstruct each state |
| Repair from broken v2.5 state | Rows with bad values produced by the broken v2.5 migration are corrected after v2.6 runs |

Reconstruct the historical states programmatically:

```typescript
// Read the MIGRATIONS array as it existed at each tag:
//   git show v2.4.0:db/migrate.ts  → extract MIGRATIONS up to v2.4
//   git show v2.5.0:db/migrate.ts  → extract MIGRATIONS up to v2.5
// Then in the test:
const db = await openDatabaseAsync(':memory:');
await runMigrationsUpTo(db, migrationsAtV24, 4);  // DB is now in v2.4 state
await db.execAsync(`INSERT INTO ...`);             // seed representative rows
await runMigrationsUpTo(db, migrationsAtV25, 5);  // apply broken v2.5 migration
// assert: rows are in the bad state we expect
await runMigrations(db);                           // apply v2.6 repair
// assert: rows are corrected
```

No binary `.db` files are committed. The git tag is the anchor; the MIGRATIONS
array from that tag is the reconstruction recipe.

### Commit message

`db: migration v{N} — hotfix broken v{N-1} migration (<what was wrong>)`

---

## Checklist: Adding a New Export Version

1. Update the export writer in `lib/export.ts` to produce the new format.
2. Add an import converter in `lib/import.ts` for `export_version: N-1 → N`.
3. Update `VERSIONS.export` in `constants/versions.ts` to `N`.
4. Create `test/fixtures/export/v(N-1).json` (a representative export in the old format).
5. Write the required import tests.
6. Run `npm test` — all tests must pass.
7. Update the export version history table in this spec.
8. Commit message: `export: format v{N} — <what changed>`

---

## Initial Seed: Version 1 Baseline

On first install, the app starts with a completely empty database. The migration
runner creates all four tables (migration v1) and inserts the `app_settings` row
with defaults. There is no pre-populated user data.

The medication catalog (`constants/medicationCatalog.ts`) ships with ~200 hand-authored
entries as compile-time TypeScript. This is app data, not user data. It does not
migrate and is not seeded into SQLite.

**What "version 1 baseline" means for testing:**

A fresh-install test creates an empty in-memory database, runs the bootstrap
sequence (create `app_settings` with `schema_version = 0`, then `runMigrations()`),
and asserts:
- All four tables exist with the correct columns
- `app_settings` has exactly one row with `schema_version = VERSIONS.db`
- All user data tables (`entries`, `medications`, `medication_doses`) are empty

```typescript
test('fresh install: tables created, no user data', async () => {
  const db = await openDatabaseAsync(':memory:');   // expo-sqlite in-memory DB
  await runMigrations(db);

  expect(await schemaVersionOf(db)).toBe(VERSIONS.db);
  const entries = await db.getFirstAsync(`SELECT count(*) as n FROM entries`);
  const meds    = await db.getFirstAsync(`SELECT count(*) as n FROM medications`);
  expect(entries.n).toBe(0);
  expect(meds.n).toBe(0);
});
```

---

## Checklist: Starting a New Version Cycle

Run this at the start of any development cycle — whether `1.0 → 1.1`, `1.1 → 2.0`,
or anything else. The key principle: tag the baseline now so migrations can be tested
against it, reserve the migration slot now even though the SQL isn't written yet, and
let the migration content accumulate as features are built.

### Step 1 — Tag the baseline

Tag the last released commit before any new work begins:

```bash
git tag v1.0.0   # or whatever the last released version was
git push origin v1.0.0
```

This gives a stable reference point. Migration tests can reconstruct "what the schema
looked like at the start of this cycle" by running all migrations up to the current
`VERSIONS.db` value on the tagged commit.

**For the v1.0 initial release:** there is no previous tag to create. Tag the initial
commit as `v1.0.0` when the release ships. The baseline for all future migration tests
is the MIGRATIONS array at that tag.

### Step 2 — Bump the target version

In `app.json` and `package.json`, update `version` to the target (e.g., `"1.1.0"`).
Do this on a branch so main always reflects the last shipped version.

### Step 3 — Reserve the migration slot

If any schema change is anticipated this cycle (even one you haven't designed yet),
add a placeholder to `MIGRATIONS` in `db/migrate.ts` and bump `VERSIONS.db`:

```ts
// db/migrate.ts  — no-op placeholder; SQL fills in as features are built this cycle
{ version: 3, sql: `SELECT 1` }
```

`SELECT 1` is a valid no-op in SQLite. An empty string will throw in `expo-sqlite` —
never use an empty `sql` field, even temporarily.

```ts
// constants/versions.ts
export const VERSIONS = {
  db: 3,   // bumped from 2
  ...
} as const;
```

One migration version per release cycle is the default. The SQL block accumulates
as features are built. Only add a second version number within the same cycle if
a schema change must ship independently (rare — coordinate with the team).

**Major vs minor matters here:** within `1.x.x`, every SQL statement added to this
block must be additive (ADD COLUMN, CREATE TABLE, CREATE INDEX). For a major version
bump (`2.0.0`), destructive statements (DROP, RENAME, type changes) are allowed but
must be documented in a new ADR explaining the migration path for existing user data.

### Step 4 — Write the skeleton test

Immediately write a skeleton test for the new migration in
`db/__tests__/migrate.test.ts`. It can be mostly empty at first — the point
is to have a failing test that fills in as schema changes are added:

```typescript
describe('migration v3', () => {
  test('fresh install reaches v3', async () => {
    const db = await openDatabaseAsync(':memory:');
    await runMigrations(db);
    expect(await schemaVersionOf(db)).toBe(3);
  });

  // TODO: add data-survival tests as columns are added this cycle
});
```

### Step 5 — Fill in as you build

Each time a feature requires a schema change during this cycle:

1. Add the SQL to the reserved migration block in `db/migrate.ts`
2. Add a data-survival test for that specific column/table
3. Run `npm test` — must stay green

The migration is considered complete when all features for the cycle are done and
all required tests (see Migration Test Requirements) are written and passing.

### Step 6 — Release gate

Before cutting the release:
- All tests pass: `npm test`
- Lint clean: `npx expo lint`
- No `TODO` comments remain in the migration test file
- Migration history table in this spec is updated
- `VERSIONS` manifest reflects all bumped numbers
- Catalog updated if applicable (see `specs/09-medicine-list.md`)
- Export version bumped if applicable (see Checklist: Adding a New Export Version)
- Commit message: `chore: release v{X.Y.Z} — db v{N}, export v{M}`

---

## What Does Not Need Versioning

- **Medication catalog format** (`MedCatalogEntry` interface): the catalog is compile-time
  app data. If the TypeScript interface changes, it is a breaking build change caught by
  the TypeScript compiler, not a runtime migration. `VERSIONS.catalog` tracks the data
  build date, not the schema shape.
- **App settings values** (morning/evening reminder times, patient name): these are
  user preferences stored in the `app_settings` SQLite table. They migrate with the DB
  schema, not separately.
- **Internal IDs** (`medications.id`, `entries.id`): device-local auto-increment integers,
  explicitly remapped on export/import. Never treated as stable identifiers outside the device.
