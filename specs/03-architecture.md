# Architecture

## Tech Stack

- **Framework:** Expo (React Native), managed workflow
- **Language:** TypeScript
- **Navigation:** Expo Router (file-based, tabs)
- **Storage:** expo-sqlite v14+ (iOS 15+, Android 10+)
- **PDF:** expo-print (HTML + inline SVG → PDF)
- **Notifications:** expo-notifications (local only, scheduled)
- **Time pickers:** @react-native-community/datetimepicker
- **Charts:** react-native-gifted-charts (SVG-based, no Skia)
- **Build / CI:** EAS Build

---

## Data Persistence and Governance

### Principle: device-local, user-controlled

All user data lives exclusively on the device that created it. No data is transmitted
to any server — not the developer's, not Apple's, not Google's — unless the user
explicitly initiates an export themselves.

This is enforced architecturally, not by policy.

### Why not iCloud / Google backup?

By default, iOS includes the app's SQLite database in iCloud backup, and Android
includes it in Google Backup. Both of these transmit the database to a cloud server
the app developer does not control. For an app whose primary trust signal is privacy,
silently uploading a patient's pain, medication, and mood history to a cloud service
contradicts the core promise — even if that cloud service is Apple or Google.

The correct claim is: **"Your data never goes to any server — not ours, not iCloud,
not Google."** Achieving this requires explicitly opting out of platform backups.

### Implementation

**iOS — exclude from iCloud backup:**

After the SQLite database file is created (on first launch), mark it as excluded
from backup using expo-file-system:

```ts
import * as FileSystem from 'expo-file-system';

const dbUri = FileSystem.documentDirectory + 'SQLite/lilypad.db';
await FileSystem.setOptionAsync(dbUri, { isExcludedFromBackup: true });
```

Call this once after DB initialization, idempotent on subsequent launches.

**Android — exclude from Google Backup:**

In `app.json`, add a full-backup-content rule that excludes the SQLite file:

```json
{
  "expo": {
    "android": {
      "googleServicesFile": null,
      "backup": {
        "rules": {
          "fullBackupContent": "@xml/backup_rules"
        }
      }
    }
  }
}
```

Create `android/app/src/main/res/xml/backup_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="database" path="lilypad.db" />
</full-backup-content>
```

For Android 12+, also add a `data_extraction_rules.xml` with the same exclusion
(Android 12 introduced a separate rules file for cloud vs. device transfer backup).

**Verification:**

During QA, confirm the database file has `isExcludedFromBackup: true` on iOS by
inspecting the extended attribute. On Android, test by enabling Google Backup,
installing the app, adding entries, clearing the app, and verifying a restore
does not bring back the entries.

### Migration path (Option C — user-controlled export)

Because platform backups are disabled, the user is responsible for their own backups.
The app provides explicit tools to support this.

**Export:** Serialize all entries and medications to a structured JSON file.
Offer via the iOS/Android share sheet. The user decides where it goes —
Files app, their own iCloud Drive folder, email to themselves, AirDrop.
The app never touches the destination.

**Import:** File picker (expo-document-picker) reads a previously exported JSON file,
validates the schema, and inserts records into SQLite. Duplicate detection: skip any
entry whose `created_at` timestamp already exists in the database.

Both directions are required in V1. Export without import is not a migration tool —
it is a data dump the user cannot use.

**JSON schema and import/export procedure:** See [05-data-schema.md — Export JSON schema](05-data-schema.md#export-json-schema).

### In-app messaging

Settings screen — "Your Privacy" section:

> Your data never goes to any server — not ours, not iCloud, not Google.
> It lives only on this device. Use **Export** below to create a backup you control.

Onboarding wizard (Step 3, after setting reminders):

> Unlike most health apps, Lilypad never uploads your data anywhere.
> To protect your entries when switching phones, use Export in Settings to
> save a backup to your Files app.

### Legal and regulatory position

An app that never receives, stores, or transmits protected health information
is outside the scope of HIPAA's covered entity and business associate definitions.
Lilypad's architecture is designed to maintain this position permanently.

Do not add any telemetry, analytics SDK, or crash reporting tool that transmits
user-generated content (entries, notes, medication names) off-device. Crash
reporters (e.g., Sentry) may be used only if configured to scrub all payload data
before transmission — event metadata only, never entry content.

---

## Folder Structure

```
app/
  (tabs)/
    index.tsx          # Home
    check-in.tsx       # Check-In tab (opens wizard)
    history.tsx        # History list
    medications.tsx    # Medications tab
    report.tsx         # Report + PDF export
    about.tsx          # About + Contact screen
    _layout.tsx        # Tab navigator
  modal.tsx            # Check-in wizard (modal stack)
  entry/[id].tsx       # Entry Detail / Edit (shared add + edit screen)
  _layout.tsx          # Root layout

components/
  wizard/              # Step components (Step1Pain, Step2Location, ...)
  charts/              # Sparkline, LineChart wrappers
  pdf/                 # HTML template builder, SVG generator
  medications/         # MedCard, DoseHistory, AddMedModal
  ui/                  # Shared: Button, Toast, Badge, EmptyState

db/
  schema.ts            # CREATE TABLE statements + migration runner
  entries.ts           # CRUD for entries table (create, read, update, delete; sets updated_at on edit)
  medications.ts       # CRUD for medications + medication_doses
  settings.ts          # app_settings read/write
  migrate.ts           # Version-gated migration functions

hooks/
  useEntries.ts
  useMedications.ts
  useSettings.ts

lib/
  export.ts            # Serialize DB → JSON
  import.ts            # Parse JSON → insert into DB
  pdf.ts               # Assemble HTML + SVG for report
  notifications.ts     # Schedule / cancel local notifications

constants/
  regions.ts           # Pain region labels (patient-facing 11)
  qualities.ts         # Pain quality options (10)
  triggers.ts          # Trigger options (12)
  theme.ts             # Colors, fonts
```

---

## Key Patterns

- **DB access:** All SQLite calls go through `db/` modules. No raw SQL outside `db/`.
  Full table definitions, column constraints, and enum values: [05-data-schema.md](05-data-schema.md).
- **Schema migrations:** `db/migrate.ts` reads `schema_version` from `app_settings`
  on launch and runs pending migrations in a transaction before any other DB access.
- **No network calls involving user data.** Ever. If a future feature requires network
  access (e.g., fetching weather for trigger correlation), it must not transmit any
  entry data — only anonymous queries (e.g., lat/lon rounded to city level, no user ID).
- **PDF charts are computed SVG**, not view-shots of rendered components. Avoids
  Skia/view-shot race conditions on Android.
- **Notification scheduling:** All notifications are local. Scheduled via
  expo-notifications on Settings save. Re-scheduled on app launch in case OS cleared
  them (common after reboot on Android).
