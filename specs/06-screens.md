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
  Add Medication sheet   ← launched from Onboarding / Medications "Add Medication" button

Full-screen stack (pushed from tab):
  Entry Detail           ← from Timeline pain card
  Dose Edit              ← from Timeline medication card
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
- Empty state with "Add Medication" button
- As medications are added, they appear as a compact list (name + dose)
- Each list item has a delete icon
- "Skip" link (top right)
- "Done" button

**Adding a medication:** tapping "Add Medication" opens the Add Medication sheet.
On save, the new medication appears in the list immediately.

**On "Done":** navigate to Home tab.

---

## Add Medication sheet

Reusable bottom sheet. Invoked from:
- Onboarding step 4
- Medications tab "Add Medication" button

**Layout:**
- Sheet handle at top
- Headline: "Add Medication"
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
- Name field fills with the selected brand name (e.g. "Advil").
- Dose field pre-fills with the first available strength. Strength chips appear below
  the Dose field: one chip per available strength. The chip matching the pre-filled
  dose is visually active. Tapping any chip overrides the Dose field.
- Route field pre-fills with the first available route (e.g. "oral").
- If the catalog entry has more than one route, route chips appear below the Route field.
- Frequency field remains empty.

**Clearing a catalog selection:** If the user manually types in the Name field after
selecting a catalog entry, the selection is cleared — strength chips and route chips
disappear. The user can override any pre-filled field at any time. Medications not in
the catalog can be entered entirely by free text.

**Edit flow:** When editing an existing medication, autocomplete is active on the Name
field. Selecting a new catalog entry replaces the Name and re-pre-fills Dose and Route.

**On save:** insert (or update) `medications` row. `catalog_rxcui` stored if a catalog
entry was selected; NULL for free-text entries. `is_active = 1`, `created_at` = now.
Dismiss sheet. Caller receives the saved medication.

**Validation:** Name is the only required field. Blank optional fields saved as NULL.

---

## Log Medication sheet

Multi-dose bottom sheet. Invoked from:
- Home "Log Medication" button
- "Save and Log Medication" exit from the pain wizard (step 4)

**Layout:**
- Sheet handle at top
- Headline: "What Did You Take?"
- Entire sheet background: `medLight` (#E6F3ED) — medication color identity
- Medication list: scrollable list of active medications (name + dose per row)
  - Tap a row to select; selected rows show a stepper (− / +) for quantity
  - Each stepper unit = 1 pill/dose of that medication
- If no medications exist: "No medications added yet." with "Add Medication" button →
  opens Add Medication sheet. On save, new medication appears pre-selected.
- Optional note field (shared across all medications in this session)
- "Log Doses" button (primary, `med` background, disabled until at least one
  medication has quantity ≥ 1)
- "Cancel" link or swipe down to dismiss

**On save:** insert one `medication_doses` row per selected medication, each with
its recorded `quantity` and the same `taken_at` = precise system timestamp.
Dismiss sheet. Show toast: "Doses logged."

See [decisions/009-dose-quantity-and-editability.md](decisions/009-dose-quantity-and-editability.md)
for schema rationale.

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
   Tap sparkline → Timeline.

**States:**

| State | Buttons | Activity summary | Sparkline |
|---|---|---|---|
| First launch, no entries | Both buttons shown, equal weight | "No pain logs yet" / "No medications yet" | Empty (chart area visible, no line) |
| Has some entries | Both buttons shown, equal weight | Last log time per type | Shows history |

**Edge cases:**
- `patient_name` is null: greeting is "Hello" (no name).
- Sparkline with no data: show the chart area as empty (no line, no points), not hidden.
- If medication list is empty and user taps "Log Medication": open Add Medication sheet
  first, then proceed to Log Medication on save.

---

## Pain Check-In Wizard

**Entry:** Modal sheet presented over the tab bar. Launched from Home "Log Pain" button.

**Dismissal:** "Cancel" button (top left). If any field has been filled in, show a
confirmation dialog: "Discard this pain log?" with "Discard" and "Keep Editing". If
nothing filled in, dismiss immediately.

**Visual identity:** Entire wizard background is `painLight` (#F6EAE8). Progress bar
fill and primary action button use `pain` (#A84A42). Applies to all 4 steps.

**Progress indicator:** segmented bar at top — 1 of 4 through 4 of 4.

**Previous selections:** On opening the wizard, load the most recent pain entry and
soft-pre-select its regions, qualities, and triggers. Pain score is never pre-selected
— the user must always make a conscious choice.

**Chip ordering:** All multi-select chip sets (regions, qualities, triggers) are
displayed in alphabetical order.

**Navigation:** "Back" (top left, after step 1) and "Next" (bottom right).
Back preserves filled values. Two steps have required selections before Next enables:
step 1 (pain score) and step 2 (at least one region). All other steps' Next is always
enabled.

---

### Step 1 — Pain score

**Headline:** "How is your pain right now?"

**Input:** Numeric 0–10 selector — vertical list of 11 rows.
- Each row: colored badge (34×34px, pain ramp color per token table) with numeral +
  description label (e.g. "Moderate")
- Row height: 48px full-width tap target
- Selected: row background tinted `painLight`, label bold, checkmark right
- ⚠️ Validate vertical list vs. stepper buttons vs. slider in prototype — vertical
  list is the default; stepper may be faster for older users

**Default:** no selection. "Next" disabled until a value is selected.
Do not show "0 = no pain / 10 = worst imaginable" header — each row already labels 0 and 10.

---

### Step 2 — Pain location

**Headline:** "Where is your pain?"

**Input:** Body map — front and back anatomical silhouette images with SVG hit-target
overlays. See [body-map-coordinates.md](body-map-coordinates.md) for image files,
pixel coordinates, and implementation notes.

- Display `body-anatomy-front.png` and `body-anatomy-back.png` (from `specs/assets/`)
  side by side at equal width inside a card
- SVG overlay (`viewBox="0 0 381 917"`) absolutely positioned over each image
- Ghost rings (dashed, low-opacity `pain` color) always visible on all zones —
  communicates tappability
- Tap a zone: fill appears at `rgba(168, 74, 66, 0.38)` + `rgba(168, 74, 66, 0.85)` stroke
- Selected zone names echoed as chips below the map (alphabetical)
- At least 1 selection required. "Next" disabled until at least one zone is selected.
- ⚠️ Validate side-by-side on iPhone SE — stacked front/back with toggle is the
  fallback if tap targets are too small at that display size

**Regions (12):**
Head / Face, Neck, Shoulders, Arms / Elbows / Wrists, Hands, Chest (front),
Upper Back (back), Lower Back (back), Abdomen (front), Hips / Pelvis,
Legs / Knees, Feet

---

### Step 3 — Quality and triggers

**Headline:** "Describe your pain" (qualities section) and "Any triggers?" (triggers section)
— both on the same screen, scrollable.

**Pain quality input:** Multi-select chips, optional.

**Qualities (10) — alphabetical:**
Aching, Burning, Cramping, Dull, Pressure, Sharp, Shooting, Stabbing,
Throbbing, Tingling / Numbness

**Trigger input:** Multi-select chips, optional.

**Triggers (12) — alphabetical:**
Alcohol, Cold Temperature, Eating, Illness / Infection, Menstrual Cycle,
Physical Activity, Poor Sleep, Sitting Too Long, Standing Too Long,
Stress / Anxiety, Unknown, Weather

**"Next" always enabled** — both sections are optional.

---

### Step 4 — Mood, sleep, and note

**Headline:** "How are you feeling overall?"

**Mood input:** 1–5 scale, optional.
- 5 badges in a horizontal row (50×50px each)
- Each badge: 10px border-radius rounded square, color from mood ramp (red → green),
  custom smiley-face glyph (see `04-design-system.md` — Glyph system)
- Brows angle down for levels 1–2, neutral for 3, lifted for 4–5
- Mouth curves from deep frown (1) → flat (3) → broad smile (5)
- Selected: 3px ring in `medRing`
- Label below each badge: "Terrible" (1) through "Great" (5)

**Sleep quality input:** 1–5 scale, optional.
- Same badge row layout directly below mood
- Color from sleep ramp (red → green)
- Same face family: closed eyes for levels 3–5, open distressed eyes for 1–2
- Small "z" in top-right corner distinguishes sleep glyphs from mood glyphs
- Label below each badge: "Terrible" (1) through "Rested" (5)

**Provider note input:** optional.
- Multi-line text input, placeholder: "Anything your provider should know…"
- No character limit in V1.

**Two exit actions:**
- **"Save Pain Log"** — primary button (`pain` background, full width, 54px)
- **"Save and Log Medication"** — secondary button (`med` border only, full width, 46px)

**On "Save Pain Log":**
- Write entry to DB: `entry_date` = today (YYYY-MM-DD), `created_at` = precise system
  timestamp, `updated_at` = NULL. Include `note` if provided.
- Dismiss wizard. Show success toast: "Pain log saved."
- On DB write failure: show error toast "Couldn't save — please try again." Wizard
  stays open with all data intact. No partial save.

**On "Save and Log Medication":**
- Write the same pain entry to DB identically.
- On failure: show error toast. Do NOT open the medication sheet.
- On success: dismiss wizard, immediately open Log Medication sheet (fresh, no
  pre-selection). User selects medications and logs doses independently.

---

## Timeline

Unified scrollable view of pain entries and medication dose events, newest first.
See [decisions/008-unified-timeline.md](decisions/008-unified-timeline.md) for rationale.

**Header:** "Timeline" title. No "+" button — logging is initiated from Home.

**Date dividers:** Full-width horizontal rule with date centered in uppercase,
letter-spacing 1.2px. Format: `─────── APRIL 17 ───────`

**Two-column layout** below each divider:
- Left column: pain cards
- Right column: medication cards
- Vertical rule at 50% between columns (`divider` color, subtle)
- Days with only one type of event: opposite column is empty — no placeholder

**Pain card (left):**
- Right border in the pain ramp color for that entry's score
- Pain level badge (34×34, ramp color) + time (e.g. "9:14 AM")
- Top 2–3 regions (truncated with "…" if more)
- Mood glyph badge (if logged)
- Note excerpt (first line, if logged)
- Tap → Entry Detail (edit mode)

**Medication card (right):**
- Left border in `med` green
- Medication name, time
- Dose line: `{quantity}× {dose}` always (e.g. "2× 300mg", "1× 400mg"). Never computed
  as a total — quantity and per-unit dose always shown separately so the provider
  reads exactly what was taken per pill.
- Tap → Dose Edit screen

**Delete:**
- Swipe left on either card → "Delete" action (red)
- Confirmation: "Delete this entry? This cannot be undone."
- On confirm: delete from DB, remove card with animation.

**Empty state:** "No entries yet. Use Log Pain or Log Medication on the Home screen
to get started."

**Edge cases:**
- Multiple events same date: appear under the same divider, ordered chronologically
  within their column.
- Back-dated entry: appears under its correct past date divider.
- Simultaneous pain + medication events: each in its respective column, same divider.

---

## Entry Detail (Add / Edit)

Used for both viewing/editing existing entries and creating new entries from Timeline.

**Header:**
- Add mode: "New Entry", "Cancel" (left), "Save" (right)
- Edit mode: "Edit Entry", "Cancel" (left), "Save" (right), trash icon (destructive)

**Date (always shown, always editable):**
- Date picker row: taps to open `@react-native-community/datetimepicker` (mode="date").
  Future dates disabled. Default: today (add) or entry's `entry_date` (edit).
  Time = `created_at` — not user-editable.

**Clinical fields (scrollable single screen):**
- Pain score (required) — same 11-row badge list as wizard step 1
- Pain regions — body map (same component as wizard step 2)
- Pain quality (optional, multi-select chips, alphabetical)
- Triggers (optional, multi-select chips, alphabetical)
- Mood (optional, 1–5 glyph badge row — same component as wizard step 4)
- Sleep quality (optional, 1–5 glyph badge row — same component as wizard step 4)
- Note (optional, multi-line text)

**Save behavior:**
- Add: `created_at` = system timestamp. `updated_at` = NULL.
- Edit: `created_at` unchanged. `updated_at` = system timestamp.

**Delete (edit mode only):**
- Confirmation: "Delete this entry? This cannot be undone."
- On confirm: delete from DB, pop back to Timeline.

**Validation:** Save disabled until pain score set and at least one region selected.

---

## Dose Edit

Opened by tapping a medication card in Timeline. Edits a single `medication_doses` row.
See [decisions/009-dose-quantity-and-editability.md](decisions/009-dose-quantity-and-editability.md).

**Header:** "Edit Dose", "Cancel" (left), "Save" (right).
Entire background: `medLight` (#E6F3ED) — medication color identity.

**Medication picker:**
Shows the union of:
- The medication referenced by this dose row (always shown, even if archived)
- All currently active medications (`is_active = 1`)

Steppers pre-populated: the medication matching `medication_id` starts at `quantity`;
all others start at 0. The user can shift quantity to a different medication by zeroing
one and incrementing another.

**Time field:**
Shows `taken_at` as an editable date + time. Uses `@react-native-community/datetimepicker`
(mode="datetime"). Future times disabled. Defaults to the stored `taken_at` value.

**Note field:** Pre-populated from stored `note`. Optional.

**On save:**
- If exactly one medication has count > 0: update the existing row.
- If all counts are zeroed: treat as delete (same confirmation as delete button).
- If multiple medications have count > 0: update the original row to the first medication,
  insert new rows for the rest. Each new row gets the same `taken_at`.

**Delete button** (destructive, bottom):
- Confirmation: "Delete this dose record? This cannot be undone."
- On confirm: delete the `medication_doses` row, pop back to Timeline.

**Save error:** Show toast "Couldn't save — please try again." Screen stays open.

---

## Medications

**Header:** "Medications". "Add Medication" labelled button (top right — not a "+" icon).

Management screen only. Dose intake is handled exclusively through the Log Medication
sheet from Home — not from this screen.

**Layout:** Scrollable list of active medications as cards.

**Each card:**
- Medication name (prominent)
- Dose, route, frequency: "400mg · oral · as needed"
- Today's dose count: "Taken today: 2 times" (SUM of quantity where `taken_at` is today)
- Last dose time: "Last taken: 9:42 AM" or "Not taken today"
- Edit icon button → inline edit of name/dose/route/frequency
- Archive icon button → confirmation → `is_active = 0`

**No "Took it now" button.** The Medications screen is for list management only.
Logging intake is done via the Log Medication sheet (Home CTA or pain wizard exit).

**Tap card:** → Medication Detail screen.

**Archive:**
- Confirmation: "Archive [name]? You can restore it from archived medications."
- On confirm: `is_active = 0`. Card disappears from main list.
- "Show archived" toggle at bottom to reveal archived medications.

**Empty state:** "No medications added. Tap Add Medication to get started."

---

## Medication Detail

**Header:** Medication name, "Edit" button (top right), "Archive" button (destructive, bottom).

**Layout:**
- Medication info: name, dose, route, frequency (editable via "Edit")
- Dose history: scrollable log of all `medication_doses` rows for this medication,
  newest first. Each row: date, time, quantity.

**Edit:** inline field editing. "Save" / "Cancel" appear. Does not affect dose history.

---

## Report

**Header:** "Report"

**Date range tabs:** 7 days | 30 days | 90 days (segmented control, default: 30 days)

**Layout (scrollable, top to bottom):**

1. **Summary stats row:**
   - Average pain, Peak pain, Low pain
   - Average mood, Average sleep
   - Pain logs: total count in period

2. **Pain trend chart:** Line chart (daily average). X axis = dates. Y axis = 0–10.
   Gaps where no entries exist.

3. **Top triggers:** Horizontal bar chart. Top 5 triggers by frequency.

4. **Most affected regions:** Ranked list with frequency count.

5. **Medications summary:** Table — medication name, SUM(quantity) of doses in period.

6. **Provider notes:** All non-null notes, chronological with date and time.

**Export PDF button** (sticky bottom or prominent in header):
- Label: "Export PDF Report"
- Generates via `lib/pdf.ts`, opens share sheet
- PDF header uses Lora for display text
- SVG chart fallback: tabular data if chart fails on Android WebView

**Empty state:** "No entries in this period. Start logging to see your report."

---

## Settings

**Header:** "Settings"

**Profile section:**
- Patient name: tappable → inline edit

**Reminders section:**
- Morning reminder: toggle + tappable time pill (`med` bg when active, `border` bg
  when toggle is off). Tap pill → opens time picker inline.
- Evening reminder: same pattern.

**Data section:**
- Export your data: "Export JSON" → share sheet
- Import from backup: file picker → schema validation → preview → confirm
- Delete all entries: destructive. Confirmation: "Delete all entries? Your medications
  will be preserved. This cannot be undone."

**About section:**
- About + Contact → About screen
- App version (non-interactive)

**Import preview modal:**
- "N entries found (date range)"
- "M medications found"
- "K entries already exist and will be skipped"
- "Import" and "Cancel"

**Developer tools** (development builds only):
- Reset all data, Back to intro, Load persona: Jerry / Micky / Donny / Client A

See [08-dev-tools.md](08-dev-tools.md) for persona definitions.

---

## About + Contact

Accessible from Settings. Static content screen.

**Layout (scrollable):**

1. **About Lilypad:** app name, brief description, ThePainNP credentials (1–2 sentences)

2. **Privacy commitment:**
   "Your data never goes to any server — not ours, not iCloud, not Google. It lives
   only on this device. The only way your data leaves this device is if you choose to
   export it yourself."

3. **Social media links:** icons + labels, open in browser/platform app. URLs: TBD.

4. **Legal notice:**
   "Lilypad is not a medical device. It is a personal logging tool. Nothing in this
   app constitutes medical advice, diagnosis, or treatment. Always consult your
   healthcare provider."

5. **App version:** "Version 1.0.0"
