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
- Mood (1–5 scale, optional)
- Sleep quality (1–5 scale, optional)
- Free-text note for provider (optional)

Note: medication is no longer a field in the pain log. See "Log Medication" below
for how the two flows connect.

**Input method:** 4-step wizard. One topic per screen, progress indicator, guided
flow. Suitable for first-time users and users who find forms overwhelming.

Steps:
1. Pain score (required — Next disabled until selected)
2. Body regions via body map (required — Next disabled until at least one selected)
3. Pain quality + triggers (optional — Next always enabled)
4. Mood + sleep + provider note (optional) — two exit actions:
   **"Save Pain Log"** and **"Save and Log Medication"**. The second saves the pain
   entry and immediately opens the Log Medication wizard.

The minimum case (pain score + location only) must be completable in under 60 seconds.

**UI rules for the wizard:**
- Do not show "optional" labels on step headings or section copy. The Next button
  behavior communicates what is required; everything else is self-explanatory.
- Do not show the helper text "0 = no pain / 10 = worst imaginable" above the pain
  score list. Each row already labels 0 and 10 explicitly.
- Chips (regions, qualities, triggers) are listed in alphabetical order.
- The entire wizard background, progress bar, and primary action button use the pain
  color family (`Colors.pain`, `#A84A42` / `Colors.painLight`, `#F6EAE8`) so the
  user always knows they are in the pain flow.
- All button labels use Title Case. No ampersand — use "and" in full.

**Previous selections:** On opening the pain wizard, load the most recent entry and
soft-pre-select its regions, qualities, and triggers. The user can deselect any of
them. Pain score is never pre-selected — it must always be a conscious choice.

---

### Log Medication

A dedicated flow, visually distinct from the pain wizard. The entire wizard background,
progress bar, and primary action button use the medication color family
(`Colors.med`, `#2E7D5E` / `Colors.medLight`, `#E6F3ED`).

**Multi-medication, multi-dose session:**
- User selects one or more medications from their active list in a single session.
- Each selected medication shows a stepper (− / +) to set the dose count. Each
  increment inserts one additional `medication_doses` row with the same `taken_at`
  timestamp.
- Optional note per session (shared across all logged doses).
- Single "Log Doses" action saves all selected medications and counts at once.

Accessible via:
- Home screen "Log Medication" button
- "Save and Log Medication" exit from the pain wizard (step 4)

---

### Home Screen

- Greeting with patient name (if set)
- Two equal primary action buttons: **"Log Pain"** and **"Log Medication"**
- Recent activity summary: last pain log time, last medication logged
- 14-day pain sparkline (daily pain log count or average, gaps for days with no entries)
- Access to Settings via header icon

---

### Timeline

Unified scrollable view showing pain entries and medication dose events together,
newest first. This is the primary surface for reviewing history. See
`decisions/008-unified-timeline.md` for rationale.

**Layout:**
- Date divider rule: `─────── APRIL 17 ───────` — full-width horizontal rule with
  date centered in uppercase, letter-spacing 1.2px
- Two columns below each divider: pain cards on the left, medication cards on the right
- Vertical rule at 50% between columns (1px, `divider` color)
- Days with only pain events, or only medication events, leave the opposite column empty

**Pain cards (left column):**
- Right border in the pain ramp color for that entry's score
- Pain level badge (34×34, ramp color) + time
- Top regions label
- Optional note excerpt

**Medication cards (right column):**
- Left border in `med` green
- Medication name, dose, time
- Dose count (×2 etc.) if more than one

**Adding from Timeline:**
Users can add a new pain entry directly from the Timeline screen for catch-up logging
or back-dated entries.

**Editing:**
Tap any pain card → Entry Detail (all fields editable).
Tap any medication card → read-only dose detail (V1).

**Deleting:**
From Entry Detail only. Confirmation required. Cannot be undone.

---

### Entry Detail (Add / Edit)

Used for both viewing existing entries and creating new ones from the Timeline.
All fields are editable.

**Date field (always shown, always editable):**
- Defaults to today. User can select any past date.
  Uses `@react-native-community/datetimepicker` (mode="date"). Future dates disabled.

**Clinical fields:**
- Pain score, regions, qualities, triggers, mood, sleep, note

**On save:**
- `entry_date` = date selected (YYYY-MM-DD).
- New entries: `created_at` = system timestamp at insert. `updated_at` = NULL.
- Edits: `created_at` unchanged. `updated_at` = system timestamp.
- Save / Cancel buttons. Delete button (with confirmation) on existing entries.

---

### Medications

Management screen only. Adding, editing, and archiving medications. Dose intake
is handled exclusively through the Log Medication wizard — not from this screen.

**Medication list:**
- Each row: medication name, dose, route, frequency
- Today's dose count and last dose time shown per row
- Edit icon button → inline edit of name/dose/route/frequency
- Archive icon button → confirmation dialog → sets `is_active = 0`
- Archived medications hidden by default, preserved with full dose history

**Adding a new medication:**
"Add Medication" button (labelled, not a "+" icon) in the screen header. Opens the
Add Medication sheet.

**No "Took it now" button on this screen.** The Medications screen is for list
management only. Intake is logged via Log Medication (Home CTA or pain wizard exit).

**Medication management:**
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
- Branded — ThePainNP name/logo in header (placeholder for demo)
- A4 format, clinical-grade layout. PDF header uses Lora for display text.
- Chart rendered as inline SVG (computed from data, not a screen capture)
- Opened via share sheet; user controls destination
- SVG render fallback: tabular data if chart fails on Android WebView

**Export button label:** "Export PDF Report"

---

### About + Contact

**Privacy copy tone:** Warm and reassuring, not defensive or technical. Plain language,
no jargon. Positive framing: "Your notes are yours. They live on your phone and go
nowhere." Exact copy TBD.

**Content:**
- What Lilypad is and who made it
- Brief description of ThePainNP (name, credentials, practice focus)
- Privacy commitment (plain language)
- Social media links — opens in browser / platform app
- Legal notice: not a medical device, not medical advice
- App version number

---

### Settings

- Patient name (used on exported reports; no inline hint needed)
- Morning reminder toggle + time pill (tappable pill shows current time; opens picker on tap)
- Evening reminder toggle + time pill (same pattern)
- Export your data (JSON, via share sheet)
- Import from backup (file picker)
- Delete all entries (confirmation required; medications preserved)
- Link to About + Contact screen
- App version

**Reminder time picker UI:**
Time shown as a tappable filled pill (white text, `Colors.med` background, 28px
border-radius). Disabled state: `Colors.border` bg, `Colors.textSecondary` text.
Tapping opens the time picker inline.

**Inline hints:** Only when content is genuinely non-obvious. Self-evident fields
carry no sub-label.

**Developer tools** (visible in development builds only):
- Reset all data — flush DB, return to onboarding
- Back to intro — navigate to onboarding without clearing data
- Load persona: Jerry (mild, daily, consistent)
- Load persona: Micky (high-variance, irregular, multi-medication)
- Load persona: Donny (medication-focused, minimal pain logging)
- Load persona: Client A (30 days, head pain 3–6, Ibuprofen)

See [specs/08-dev-tools.md](08-dev-tools.md) for full persona definitions.

---

### Onboarding Wizard (first launch only)

4 steps:
1. Welcome — what Lilypad does, the privacy promise
2. Your name (optional) — used on exported reports
3. Set reminders — optional morning and evening notification times
4. Add first medication (optional) — same form as Medications tab

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
  N days. Lightweight single-screen entry, not the full wizard.
- **Medication schedule + missed-dose reminders:** User defines an expected dosing
  schedule per medication. App detects missed doses and offers a retroactive prompt.
- Custom date range for reports
- Trigger correlation insights ("pain tends to be higher after poor sleep")
- Per-medication dose history view (dose log scrollable from Medication Detail)

## Deferred (V2+)

- Shared / multi-patient mode (caregiver logging for a family member)
- Detailed body region selector (granular clinical regions)
- Weather trigger auto-detection
- Apple Health / Google Fit integration
- Voice entry
