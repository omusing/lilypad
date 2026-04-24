# Screens

Screen-by-screen specification: layout, states, actions, navigation, and edge cases.
Visual design (colors, typography, spacing) is in [04-design-system.md](04-design-system.md).
Data fields and constraints are in [05-data-schema.md](05-data-schema.md).

**Prototype-validate:** items marked ⚠️ are intentionally underspecified and must
be validated through physical prototype testing before finalizing.

---

## Navigation structure

```
Tab bar (always visible):
  Home | Timeline | Medications | Report

Modal stack (over tab bar):
  Pain Check-In Wizard   ← launched from Home "Log Pain" button
  Log Medication sheet   ← launched from Home "Log Medication" button or pain wizard exit
  Add Medication sheet   ← launched from Onboarding / Medications "+"

Full-screen stack (pushed from tab):
  Entry Detail           ← from Timeline pain card
  Medication Detail      ← from Medications card
  Settings               ← from gear icon in Home header
  About + Contact        ← from Settings

Onboarding (replaces tab bar on first launch)
```

---

## Onboarding

**Trigger:** `onboarding_done = 0` in `app_settings`. Shown on first launch only.
On completion, set `onboarding_done = 1` and navigate to Home.

Users can skip any optional step with a "Skip" link (top right). Skipping does not
show that step again — they can configure later in Settings.

### Step 1 — Welcome

**Layout:**
- Lilypad logo / wordmark (centered)
- Headline: "Your pain diary. Private by design."
- Body copy: what the app does in 2–3 sentences
- Privacy statement: "Your data never leaves this device. No account. No cloud. Ever."
- CTA button: "Get Started"

**No back button.** First screen of the flow.

---

### Step 2 — Your name (optional)

**Layout:**
- Headline: "What should we call you?"
- Subtext: "Your name appears on your check-ins and exported reports. You can change
  this anytime in Settings."
- Single text input, placeholder: "First name"
- "Skip" link (top right)
- "Continue" button (enabled whether or not name is filled in)

**On continue:** save `patient_name` to `app_settings` (or leave null if skipped/blank).

---

### Step 3 — Reminders

**Layout:**
- Headline: "Set your reminders"
- Subtext: "A gentle nudge — morning and evening — helps you build the logging habit.
  You can log anytime, but reminders help on busy days."
- Morning row: toggle (default off) + time picker (default 08:00, enabled only when toggle is on)
- Evening row: toggle (default off) + time picker (default 20:00, enabled only when toggle is on)
- Privacy note below: "Unlike most health apps, Lilypad never uploads your data anywhere.
  To protect your entries when switching phones, use Export in Settings to save a
  backup to your Files app."
- "Skip" link (top right)
- "Continue" button

**On continue:** if any reminder is toggled on, request notification permission
(`expo-notifications`). If permission is denied, reminders are silently disabled
(show a brief toast: "Enable notifications in Settings to use reminders"). Save
reminder settings to `app_settings`.

---

### Step 4 — Add medications (optional)

**Layout:**
- Headline: "Add your medications"
- Subtext: "You'll be able to log which medications you took during each check-in."
- Empty state with "+" button and instruction: "Tap + to add a medication"
- As medications are added, they appear as a compact list (name + dose)
- Each list item has a delete icon (remove from this onboarding session only,
  before the row is persisted — or delete from DB if already saved)
- "Skip" link (top right)
- "Done" button

**Adding a medication:** tapping "+" opens the Add Medication sheet (see below).
On save, the new medication appears in the list immediately.

**On "Done":** navigate to Home tab.

---

## Add Medication sheet

Reusable bottom sheet. Invoked from:
- Onboarding step 4
- Medications tab "+" button
- ⚠️ Check-in wizard step 5 "+" (validate in prototype)

**Layout:**
- Sheet handle at top
- Headline: "Add medication"
- Fields (scrollable form):
  - Name (text input, required, placeholder: "Medication name") — supports autocomplete (see below)
  - Dose (text input, optional, placeholder: "e.g. 400mg") — pre-filled on catalog selection
  - Strength chips (horizontal scroll, appears below Dose after a catalog selection — see below)
  - Route (text input, optional, placeholder: "e.g. oral, topical") — pre-filled on catalog selection
  - Route chips (horizontal scroll, appears below Route when catalog entry has multiple routes)
  - Frequency (text input, optional, placeholder: "e.g. as needed, BID")
- "Save" button (disabled until Name is filled)
- "Cancel" link or swipe down to dismiss

**Autocomplete behavior:**

The Name field supports inline autocomplete backed by the offline medication catalog
([09-medicine-list.md](09-medicine-list.md)). Both brand names and generic names match.

As the user types:
- Up to 5 suggestions appear directly below the Name field.
- Each suggestion shows: brand name (or generic if no brand) on the left, generic name
  + drug class on the right. Example: `Advil   ibuprofen · NSAID`
- Typing "Advil", "adv", "ibuprofen", or "ibu" all surface the same entry.

On selecting a suggestion:
- Name field fills with the selected brand name (e.g. "Advil") — not the partial query,
  not the generic name. Whatever was in the suggestion's left column.
- Dose field pre-fills with the first available strength. Strength chips appear below
  the Dose field: one chip per available strength (e.g. `200 mg` `400 mg` `600 mg`
  `800 mg`). The chip matching the pre-filled dose is visually active. Tapping any
  chip overrides the Dose field.
- Route field pre-fills with the first available route (e.g. "oral").
- If the catalog entry has more than one route, route chips appear below the Route field
  the same way. Tapping a chip overrides the Route field.
- Frequency field remains empty.

**Clearing a catalog selection:** If the user manually types in the Name field after
selecting a catalog entry, the selection is cleared — strength chips and route chips
disappear, the pre-filled Dose and Route remain (the user keeps what they had) but
`catalog_rxcui` will not be saved since no catalog entry is linked.

The user can override any pre-filled field at any time. Autocomplete is a convenience,
not a gate. Medications not in the catalog can be entered entirely by free text — the
suggestion list simply doesn't appear.

**Edit flow:** When editing an existing medication, autocomplete is active on the Name
field. The existing saved values are shown as starting state. If the user changes the
Name, suggestions appear as in the add flow. Selecting a new catalog entry replaces
the Name, re-pre-fills Dose and Route from the new entry, and updates `catalog_rxcui`
to the new entry's rxcui. If the user edits text without selecting from autocomplete,
`catalog_rxcui` is left unchanged (the stored link may no longer match the displayed
fields — this is expected and acceptable; see [09-medicine-list.md § catalog_rxcui](09-medicine-list.md)).

**On save:** insert (or update) `medications` row. Fields stored as plain strings
exactly as they appear in the form at save time — no normalization, no catalog lookup.
`catalog_rxcui` is stored if a catalog entry was selected; NULL for free-text entries.
`is_active = 1`, `created_at` = now (on insert).
Dismiss sheet. Caller receives the saved medication.

**Validation:** Name is the only required field. Blank optional fields are saved as NULL.

---

## Log Medication sheet

Quick-log bottom sheet. Invoked from:
- Home "Log Medication" button
- Log tab → "Log Medication"
- Medications tab "Took it now" button (existing shortcut, unchanged)

**Layout:**
- Sheet handle at top
- Headline: "Log a medication"
- Medication picker: scrollable list of active medications (name + dose per row).
  Tap to select (single-select in V1).
- If no medications exist: "No medications added yet." with a "+" button →
  opens Add Medication sheet. On save, the new medication appears pre-selected.
- "Took it now" button (primary, logs `taken_at` = precise system timestamp)
- "Cancel" link or swipe down to dismiss

**On save:** insert into `medication_doses` (medication_id, taken_at = now, note = null).
Dismiss sheet. Update Home activity summary ("Last taken: [name], just now").

**Note:** This sheet is for quick current-time logging. Back-dated dose entry
is not available in V1 — deferred to V1.1.

---

## Home

**Header:** App name or logo (left), gear icon → Settings (right).

**Layout (top to bottom):**
1. Greeting — "Hello, [name]" (name omitted if not set: "Hello").
2. Two equal primary action buttons (side by side, full-width row):
   - **"Log Pain"** → launches Pain Check-In Wizard
   - **"Log Medication"** → opens Log Medication sheet
3. Recent activity summary (below the buttons):
   - Pain: "Last logged: 3 hours ago" or "No pain logs today"
   - Medication: "Last taken: Ibuprofen, 2 hours ago" or "No medications logged today"
4. 14-day sparkline — daily pain log count (or average score if entries exist).
   Gaps shown for days with no entries.
   Tap sparkline → History.

**States:**

| State | Buttons | Activity summary | Sparkline |
|---|---|---|---|
| First launch, no entries | Both buttons shown, equal weight | "No pain logs yet" / "No medications yet" | Empty (chart area visible, no line) |
| Has some entries | Both buttons shown, equal weight | Last log time per type | Shows history |

**Edge cases:**
- `patient_name` is null: greeting is "Hello" (no name).
- Sparkline with no data: show the chart area as empty (no line, no points), not hidden.
- If medication list is empty and user taps "Log Medication": open Add Medication sheet
  first, then log the dose on save.

---

## Pain Check-In Wizard

**Entry:** Modal sheet presented over the tab bar. Launched from:
- Home "Log Pain" button
- Log tab → "Log Pain"

**Dismissal:** "Cancel" button (top left). If any field has been filled in, show a
confirmation dialog: "Discard this pain log?" with "Discard" and "Keep Editing". If
nothing filled in, dismiss immediately.

**Progress indicator:** step dots or a segmented bar at the top (1 of 5 through 5 of 5).

**Previous selections:** On opening the wizard, load the most recent pain entry and
soft-pre-select its regions, qualities, and triggers. Pain score is never pre-selected
— the user must always make a conscious choice.

**Chip ordering:** All multi-select chip sets (regions, qualities, triggers) are
displayed in alphabetical order.

**Navigation:** "Back" (top left, after step 1) and "Next" / "Submit" (bottom right).
Back preserves filled values. Two steps have required selections before Next enables:
step 1 (pain score) and step 2 (at least one region). All other steps' Next is always
enabled.

---

### Step 1 — Pain score

**Headline:** "How is your pain right now?"

**Input:** Numeric 0–10 selector.
- Large centered number display showing the selected value
- "-" and "+" buttons, or a horizontal slider
- ⚠️ Validate both controls in prototype — slider may be imprecise for older users;
  stepper buttons may be faster and more accessible

**Default:** no selection (user must actively choose). "Next" disabled until a value
is selected.

**Labels:** 0 = "No pain", 10 = "Worst imaginable pain" shown as anchors.

---

### Step 2 — Pain location

**Headline:** "Where is your pain?"

**Input:** Multi-select grid or list of the 11 patient-facing regions (from `constants/regions.ts`).
- Each region is a tappable chip/button — tap to select (highlighted), tap again to deselect
- At least 1 selection required. "Next" disabled until at least one region is selected.
- ⚠️ Grid layout vs. vertical list: validate in prototype for tap target size and
  readability on small screens (iPhone SE / older Android)

**Regions (11):**
Head / face, Neck, Shoulder(s), Arm(s) / elbow(s) / wrist(s), Hand(s), Chest,
Upper back, Lower back, Abdomen, Hip(s) / pelvis, Leg(s) / knee(s) / feet

---

### Step 3 — Quality and triggers

**Headline:** "Describe your pain" (qualities section) and "Any triggers?" (triggers section)
— both on the same screen, scrollable.

**Pain quality input:** Multi-select chips, optional (10 options from `constants/qualities.ts`).

**Qualities (10):**
Aching, Burning, Stabbing, Throbbing, Shooting, Cramping, Pressure, Tingling / numbness,
Sharp, Dull

**Trigger input:** Multi-select chips, optional (12 options from `constants/triggers.ts`).

**Triggers (12):**
Poor sleep, Stress / anxiety, Physical activity, Weather, Sitting too long,
Standing too long, Cold temperature, Menstrual cycle, Eating, Alcohol,
Illness / infection, Unknown

**"Next" always enabled** — both sections are optional.

---

### Step 4 — Mood and sleep

**Headline:** "How are you feeling overall?"

**Mood input:** 1–5 emoji scale, optional.
- 5 large tappable emoji in a row: 😞 😕 😐 🙂 😊
- Selected state: highlighted / larger
- Label below selected: "Terrible" (1) through "Great" (5)

**Sleep quality input:** 1–5 emoji scale, optional.
- Separate row below mood: 😴💤 or a distinct set (⚠️ choose emoji set in prototype)
- Same interaction pattern as mood

**"Next" always enabled** — both are optional.

---

### Step 5 — Medications and note

**Headline:** "Medications and notes"

**Medications subsection:**
- Subheading: "Any medications worth noting?" (optional shortcut — the canonical
  dose record is the "Took it now" button in the Medications tab)
- If user has active medications: scrollable checklist (name + dose per row, checkbox).
  Tap to select / deselect.
- If user has no medications: empty state — "No medications added yet." with a
  "+" button to open the Add Medication sheet. On save, the new medication appears
  in the list and is pre-selected.
- ⚠️ Adding a medication mid-wizard via "+" sheet: validate this flow in prototype.
  Confirm that returning to the wizard step preserves all prior step data.

**Note subsection:**
- Subheading: "Note for your provider (optional)"
- Multi-line text input, placeholder: "Anything your provider should know..."
- No character limit in V1.

**Two exit actions on step 4:**
- **"Save Pain Log"** — primary action
- **"Save and Log Medication"** — secondary action, same row or below the primary button

**On "Save Pain Log":**
- Write entry to DB: `entry_date` = today (YYYY-MM-DD), `created_at` = precise system
  timestamp, `updated_at` = NULL. Include `note` if provided.
- Dismiss wizard.
- Show success toast: "Pain log saved."
- On DB write failure: show error toast "Couldn't save — please try again." Wizard stays
  open with all data intact. No partial save.

**On "Save and Log Medication":**
- Write the same entry to DB (identical to "Save Pain Log").
- On DB write failure: show error toast "Couldn't save — please try again." Do NOT
  open the medication wizard. Wizard stays open with all data intact.
- On success: dismiss pain wizard, immediately open the Log Medication sheet.
- The Log Medication sheet opens fresh (no pre-selection). User selects medications
  and logs doses independently.

---

## Timeline

Unified scrollable view of pain entries and medication dose events, newest first.
This is the primary surface for reviewing history. See
[decisions/008-unified-timeline.md](decisions/008-unified-timeline.md) for rationale.

**Header:** "Timeline" title. No "+" button — logging is initiated from Home.

**Date dividers:** Full-width horizontal rule with date centered in uppercase,
letter-spacing 1.2px. Format: `─────── APRIL 17 ───────`

**Two-column layout** below each divider:
- Left column: pain cards
- Right column: medication cards
- Vertical rule at 50% between columns (`divider` color, subtle)
- Days with only one type of event: opposite column is empty — no placeholder

**Pain card:**
- Right border in the pain ramp color for that entry's score
- Pain level badge, time (e.g. "9:14 AM"), top 2–3 regions (truncated with "..." if more)
- Mood glyph (if logged)
- Note excerpt (first line, if logged)
- Tap → Entry Detail (edit mode)

**Medication card:**
- Left border in `med` green
- Medication name, time
- Dose line: `{quantity}× {dose}` always (e.g. "2× 300mg", "1× 400mg"). Never computed
  as a total — the quantity and the per-unit dose are always shown separately so the
  provider reads exactly what was taken per pill, not an arithmetic result.
- Tap → Dose Edit screen

**Delete:**
- Swipe left on either card type → "Delete" action (red)
- Confirmation dialog: "Delete this entry? This cannot be undone."
- On confirm: delete from DB, remove card with animation.

**Empty state:** "No entries yet. Use the Log Pain or Log Medication buttons on the
Home screen to get started."

**Edge cases:**
- Multiple events on the same date: all appear under the same date divider, ordered
  chronologically within their column.
- Entry back-dated to a past date: appears under the correct past date divider,
  ordered by `created_at` within that day.
- Medication dose logged at the same time as a pain entry: each appears in its
  respective column under the same date divider — no merging.

---

## Entry Detail (Add / Edit)

Used for both viewing/editing existing entries and creating new entries from History.

**Header:**
- Add mode: "New Entry", "Cancel" (left), "Save" (right)
- Edit mode: "Edit Entry", "Cancel" (left), "Save" (right), "Delete" (destructive,
  bottom of screen or via trash icon)

**Date (always shown, always editable):**
- Date picker row: label "Date", taps to open `@react-native-community/datetimepicker`
  (mode="date"). Future dates disabled. Default: today (add mode) or entry's
  `entry_date` (edit mode). Time is always `created_at` (system timestamp at insert)
  and is not user-editable.

**Clinical fields (same layout as wizard, but scrollable on one screen):**
- Pain score (required)
- Pain regions (required, ≥1)
- Pain quality (optional, multi-select chips)
- Triggers (optional, multi-select chips)
- Mood (optional, emoji row)
- Sleep quality (optional, emoji row)
- Medications (optional, checklist — same empty state behavior as wizard step 5)
- Note (optional, multi-line text)

**Save behavior:**
- Add mode: insert new row. `created_at` = precise system timestamp now. `updated_at` = NULL.
- Edit mode: update existing row. `entry_date` reflects current date picker value.
  `created_at` unchanged. `updated_at` = precise system timestamp now.

**Delete (edit mode only):**
- "Delete Entry" button at bottom (red / destructive style)
- Confirmation dialog: "Delete this entry? This cannot be undone."
- On confirm: delete from DB, pop back to Timeline.

**Validation:** "Save" disabled until pain_level is set and at least one pain region
is selected.

---

## Medications

**Header:** "Medications", "+" button (top right) → Add Medication sheet.

**Layout:** Scrollable list of active medications as cards.

**Each card:**
- Medication name (prominent)
- Dose, route, frequency (secondary, inline: "400mg · oral · as needed")
- Today's dose count: "Taken today: 2 times" (computed from `medication_doses`
  where `taken_at` is today)
- Last dose time: "Last taken: 9:42 AM" (or "Not taken today")
- "Took it now" button — logs a dose with `taken_at` = precise system timestamp
- Reminder toggle — per-medication notification on/off ⚠️ (reminder time = ?)

**Tap card:** → Medication Detail screen (dose history, edit, archive).

**Archive (no delete):**
- Swipe left on card → "Archive" action
- Confirmation: "Archive [name]? You can restore it from archived medications."
- On confirm: set `is_active = 0`. Card disappears from main list.
- "Show archived" toggle or section at bottom of list to reveal archived medications.

**Empty state:** "No medications added. Tap + to add your first medication."

---

## Dose Edit

Opened by tapping a medication card in Timeline. Edits a single `medication_doses` row.

**Header:** "Edit Dose", "Cancel" (left), "Save" (right).

**Medication picker:**
Shows the union of:
- The medication referenced by this dose row (always shown, even if archived — so the
  user can see what was originally logged and adjust or remove it)
- All currently active medications (`is_active = 1`)

Steppers pre-populated: the medication matching `medication_id` starts at `quantity`;
all others start at 0. The user can shift quantity to a different medication (e.g. they
logged Ibuprofen but meant Naproxen) by zeroing one and incrementing another.

**Time field:**
Shows `taken_at` as an editable date + time. Uses `@react-native-community/datetimepicker`
(mode="datetime"). Future times disabled. Defaults to the stored `taken_at` value.

**Note field:** Pre-populated from stored `note`. Optional.

**On save:**
- If exactly one medication has count > 0: update the existing row (`medication_id`,
  `quantity`, `taken_at`, `note`, `updated_at` = now).
- If the user has zeroed all counts: treat as delete (same confirmation as delete button).
- If multiple medications have count > 0: this represents a correction where the user
  is splitting a session across medications. Update the original row to the first
  medication, insert new rows for the rest. Each new row gets the same `taken_at`.

**Delete button** (destructive, bottom of screen):
- Confirmation: "Delete this dose record? This cannot be undone."
- On confirm: delete the `medication_doses` row, pop back to Timeline.

**Save error:** Show error toast "Couldn't save — please try again." Screen stays open
with all data intact.

---

## Medication Detail

**Header:** Medication name, "Edit" button (top right) → inline edit of the card fields,
"Archive" button (destructive, bottom).

**Layout:**
- Medication info section: name, dose, route, frequency (editable via "Edit")
- Dose history section: scrollable log of all `medication_doses` rows for this
  medication, newest first. Each row: date, time.
- "Took it now" button (same as on the card, for convenience)

**Edit:** tapping "Edit" makes the info fields editable inline. "Save" / "Cancel" appear.
Saving updates the `medications` row (does not affect dose history).

---

## Report

**Header:** "Report"

**Date range tabs:** 7 days | 30 days | 90 days (segmented control, default: 30 days)

**Layout (scrollable, top to bottom):**

1. **Summary stats row:**
   - Average pain, Peak pain, Low pain
   - Average mood, Average sleep
   - Pain logs: total count in period (e.g., "38 logs over 30 days")

2. **Pain trend chart:** Line chart (daily average). X axis = dates. Y axis = 0–10.
   Gaps where no entries exist. Rendered as computed SVG via `react-native-gifted-charts`.

3. **Top triggers:** Horizontal bar chart. Top 5 triggers by frequency in the period.
   Shows count per trigger.

4. **Most affected regions:** Ranked list with frequency count or simple bar chart.

5. **Medications summary:** Table — medication name, total doses logged in period.

6. **Provider notes:** All non-null `note` values in the period, listed chronologically
   with date and time.

**Export PDF button** (sticky at bottom or prominent in header):
- Label: "Export PDF"
- Generates PDF via `lib/pdf.ts` (HTML + inline SVG, rendered by `expo-print`)
- Opens iOS/Android share sheet. User controls destination.
- PDF header: ThePainNP name/logo (placeholder for demo), patient name, date range,
  generated date.
- ⚠️ Validate PDF rendering on Android WebView — SVG fallback to tabular data if
  chart fails (per architecture spec).

**Empty state (no entries in range):** "No entries in this period. Start logging to
see your report."

---

## Settings

**Header:** "Settings", back button (if pushed from Home) or accessible via gear icon.

**Layout (grouped list):**

**Profile section:**
- Patient name: tappable row → inline text edit or push to name edit screen

**Reminders section:**
- Morning reminder: toggle + time (time row only visible when toggle is on).
  Label: "Morning reminder" — nudges user to log pain and/or medications.
- Evening reminder: toggle + time.
  Label: "Evening reminder" — nudges user to log pain and/or medications.

**Data section:**
- Export your data: "Export JSON" → generates JSON via `lib/export.ts`, opens share sheet
- Import from backup: "Import" → opens file picker (`expo-document-picker`), validates
  schema, shows preview ("N entries, date range"), confirms before inserting
- Delete all entries: destructive. Confirmation: "Delete all entries? Your medications
  will be preserved. This cannot be undone." Deletes `entries` and `medication_doses`
  rows. Does not delete `medications`.

**About section:**
- About + Contact: tappable row → About screen
- App version: non-interactive label (e.g., "Version 1.0.0")

**Import preview modal:**
Before inserting, show a preview:
- "N entries found (date range)"
- "M medications found"
- "K entries already exist and will be skipped" (duplicate detection by `created_at`)
- "Import" and "Cancel" buttons

---

## About + Contact

Accessible from Settings. Static content screen.

**Layout (scrollable):**

1. **About Lilypad:**
   - App name + brief description (what it does, who made it)
   - ThePainNP: name, credentials, practice focus (1–2 sentences)

2. **Privacy commitment:**
   "Your data never goes to any server — not ours, not iCloud, not Google. It lives
   only on this device. Unlike most health apps, Lilypad was designed so that even we
   cannot see what you log. The only way your data leaves this device is if you choose
   to export it yourself."

3. **Social media links:**
   - Icons + labels for each platform (Instagram, TikTok, YouTube, etc.)
   - Each opens in the device's default browser / platform app
   - Actual URLs: TBD (provided by ThePainNP)

4. **Legal notice:**
   "Lilypad is not a medical device. It is a personal logging tool. Nothing in this
   app constitutes medical advice, diagnosis, or treatment. Always consult your
   healthcare provider."

5. **App version:** "Version 1.0.0"
