# 002 — Event-driven logging: replacing the BID data model

**Status:** Decided
**Date:** 2026-04-16

## Context

Decision 001 established a fixed BID (morning/evening) check-in cadence, decoupling it
from medication intake. The notification rationale was sound: BID as a default notification
schedule coincides with the most common chronic pain medication schedule and is clinically
justified by diurnal pain variation.

However, the decision caused the BID concept to leak into the data model: `check_in_period`
became a required field on every entry, forcing every pain log to be classified as
"morning" or "evening." This creates a structural mismatch:

- Chronic pain patients cannot reliably distinguish "morning state" from "evening state" —
  pain is continuous and does not bucket cleanly by time of day
- A patient who logs at 2pm and one who logs at 6pm are not recording meaningfully different
  clinical moments just because one falls before noon and one after
- The morning/evening distinction is useful for notification scheduling and habit formation,
  not for the clinical data itself
- Making `check_in_period` a required schema field couples the data model to the notification
  model unnecessarily

Additionally, medication tracking and pain tracking were treated as ancillary to each other
when both are primary data streams of equal clinical importance.

## Options considered

### Option A — Keep BID as both notification schedule and data model (original)

Maintain `check_in_period` in the schema. Users log at morning and evening windows.
The notification model and data model are aligned.

**Problems:**
- Forces an artificial classification onto pain data that may not reflect real experience
- Makes the app feel like it's about the clock, not about the user's body
- Pain logged outside normal windows (e.g., 1am after a bad flare) is classified
  as morning or evening arbitrarily
- Medication logging remains secondary to the check-in flow

### Option B — Event-driven logging with BID as notification defaults only (chosen)

Remove `check_in_period` from the data model entirely. A pain log is a timestamped
event recorded when the user chooses to record it, for any reason. Notification
reminders remain BID by default (a useful habit scaffold), but do not define
the entry structure.

Pain logging and medication logging are promoted to equal prominence, both accessible
from the Home screen.

### Option C — Fully configurable cadence, no defaults

Remove all structured cadence. User defines their own reminder schedule.

**Problems:**
- Adds configuration complexity to onboarding with no demonstrated benefit
- Still doesn't address the data model problem
- BID defaults are clinically appropriate; the issue was structural, not about the defaults

## Decision

**Event-driven logging. BID survives as notification defaults only, not as a data
model constraint.**

Every pain log is a timestamped event. The `check_in_period` column is dropped from
`entries`. The `entry_date` field (YYYY-MM-DD) is retained for daily aggregation in
reports and the sparkline, derived from `created_at` unless the user back-dates an
entry.

Medication logging is promoted to equal prominence with pain logging. The Home screen
surfaces both actions with equal visual weight. The clinical value of the combined
data (pain readings correlated with medication events via timestamps) is preserved —
and improved: precise timestamps enable time-series correlation rather than
per-period correlation.

## Consequences

- `check_in_period` is dropped from the `entries` table. All references to
  morning/evening as a data field are removed from schemas, queries, and UI.
- `entry_date` (YYYY-MM-DD) is retained for daily aggregation. It defaults to
  today and can be overridden for back-dated entries.
- `sleep_quality` remains in the schema as an optional field. Without a morning
  anchor it is slightly decontextualized, but it is clinically useful whenever
  the user provides it.
- The Home screen redesigns around two equal CTAs: "Log Pain" and "Log Medication."
- The History tab shows pain log events only. Medication dose history lives in the
  Medications tab. A unified timeline mixing both event types is deferred to V1.1.
- The Report metric "check-ins completed (N of M possible)" is replaced with
  "Pain logs: N over this period" since there is no fixed expected count.
- Retroactive missed-medication reminders ("you forgot to log your 8pm dose")
  require a user-defined medication schedule and are deferred to V1.1.
- BID notifications remain as defaults in onboarding and Settings, framed as
  "gentle reminders to check in" — habit scaffolds, not structural requirements.
- Decision 001's core argument — pain diary and medication tracker are conceptually
  separate, not conflated — remains correct. The two flows stay independent.
  Only the data model implication of 001 is superseded.
