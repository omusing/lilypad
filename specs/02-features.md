# Features

## Core Features (V1)

---

### Pain Log Entry

Users log a pain reading when they choose to — typically when they feel something
worth recording, or when prompted by a reminder. There is no mandatory morning/evening
structure. Each log is a timestamped event.

Two daily reminder notifications are available (morning and evening) as configurable
habit scaffolds. They are not structural requirements — the user can log as often or
as rarely as their experience warrants. See
[decisions/002-event-driven-logging.md](decisions/002-event-driven-logging.md).

**Fields captured per pain log:**
- Pain score (0–10, required)
- Pain location (11 regions, multi-select, required — at least 1)
- Pain quality (10 descriptors, multi-select, optional)
- Triggers (12 options, multi-select, optional)
- Mood (1–5 emoji scale, optional)
- Sleep quality (1–5 emoji scale, optional)
- Medications noted (from personal medication list, multi-select, optional —
  a convenience shortcut; the canonical dose record is in `medication_doses`)
- Free-text note for provider (optional)

**Input method:** 5-step wizard. One topic per screen, progress indicator,
guided flow. Suitable for first-time users and users who find forms
overwhelming. The demo will validate whether a "quick mode" (scrollable form)
should be offered to returning users.

The minimum case (pain score + location only) must be completable in under 60 seconds.

---

### Home Screen

- Greeting with patient name (if set)
- Two equal primary action buttons: **"Log Pain"** and **"Log Medication"**
- Recent activity summary: last pain log time, last medication logged
- 14-day pain sparkline (daily pain log count or average, gaps for days with no entries)
- Access to Settings via header icon

---

### History / Records

Scrollable log of all entries, newest first. This screen is the primary surface
for reviewing and managing past entries.

**Viewing:**
- Each row: date + time, pain level badge (color-coded), top regions, mood emoji
- Tap row → Entry Detail

**Adding from History:**
Users can add a new entry directly from the History screen (not only via the
Home screen CTA). Useful for catch-up logging or adding a back-dated entry while
reviewing past records.

**Editing:**
Entry Detail is editable in V1. Users can correct errors in any historic record.
All fields are editable. Edited entries retain their original `created_at`
timestamp; a separate `updated_at` timestamp is added on save.

**Deleting:**
Per-entry delete from History (swipe or long-press) or from Entry Detail.
Confirmation required. Cannot be undone.

---

### Entry Detail (Add / Edit)

Used for both viewing existing entries and creating new ones from the History
screen. All fields are editable.

**Date field (always shown, always editable):**
- **Date selector:** Defaults to today. User can select any past date.
  Uses `@react-native-community/datetimepicker` (mode="date").
  Future dates are disabled.
  (The time of logging is always `created_at` — the system timestamp at insert.
  Back-dating changes `entry_date` but not `created_at`.)

**Clinical fields (same as wizard):**
- Pain score, regions, qualities, triggers, mood, sleep, medications, note

**On save:**
- `entry_date` = date selected in the date picker (YYYY-MM-DD). Used for report
  aggregation and the home-screen sparkline.
- For new entries: `created_at` = precise system timestamp at insert. `updated_at` = NULL.
- For edits: `entry_date` reflects the user's date selection. `created_at` unchanged
  (original insert time preserved). `updated_at` = precise system timestamp.
- Save / Cancel buttons. Delete button (with confirmation) on existing entries.

---

### Medications

**Medication list:**
- Add, edit, archive medications (name, dose, route, frequency)
- "Took it now" quick-log button (inserts a dose log with current timestamp)
- Today's dose count and last dose time shown on each card
- Per-medication dose history
- Optional per-medication reminder notification

**Medication management:**
- Archived medications are hidden by default but preserved (dose history intact)
- No delete — archive only, to preserve historical dose data

---

### Report

**Date range:** Last 7 / 30 / 90 days (preset tabs)

**Clinical content:**
- Summary stats: average, peak, and low pain; average mood; average sleep;
  pain logs count (total entries in period)
- Pain trend line chart (daily average, gaps for days with no entries)
- Top triggers by frequency (horizontal bar chart)
- Most affected regions by frequency
- Medications summary (total doses per medication in period)
- All patient notes (free text, timestamped)

**PDF export:**
- Branded — ThePainNP name/logo in header (logo asset and exact copy TBD,
  not blocking demo build; use placeholder text for demo)
- A4 format, clinical-grade layout
- Chart rendered as inline SVG (computed from data, not a screen capture)
- Opened via share sheet; user controls destination
- SVG render fallback: if chart fails on Android WebView, include tabular data
  only with a note "Chart unavailable on this device"

---

### About + Contact

A dedicated screen (accessible from Settings or a persistent footer link)
covering:

**About section:**
- What Lilypad is and who made it
- Brief description of ThePainNP (name, credentials, practice focus)
- The privacy commitment: "Your data never goes to any server — not ours,
  not iCloud, not Google. It lives only on this device."

**Social media links:**
- Links to ThePainNP's social platforms (Instagram, TikTok, YouTube, etc.)
- Opens in the device's default browser / platform app

**Legal notice:**
- "Lilypad is not a medical device. It is a personal logging tool. Nothing
  in this app constitutes medical advice, diagnosis, or treatment.
  Always consult your healthcare provider."
- App version number

**Privacy commitment (expanded):**
- Explanation of Option C data model in plain language:
  "We never collect your data. We built Lilypad so that even we cannot see
  what you log. Your entries are stored only on this device and excluded from
  iCloud and Google backups. The only way your data leaves this device is if
  you choose to export it yourself."

---

### Settings

- Patient name (shown on PDF and Home greeting)
- Morning reminder (toggle + time picker) — habit scaffold, not a structural requirement
- Evening reminder (toggle + time picker) — habit scaffold, not a structural requirement
- Export your data (JSON, via share sheet)
- Import from backup (file picker)
- Delete all entries (confirmation required; medications preserved)
- Link to About + Contact screen
- App version

---

### Onboarding Wizard (first launch only)

4 steps:
1. Welcome — what Lilypad does, the privacy promise
2. Your name (optional) — appears on report and greeting
3. Set reminders — optional morning and evening notification times, requests notification permission
4. Add medications (optional) — same form as Medications tab

---

## Data Portability (V1)

See [03-architecture.md](03-architecture.md) for full technical spec.

**Export:** All entries, medications, and dose logs → versioned JSON file →
share sheet → user-controlled destination.

**Import:** File picker → validate schema → preview ("N entries, date range") →
insert with duplicate detection (skip entries whose `created_at` already exists).

Both directions required in V1. Export without import is not a migration path.

---

## Deferred (V1.1)

- **Catch-up flow:** Surface a prompt when a user reopens the app after missing
  N days: "You haven't logged in 3 days — want to add a quick entry for how
  you've been feeling?" Lightweight single-screen entry, not the full wizard.
- **Unified timeline:** A single scrollable timeline mixing pain log entries and
  medication dose events, visually differentiated by type. Currently pain logs
  (History tab) and medication doses (Medications tab) are separate views.
- **Medication schedule + missed-dose reminders:** User defines an expected
  dosing schedule per medication (e.g., "Ibuprofen at 8am and 8pm"). App detects
  when a scheduled dose was not logged and offers a retroactive prompt. Requires
  the medication schedule concept not present in V1.
- Custom date range for reports
- Trigger correlation insights ("pain tends to be higher after poor sleep")

## Deferred (V2+)

- Shared / multi-patient mode (caregiver logging for a family member)
- Detailed body region selector (granular clinical regions, currently in spec
  as reference only)
- Weather trigger auto-detection
- Apple Health / Google Fit integration
- Voice entry

