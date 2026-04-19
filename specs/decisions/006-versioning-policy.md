# 006 — Versioning policy: migrations, testing, and release process

**Status:** Active  
**Date:** 2026-04-18  
**Supersedes:** [003-versioning-and-migrations.md](003-versioning-and-migrations.md)

---

## Context

Lilypad has three independently-versioned data structures: the SQLite schema,
the export JSON format, and the medication catalog. The app is distributed through
the App Store — users can skip any number of releases between installs, can go years
without updating, and have no rollback path once they upgrade.

This created several design questions that needed explicit answers:

1. How do we guarantee a user who skips from v1.0 to v3.0 gets all intermediate
   migrations applied correctly?
2. How do we test migrations without committing binary `.db` files that go stale
   and are unreadable in diffs?
3. If a shipped migration is broken, what is the repair path?
4. How should we structure a development cycle so that schema changes are testable
   from day one, even when the final schema isn't known at the start?
5. Should import compatibility have a floor (e.g., only support the last 2 versions)
   or should it cover all versions ever shipped?

---

## Options considered

### Migration testing: committed binary fixtures vs. programmatic construction

**Binary `.db` files committed to git:** Snapshot the database at each version as
a binary file and use it as a test input.

Problems: unreadable as diffs, bloat git history, go stale silently when the test
helper changes, and cannot be reconstructed from first principles if lost.

**Programmatic construction (chosen):** Reconstruct the historical DB state in-memory
by running the MIGRATIONS array up to version N-1, inserting representative rows,
then applying migration N and asserting the result.

Why this works: the MIGRATIONS array is immutable once shipped, so running it always
produces the same schema. The test is always in sync with the code because it uses
the same source of truth. For hotfix scenarios, `git show <tag>:db/migrate.ts`
recovers the MIGRATIONS array from any past release.

SQL seed files (text, not binary) are the exception — used only when a specific
production data pattern cannot be constructed programmatically. These are readable
diffs and do not go stale.

### Export compatibility floor: current + one prior vs. all versions forever

**Current + one prior:** Support only the two most recent export formats. Drop
older backups with a user-facing error.

Problem: a user who exported a backup two years ago and never imported it would
lose access to their data. Given that the export is a health record, this is not
acceptable. The cost of maintaining old converters is low (a converter is typically
<20 lines); the cost of breaking old exports is high (permanent data loss).

**All versions forever (chosen):** Every converter ever written ships in every build.
No minimum supported export version. A user who created a backup at `export_version: 1`
must be able to import it into any future version of the app.

### Version number manifest: hard-coded per-file vs. centralized constant

**Hard-coded per-file:** Each module that cares about a version number has it
inline. Simple, no indirection.

Problem: the migration runner, the export writer, the import reader, and the
About screen all need version numbers. Hard-coding them in four places means they
drift. A forgotten update to one breaks the invariant silently.

**Centralized manifest (chosen):** `constants/versions.ts` exports a single
`VERSIONS` object with `db`, `export`, and `catalog` fields. Every piece of code
reads from this one file. Updating a version is one edit in one place, visible
in one diff.

### Hotfix migration: edit the broken migration vs. add a repair migration

**Edit the broken migration:** Fix the SQL directly. Clean history, no extra
migration version.

Problem: the migration has already run on user devices. Editing it only affects
fresh installs. Users who already ran the broken migration are still broken.

**Add a repair migration (chosen):** The broken migration is immutable once shipped.
The repair is a new migration at the next version that brings damaged data back
to the correct state. The migration runner's ordered-execution guarantee means
all users — regardless of when they last opened the app — will get the repair
applied the next time they launch.

---

## Decision

The versioning policy is documented operationally in [10-versioning.md](../10-versioning.md).
The core decisions made here:

- **Migrations are immutable once shipped.** Never edit a released migration.
  Add a new one to repair damage.
- **Migration tests use programmatic construction.** No binary `.db` files in git.
  Git tags anchor historical state; the MIGRATIONS array reconstructs it.
- **Export compatibility covers all versions ever released.** No floor.
- **Version numbers live in a single manifest** (`constants/versions.ts`).
- **Development cycles reserve a migration slot early** (as `SELECT 1` no-op),
  fill in SQL as features are built, and gate releases on a complete test suite.

---

## Consequences

- A developer (or Claude) can reconstruct the exact DB state of any user at any
  released version by reading the MIGRATIONS array from a git tag and running it
  in an in-memory database. No snapshots required.
- Hotfix migrations must handle all user states in the wild, including users who
  got a broken intermediate migration applied. Testing this requires running the
  full chain (v2.4 → v2.5 → v2.6) programmatically.
- SQLite's limited ALTER TABLE support (no column rename, no type change) means
  repair migrations for structural errors require full table rebuilds. This is
  acceptable; the migration runner wraps each in a transaction.
- The "converters ship forever" rule means `lib/import.ts` grows monotonically.
  Each new export version adds a converter but never removes one. This is the
  right tradeoff — import code is cheap, lost health data is not.
- There is no rollback path. A user who upgrades and encounters a migration failure
  sees an error state and must reinstall. The testing requirements in
  [10-versioning.md](../10-versioning.md) exist to make this scenario impossible
  in practice.
