# Features

## Core Features (V1)

---

### Check-In Entry

Users log pain twice daily — morning and evening. Every entry belongs to one of
these two periods, regardless of when it was actually filled in.

Morning captures overnight and wake-up state. Evening captures end-of-day state.
These are the two windows with the highest clinical signal for diurnal pain variation
and are the data points providers most commonly ask about in appointments.

The cadence coincides with the most prevalent chronic pain medication schedule (BID),
making the habit easy to layer onto an existing routine. However, check-ins are not
triggered by or tied to medication intake. Medication doses are logged independently
via the Medications tab. The wizard question "which medications did you take?" is a
shortcut to catch doses that were not logged at the time — not the canonical dose
record. See [decisions/001-check-in-cadence.md](decisions/001-check-in-cadence.md).

**Fields captured per entry:**
- Pain score (0–10)
- Pain location (11 regions, multi-select)
- Pain quality (10 descriptors, multi-select, optional)
- Triggers (12 options, multi-select, optional)
- Mood (1–5 emoji scale, optional)
- Sleep quality (1–5 emoji scale, optional)
- Medications taken (from personal medication list, multi-select, optional)
- Free-text note for provider (optional)

**Input method — open design decision:**
The input method for check-in entries is not finalized. Two approaches are
under consideration and may be combined:

- **5-step wizard:** One topic per screen, progress indicator, guided flow.
  Better for first-time users and users who find forms overwhelming. Reduces
  cognitive load per screen.

- **Scrollable form:** All fields on one screen, scroll to complete. Faster
  for returning users who know the app. Easier to review before submitting.

Both approaches may be offered simultaneously (e.g., wizard as default for
first N check-ins, then offer a "quick mode" option). The demo phase will
inform which approach works better for this demographic.

Regardless of input method: the entry must be completable in under 60 seconds
for the pain score + location minimum case.

---

### Home Screen

- Greeting with time-of-day context ("Good morning" / "Good evening")
- Today's AM / PM check-in completion status
- 14-day pain sparkline (daily average, gaps for missing days)
- Primary CTA: "Start Check-In" (or "Start Morning Check-In" / "Start Evening
  Check-In" depending on time of day and completion status)
- Access to Settings via header icon

---

### History / Records

Scrollable log of all entries, newest first. This screen is the primary surface
for reviewing and managing past entries.

**Viewing:**
- Each row: date, period badge (🌅 Morning / 🌙 Evening),
  pain level badge (color-coded), top regions, mood emoji
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

**Date and time fields (always shown, always editable):**
- **Date selector:** Defaults to today. User can select any past date.
  Uses `@react-native-community/datetimepicker` (mode="date").
  Future dates are disabled.
- **Check-in period:** Segmented control — Morning | Evening.
  Defaults to Morning if before noon, Evening if noon or later.
  Every entry is one or the other — back-dated, edited, or same-day.

**Clinical fields (same as wizard):**
- Pain score, regions, qualities, triggers, mood, sleep, medications, note

**On save:**
- `entry_date` = date selected in the date picker (YYYY-MM-DD). Used for report
  aggregation and the home-screen sparkline.
- `check_in_period` = period selected (morning / evening).
- For new entries: `created_at` = precise system timestamp at insert. `updated_at` = NULL.
- For edits: `entry_date` and `check_in_period` reflect the user's selection. `created_at`
  unchanged (original insert time preserved). `updated_at` = precise system timestamp.
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
  check-ins completed
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
- Morning check-in reminder (toggle + time picker)
- Evening check-in reminder (toggle + time picker)
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
3. Set reminders — morning and evening times, requests notification permission
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
- Custom date range for reports
- Trigger correlation insights ("pain tends to be higher after poor sleep")

## Deferred (V2+)

- Shared / multi-patient mode (caregiver logging for a family member)
- Detailed body region selector (granular clinical regions, currently in spec
  as reference only)
- Weather trigger auto-detection
- Apple Health / Google Fit integration
- Voice entry

