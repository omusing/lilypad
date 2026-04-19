# 004 — Medication catalog storage: TypeScript bundle vs. SQLite asset

**Status:** Decided
**Date:** 2026-04-18

## Context

The medication catalog is a curated list of pain medications used to power
autocomplete in the Add Medication form. The question was how to store and
ship this catalog alongside the app.

The catalog has different characteristics from user data: it is maintained by
the app developers, updated on app releases, and has no personal health
significance. The user's `medications` table in SQLite, by contrast, is their
personal health record — what drugs they take, at what doses, on what schedule.

The two types of data have different ownership, different update lifecycles, and
different privacy weight. The storage approach needed to reflect this.

## Options considered

### Option A — Pre-built SQLite asset (separate catalog DB)

Bundle a separate `.db` file as an Expo asset. On first launch, copy it to the
app's document directory. Query it via expo-sqlite for autocomplete.

**Problems:**
- Creates a second SQLite database alongside the user's `lilypad.db`. Any code
  that opens "the database" needs to know which one it means.
- Updating the catalog across app versions requires either overwriting the asset
  file (losing any user customizations, if any were allowed) or running a
  migration that touches a file conceptually separate from the user's data.
- The boundary between app data and user data becomes blurry at the file system
  level. Both live in the same document directory, both accessed via the same
  expo-sqlite API.

### Option B — Catalog table inside the user's SQLite DB

Add a `medication_catalog` table to `lilypad.db`. Populate it via DB migrations
on app launch.

**Problems:**
- `lilypad.db` is the user's health record. Putting app-managed lookup data
  inside it contaminate that boundary. A future export of the user's data would
  need to explicitly exclude catalog tables.
- Catalog updates require schema migrations that run against the user's database.
  A failed catalog migration could block app launch or corrupt schema_version.
- The migration system is designed for additive structural changes, not
  bulk-replace content updates.

### Option C — TypeScript array bundled in the JS build (chosen)

Export the catalog as a `MEDICATION_CATALOG` constant from
`constants/medicationCatalog.ts`. This file is compiled into the JavaScript
bundle alongside the rest of the app.

**Tradeoffs:**
- Adds to JS bundle size (~150–300KB after minification for ~200–500 entries).
  Acceptable for a mobile app.
- Updating the catalog requires a new app release (or Expo OTA update). Cannot
  be updated independently of the JS bundle. Acceptable for a catalog that
  changes quarterly at most.
- Zero runtime complexity: no file copies, no second database, no migration risk.

## Decision

**TypeScript bundle (Option C).**

The catalog is compile-time app data. The user's SQLite database is runtime user
data. These must not be mixed at the storage layer. A TypeScript array makes the
separation explicit: the catalog is code, the user's data is data.

The core principle: the user's `lilypad.db` has moral weight — it is their health
record and it never leaves their device. Nothing the app developers maintain
should live inside it.

## Consequences

- `constants/medicationCatalog.ts` is checked into git. Every catalog change is
  a diff in version control, which makes the change history auditable.
- The catalog is read-only at runtime. There is no API to modify it. Users who
  need a drug not in the catalog enter it by free text — the catalog is a
  convenience, not a gate.
- A nullable `catalog_rxcui TEXT` column is added to the `medications` table
  (see [05-data-schema.md](../05-data-schema.md)). This stores the RxNorm ID of
  the catalog entry used at entry time, for future use (drug interaction lookups,
  cross-referencing on export). It is never used for display — the `name`, `dose`,
  and `route` fields in SQLite are always the source of truth for what the user
  takes.
- Expo OTA updates can deliver a new catalog without a full App Store release,
  provided `expo-updates` is in the project dependencies.
- If catalog size grows beyond ~2MB, revisit: a separate read-only SQLite asset
  with its own clearly named file would be the next step, not a table in
  `lilypad.db`.
