# 008 — Unified timeline: promoting the combined pain + medication view to V1

**Status:** Decided
**Date:** 2026-04-19

## Context

The original spec separated pain history (History tab, scrollable list newest-first)
from medication dose history (Medications tab, per-medication dose log in Medication
Detail). A "Unified timeline" mixing both event types was listed as a V1.1 deferred
feature.

During the graphic standards exploration, the deferred timeline was mocked against
the separate-views layout, and the clinical argument for promoting it to V1 was clear
enough to make the call.

## Options considered

### Option A — Separate views (original spec)
Pain entries in History tab. Medication dose history accessible only through
Medications tab → individual Medication Detail screen.

**Tradeoffs:**
- A user cannot see "I took Ibuprofen at 9am and still hit a 7 at noon" without
  navigating between two tabs and mentally correlating times.
- This is precisely the correlation a provider needs in a 10-minute appointment.
  Separating the views makes the most clinically important relationship invisible.
- The core app value proposition is the *relationship* between pain events and
  medication events. Hiding that relationship behind separate views undermines it.

### Option B — Unified timeline, V1 (selected)

Single scrollable view. Date divider rules (`─────── APRIL 17 ───────`) group
events by day. Two columns below each divider: pain cards on the left, medication
cards on the right.

**Layout detail:**
- Pain cards: right border in the pain ramp color for that entry's score. Badge,
  time, regions, optional note excerpt.
- Medication cards: left border in `med` green. Name, dose, time, count.
- Vertical rule at 50% between columns (subtle, `divider` color).
- Days with only one type of event leave the opposite column empty — no placeholder.
- Date dividers replace a dedicated "date header row" — same information, less
  vertical space consumed.

**Why dividers instead of a center date-chip column (original V1.1 reference):**
The three-column layout (pain | date chip | med) consumed too much horizontal
space on the smallest supported devices (iPhone SE). The divider pattern gives
full column width to the event cards while preserving the same day-grouping
function.

**Tab bar impact:**
- "History" tab renamed to "Timeline"
- The 5-tab layout (Home / History / Log+ / Medications / Report) reduces to
  4 tabs (Home / Timeline / Medications / Report)
- The center "Log +" tab is removed — the two primary CTAs on Home serve as the
  canonical logging entry points (see consequences)

### Option C — Two-column layout within the existing History tab
Keep the History tab, replace the pain-only list with the two-column view.

**Tradeoff:** Functionally identical to Option B but preserves the "History" label,
which implies a pain-only record. "Timeline" communicates the dual-stream nature
of the view to new users more accurately.

**Decision: Option B.** Unified timeline in V1 as a renamed Timeline tab.

## Consequences

- `History` tab renamed `Timeline` in tab bar, navigation structure, and all
  internal references.
- The `History` screen spec in `06-screens.md` should be updated to describe the
  unified two-column layout.
- Medication dose events are no longer accessible only through Medications tab →
  Medication Detail. They surface directly in Timeline. The per-medication dose log
  in Medication Detail becomes V1.1 deferred (or a drill-down from Timeline).
- The center "Log +" tab is removed from the tab bar. This resolves the "+" icon
  collision noted in feedback.md (the tab bar "+" and the Medications "Add
  medication" button were visually indistinct). Tab bar now has 4 equal tabs.
- The Medications tab becomes management-only: adding, editing, archiving
  medications. The "Took it now" quick-log button is removed from the Medications
  screen. Intake is logged exclusively via the Log Medication wizard (from Home or
  from the pain wizard's "Save and Log Medication" exit). This clarifies the
  information architecture: Medications = list management; Timeline = dose history.
- The unified timeline is the surface that makes the app's core value proposition
  visible: the relationship between pain events and medication events, side by side,
  in time.
