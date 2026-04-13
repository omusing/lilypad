# Data Schema

SQLite database file: `lilypad.db`
Location: `expo-file-system` documentDirectory + `SQLite/lilypad.db`

All tables are created in `db/schema.ts`. All SQLite access goes through `db/`
modules — no raw SQL anywhere else in the codebase.

---

## Tables

### `entries`

One row per check-in submission. The core clinical record.

```sql
CREATE TABLE IF NOT EXISTS entries (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date       TEXT    NOT NULL,
  check_in_period  TEXT    NOT NULL,
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
```

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | — | Auto-increment PK |
| `entry_date` | TEXT | No | YYYY-MM-DD. User-selected date. Used for report aggregation and sparkline. Not the insert time. |
| `check_in_period` | TEXT | No | `'morning'` or `'evening'`. The clinical slot, not the clock time of submission. |
| `pain_level` | INTEGER | No | 0–10 |
| `pain_regions` | TEXT | No | JSON array of region keys. Min 1 selection required. Example: `["lower_back","hips"]` |
| `pain_qualities` | TEXT | Yes | JSON array of quality keys. Optional. Example: `["aching","throbbing"]` |
| `triggers` | TEXT | Yes | JSON array of trigger keys. Optional. |
| `mood` | INTEGER | Yes | 1–5. Optional. |
| `sleep_quality` | INTEGER | Yes | 1–5. Optional. |
| `medication_ids` | TEXT | Yes | JSON array of `medications.id` values (device-local SQLite IDs). Optional. |
| `note` | TEXT | Yes | Free-text provider note. Optional. |
| `created_at` | TEXT | No | ISO 8601 precise system timestamp at insert. **Never modified after insert.** Used as the canonical unique identifier for deduplication during import. |
| `updated_at` | TEXT | Yes | ISO 8601 precise system timestamp of the most recent edit. NULL until first edit. Set on every subsequent save. |

**Constraints:**
- `check_in_period` must be `'morning'` or `'evening'`. Enforced in application code (`db/entries.ts`), not a DB check constraint (SQLite CHECK constraint optional but recommended).
- `entry_date` must be a valid YYYY-MM-DD date not in the future. Enforced in application code.
- At most one entry per `(entry_date, check_in_period)` pair is expected by the UX, but not enforced at the DB level. The UI prevents duplicate submission; the import path uses `created_at` for deduplication.

**Timestamp semantics:**
- `entry_date` + `check_in_period` = what this entry is *for* (user-controlled, editable)
- `created_at` = when the row was *inserted* (system-controlled, immutable)
- `updated_at` = when the row was last *changed* (system-controlled, set on edit)

These three things are distinct. See [decisions/001-check-in-cadence.md](decisions/001-check-in-cadence.md).

---

### `medications`

The user's personal medication list. No delete — archive only.

```sql
CREATE TABLE IF NOT EXISTS medications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  dose        TEXT,
  route       TEXT,
  frequency   TEXT,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL
);
```

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | — | Auto-increment PK. **Device-local — do not expose in exports as a stable identifier.** Export uses remapping (see export schema below). |
| `name` | TEXT | No | Medication name as entered by user. No normalization. |
| `dose` | TEXT | Yes | e.g. `"400mg"`, `"10mg/5mL"`. Free text. |
| `route` | TEXT | Yes | e.g. `"oral"`, `"topical"`, `"injection"`. Free text. |
| `frequency` | TEXT | Yes | e.g. `"as needed"`, `"BID"`, `"TID"`. Free text, not an enum. |
| `is_active` | INTEGER | No | `1` = active (shown), `0` = archived (hidden by default). Default `1`. No delete. |
| `created_at` | TEXT | No | ISO 8601 timestamp at insert. |

---

### `medication_doses`

One row per dose taken. Event log — never edited or deleted.

```sql
CREATE TABLE IF NOT EXISTS medication_doses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  medication_id  INTEGER NOT NULL REFERENCES medications(id),
  taken_at       TEXT    NOT NULL,
  note           TEXT
);
```

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | — | Auto-increment PK |
| `medication_id` | INTEGER | No | FK → `medications.id` |
| `taken_at` | TEXT | No | ISO 8601 precise system timestamp at the moment the user tapped "Took it now." |
| `note` | TEXT | Yes | Optional free-text note per dose. Not exposed in V1 UI but preserved in export. |

**Note on `entries.medication_ids`:** The JSON array in `entries.medication_ids`
is a shortcut — it records which medications the user confirms having taken
during a check-in period. It is not a replacement for `medication_doses`. A dose
logged via "Took it now" appears in `medication_doses` with a precise timestamp;
the wizard question "which meds did you take this period?" writes to
`entries.medication_ids` as a convenience summary. Both can be populated
independently.

---

### `app_settings`

Single-row key-value store for user preferences and app state.

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  id                INTEGER PRIMARY KEY DEFAULT 1,
  patient_name      TEXT,
  morning_reminder  INTEGER NOT NULL DEFAULT 0,
  morning_time      TEXT    NOT NULL DEFAULT '08:00',
  evening_reminder  INTEGER NOT NULL DEFAULT 0,
  evening_time      TEXT    NOT NULL DEFAULT '20:00',
  onboarding_done   INTEGER NOT NULL DEFAULT 0,
  schema_version    INTEGER NOT NULL DEFAULT 1
);
```

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | INTEGER | — | Always `1`. Single-row table. |
| `patient_name` | TEXT | Yes | Shown on home greeting and PDF header. Optional. |
| `morning_reminder` | INTEGER | No | `0` = off, `1` = on. Default `0`. |
| `morning_time` | TEXT | No | HH:MM. Default `'08:00'`. Used to schedule the morning notification. |
| `evening_reminder` | INTEGER | No | `0` = off, `1` = on. Default `0`. |
| `evening_time` | TEXT | No | HH:MM. Default `'20:00'`. Used to schedule the evening notification. |
| `onboarding_done` | INTEGER | No | `0` = show onboarding on next launch, `1` = skip. Set at end of onboarding wizard. |
| `schema_version` | INTEGER | No | Current DB schema version. Read by `db/migrate.ts` on every launch to determine which migrations to run. Starts at `1`. |

**Initialization:** The row is inserted with defaults on first launch before any
other DB access. `db/migrate.ts` reads `schema_version` from this row, runs any
pending migrations in a transaction, and updates `schema_version` when done.

---

## Enum values

**`entries.check_in_period`**
- `'morning'` — the AM check-in window (anchored to morning state)
- `'evening'` — the PM check-in window (anchored to end-of-day state)

**`entries.pain_level`** — integer 0–10

**`entries.mood`** — integer 1–5 (emoji scale; 1 = worst, 5 = best)

**`entries.sleep_quality`** — integer 1–5 (emoji scale; 1 = worst, 5 = best)

**`medications.is_active`** — `1` active, `0` archived

**`app_settings.morning_reminder` / `evening_reminder`** — `1` on, `0` off

**`app_settings.onboarding_done`** — `1` done, `0` not done

---

## JSON column reference values

Pain regions, qualities, and triggers are stored as JSON arrays of string keys.
The canonical key lists live in `constants/`:

- `constants/regions.ts` — 11 region keys with patient-facing labels
- `constants/qualities.ts` — 10 quality keys with labels
- `constants/triggers.ts` — 12 trigger keys with labels

Example stored value: `'["lower_back","hips","knees"]'`

Parse with `JSON.parse()` on read. Validate keys against the constant lists on
import to handle version mismatches gracefully (unknown keys: preserve, don't drop).

---

## Migration strategy

`db/migrate.ts` runs on every app launch, before any other DB access:

1. Read `schema_version` from `app_settings`
2. For each migration whose version > `schema_version`, run in order inside a
   single transaction
3. Update `schema_version` to the latest applied version
4. If any migration fails, roll back the transaction and surface an error

V1 ships at `schema_version = 1`. All four tables are created in migration 1.
Subsequent migrations are additive only — no column drops or type changes.

---

## Export JSON schema

Full schema used by `lib/export.ts` and validated by `lib/import.ts`.

```json
{
  "export_version": 1,
  "exported_at": "2026-04-13T09:00:00Z",
  "app_version": "1.0.0",
  "entries": [
    {
      "entry_date": "2026-04-12",
      "check_in_period": "morning",
      "pain_level": 7,
      "pain_regions": ["lower_back", "hips"],
      "pain_qualities": ["aching", "throbbing"],
      "triggers": ["poor_sleep", "stress"],
      "mood": 2,
      "sleep_quality": 1,
      "medication_ids": [1],
      "note": "worse after sitting for an hour",
      "created_at": "2026-04-12T09:14:32Z",
      "updated_at": null
    }
  ],
  "medications": [
    {
      "id": 1,
      "name": "Ibuprofen",
      "dose": "400mg",
      "route": "oral",
      "frequency": "as needed",
      "is_active": 1
    }
  ],
  "medication_doses": [
    {
      "medication_id": 1,
      "taken_at": "2026-04-12T08:00:00Z",
      "note": null
    }
  ]
}
```

**ID remapping on import:** `medications[].id` and `medication_doses[].medication_id`
and `entries[].medication_ids` all reference each other within the export file —
not the device's internal SQLite IDs, which will differ after import. Import
procedure:

1. Insert medications first, build `oldId → newId` map
2. Rewrite `medication_doses[].medication_id` using the map, then insert
3. Rewrite each value in `entries[].medication_ids` arrays using the map, then insert
4. Deduplication: skip any entry where `created_at` already exists in the DB

**Partial failure:** If any step fails, roll back all inserts for that import run.
Do not commit a partial import.
