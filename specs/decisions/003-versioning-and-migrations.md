# 003 — App versioning, DB schema versioning, and migration policy

**Status:** Active  
**Date:** 2026-04-17

---

## The two version numbers

Lilypad has two independent version numbers that must never be conflated:

| Number | Where | Format | Who sees it |
|---|---|---|---|
| **App version** | `app.json` → `version`, `package.json` → `version` | semver `MAJOR.MINOR.PATCH` | Users (App Store, About screen) |
| **Schema version** | `app_settings.schema_version` | Integer starting at 1 | Nobody — internal only |

They are independent. App version `1.3.0` might still be on schema version `2`.
Do not derive one from the other. Do not encode the schema version in the app version string.

---

## Schema version policy

### Rule 1 — Additive only within a major app version

Within `1.x.x`, every migration must be additive:
- Add columns (with `DEFAULT` or nullable)
- Add tables
- Add indexes

Never within a `1.x.x` migration:
- Drop a column
- Rename a column
- Change a column type
- Drop a table

Breaking changes require a new major app version (`2.0.0`) with a documented
upgrade path and a migration that explicitly transforms old data.

### Rule 2 — One migration per schema version, forever

Each integer schema version maps to exactly one SQL block in `db/migrate.ts`.
Once shipped, that SQL block is **immutable**. If you need to fix a migration
that was already released, add a new migration at the next version — never edit
the old one.

### Rule 3 — Schema version and app version are recorded together on export

Every JSON export includes both:

```json
{
  "export_version": 1,
  "app_version": "1.0.0",
  ...
}
```

`export_version` is separate from both. It increments only when the export
JSON structure itself changes (new fields, renamed keys). It does not track
schema changes or app releases.

### Rule 4 — Backward compatibility required, forward compatibility not

A user who upgrades from app `1.0.0` → `1.3.0` (skipping intermediate
releases) must have their data intact. The migration runner handles this by
running all pending migrations in order.

A user who somehow runs an older app against a newer schema (downgrade) is
not supported. The app will likely crash. This is acceptable — the App Store
does not allow downgrades by default, and the risk is documented here rather
than defended against in code.

---

## Adding a new migration (checklist)

1. Add a new object to the `MIGRATIONS` array in `db/migrate.ts`:
   ```ts
   { version: N, sql: `ALTER TABLE ...` }
   ```
2. Bump `schema_version` in the `app_settings` CREATE TABLE default
   (for fresh installs) — actually, fresh installs run all migrations in
   order, so this happens automatically. No change needed.
3. Add a test case in `db/__tests__/node/migrate.test.ts` that:
   - Starts from schema version N-1
   - Runs migrations
   - Asserts the new columns/tables exist
   - Asserts pre-existing rows survived with correct values
4. Run `npm test` — must pass before the migration is committed.
5. Document the change in the commit message: `db: migration v{N} — <what changed>`

---

## Export version policy

`export_version` in the JSON export is a separate integer. Increment it when:
- A field is renamed in the export schema
- A field is removed from the export schema
- The structure of a nested object changes

Do NOT increment it when:
- A new optional field is added (importers skip unknown keys)
- The schema version changes without affecting the export format

`lib/import.ts` must handle at minimum the current `export_version` and
one prior. Older versions: surface a user-facing error ("This backup was
created with an older version of Lilypad that is no longer supported for import.
Please update the app that created this backup.").

---

## Testing policy

Migration tests live in `db/__tests__/node/migrate.test.ts`.  
They run with `npm test` using `better-sqlite3` (pure Node.js SQLite —
same SQL dialect as expo-sqlite, no simulator required).

**Required test cases for every migration:**

| Case | What it verifies |
|---|---|
| Fresh install | All tables created, schema_version set correctly |
| Upgrade from v(N-1) | New migration applied, schema_version incremented |
| Skip upgrade (v0 → vN) | All migrations run in order, final schema_version = N |
| Data survival | Pre-existing rows in affected tables are intact after migration |
| Idempotency | Running migrations twice does not error or corrupt data |

The data survival test is the most important. Before any migration ships,
a test must insert representative rows under the old schema and assert they
are readable with correct values after the migration runs.
