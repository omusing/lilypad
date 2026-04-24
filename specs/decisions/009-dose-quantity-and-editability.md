# 009 — Dose quantity and editability: replacing one-row-per-pill with editable intake sessions

**Status:** Decided
**Date:** 2026-04-20

## Context

The original `medication_doses` schema treated each row as a single atomic pill event
("event log — never edited or deleted"). The intent was append-only audit purity: one
row per pill, `COUNT(*)` for totals, no mutation ever.

This model breaks down for real-world use in three ways:

1. **It doesn't match how users think about intake.** A user taking two 400mg Ibuprofen
   at breakfast is performing one action — "I took Ibuprofen, twice, at 9am." Splitting
   that into two identical rows with the same timestamp is a data modelling artifact, not
   a faithful record of experience.

2. **It makes correction impossible.** The "never edited" constraint meant a user who
   logged 3 pills and meant 2 had no recourse. The schema says doses are never deleted
   either — so the wrong count is permanent. For a personal health journal, this is
   unacceptable. Users must be able to go back and correct their record.

3. **Editing UI becomes incoherent.** If the user logs 3 doses and sees a card showing
   "×3", tapping it to edit should present an obvious interface: adjust the count. With
   three separate rows, "deleting one" requires surfacing three identical rows and asking
   the user to pick one — which tells them nothing meaningful about the action they are
   correcting.

## Options considered

### Option A — One row per pill (original spec)

Immutable event log. `COUNT(*)` for totals. No editing, no deleting.

**Against:** Correct count is unrecoverable on mistake. UI cannot present a coherent
edit flow. The "audit purity" benefit has no practical value for a personal health journal
where the user is both the recorder and the auditor.

### Option B — One row per intake session, with `quantity` column (selected)

One `medication_doses` row represents one intake event: a specific medication, at a
specific time, in a specific quantity. The row is editable (quantity, time, note) and
deletable.

`quantity INTEGER NOT NULL DEFAULT 1` — how many pills/units taken in this session.
`taken_at` becomes the user-recorded time of the session, editable for back-dating.
`updated_at TEXT` nullable, same pattern as `entries` — NULL until first edit.

Report totals change from `COUNT(*)` to `SUM(quantity)` — a trivial one-line change
in every query that reads dose counts.

**For:** Matches the user's mental model. Correction is a natural "tap card → adjust
count" flow. Timeline renders one card per session (with `×N` if quantity > 1). Schema
is simpler.

## Decision

**Option B.** One row per intake session. `quantity` column. Rows are editable and
deletable.

The "append-only event log" model was never the user's intent and produces a worse
product. The marginal benefit of immutability in a personal health journal is zero.

## Consequences

### Schema changes (migration v3)

```sql
ALTER TABLE medication_doses ADD COLUMN quantity    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE medication_doses ADD COLUMN updated_at  TEXT;
```

`taken_at` semantics shift: it is now "the time the user recorded taking this medication"
(user-controlled, back-datable) rather than "the precise system timestamp at insert."
The insert sets `taken_at` to the current system time as the default; the user can edit
it. No DDL change required — the column type and constraints are unchanged.

### `db/doses.ts` changes

- `logDosesBatch` inserts one row per medication with `quantity = N` (not N rows).
- Add `updateDose(id, { quantity, taken_at, note })` — sets `updated_at` to now.
- Add `deleteDose(id)` — hard delete.
- All report queries (`SUM(quantity)` instead of `COUNT(*)`).

### Export JSON changes (export_version 2)

`medication_doses` objects gain `quantity` and `updated_at` fields. Import of
`export_version: 1` treats missing `quantity` as `1` and missing `updated_at` as `null`.

### Timeline card rendering

One `medication_doses` row = one card. `quantity > 1` → show "×{quantity}" on the card.
No grouping logic needed — the session is already the unit of record.

### Edit flow for medication cards (Timeline → Dose Edit)

Tapping a medication card in Timeline opens a Dose Edit screen. The screen resurfaces
the Log Medication UI in edit mode:

- The medication list shows the **union** of:
  - The medication referenced by this dose (`medication_id`) — always shown, even if
    archived, so the user can see what they originally logged
  - All currently active medications (`is_active = 1`) — in case the user wants to
    change which medication is recorded
- Steppers pre-populated from `quantity` (all others at 0)
- `taken_at` shown as an editable date+time field (defaults to the stored value)
- Note field pre-populated
- "Save Changes" updates the row. "Delete" removes it after confirmation.

The Dose Edit screen is distinct from the Log Medication screen in one way: it is
editing a single existing dose row, not creating new ones. "Save Changes" calls
`updateDose`, not `logDosesBatch`.

### `medication_doses` is no longer "never edited or deleted"

The schema description "One row per dose taken. Event log — never edited or deleted."
is removed and replaced with the new model. The `taken_at` column description is
updated to reflect user-editability.

### What this does NOT change

- The `medication_ids` convenience field on `entries` is unchanged — it still records
  which medications were noted during the pain wizard, as before.
- The pain wizard's "Save and Log Medication" exit still opens the Log Medication screen
  in create mode — no change there.
- The `medications` table is unchanged — archive-only, no delete.
