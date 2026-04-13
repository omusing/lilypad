# 001 — Check-in cadence: pain diary vs. medication tracker

**Status:** Decided
**Date:** 2026-04-13

## Context

The original framing described Lilypad's twice-daily check-in as "aligned with
typical medication administration cadence." This implied that check-ins are
triggered by medication intake — that the user takes their medication and
simultaneously logs pain state. The question arose: is BID the correct
assumption for the target population, and should the cadence be configurable?

The target user is a person aged 40–70+ with chronic pain, managed by a licensed
nurse practitioner (ThePainNP). Common medications in this population:

| Drug class | Typical dosing |
|---|---|
| Long-acting opioids (ER formulations) | BID (q12h) |
| Pregabalin (Lyrica) | BID |
| Duloxetine (Cymbalta) | QD |
| Gabapentin | TID (but often simplified to BID in geriatric patients to reduce falls) |
| NSAIDs (ibuprofen, naproxen) | BID–TID |
| Topical analgesics | BID–TID |

BID is the plurality, not the universal. Medication adherence research confirms
this is also the ceiling that most patients can sustain: compliance rates drop
from 81% (BID) to 77% (TID) to 39% (QID). Providers in geriatric and chronic
pain care routinely simplify TID regimens to BID to improve adherence.

Additionally, a pain diary and a medication tracker are conceptually distinct:
- Pain state reflects the patient's subjective experience at a moment in time.
- Medication dose is an event (what, how much, when taken precisely).
Conflating these into a single triggered workflow creates incorrect assumptions
for patients on QD, PRN, or TID schedules.

## Options considered

### Option A — Medication-triggered check-ins (original framing)
Check-ins happen at medication administration time. The wizard is opened after
taking meds. The UX framing is: "you just took your meds, now log how you feel."

**Problems:**
- Breaks for patients on QD or PRN meds who don't have a morning+evening dose
- Breaks for patients on TID who would need a noon check-in not currently supported
- Implies pain state is caused by or measured relative to medication, which is
  not clinically accurate
- Makes it awkward to log pain on a day when the patient skips or delays a dose

### Option B — Configurable check-in frequency (morning / noon / evening / custom)
Let the user select their check-in cadence during onboarding: 2x (morning+evening),
3x (morning+noon+evening), or custom times. Medication logging remains separate.

**Problems:**
- Adds material complexity to onboarding (more decisions before first use)
- Three-slot cadence changes the data model: sparkline aggregation, report grouping,
  and history badges all need to handle a variable number of slots per day
- Defers the question of what the "right" clinical cadence is rather than
  making a defensible recommendation
- No evidence from the target demographic that TID is common enough to warrant
  this in V1

### Option C — Fixed BID (morning + evening), decoupled from medication (chosen)
Check-ins happen twice daily anchored to time of day, not medication events.
Morning captures overnight and wake-up state. Evening captures end-of-day state.
Medication doses are logged independently via a "Took it now" button in the
Medications tab at the moment of administration.

The wizard includes "which medications did you take this period?" as a shortcut
catch-up mechanism only — not the canonical dose log.

## Decision

**Fixed BID cadence, decoupled from medication intake.**

The morning and evening windows are clinically justified independently of
medication timing: they capture the natural diurnal variation in pain that
providers ask about. The cadence coincides with BID (the dominant schedule in
the target population) without being caused by it. Patients on non-BID schedules
still benefit from the same two anchors.

Configurable cadence is deferred to V1.1. If demo feedback reveals a significant
TID cohort (likely gabapentin patients), adding a "Noon" check-in is a bounded
change: add `noon` as a valid `check_in_period` value, a third history badge,
and a third notification slot. The data model accommodates this without migration.

## Consequences

- Medication logging must stand on its own in the Medications tab. The "Took it now"
  button is the primary dose record. Its UX must be prominent enough to be used
  habitually without relying on the check-in wizard as a backstop.
- The check-in wizard copy for the medications step must not imply "log your dose
  here." Correct framing: "Which medications have you taken since your last
  check-in?" Incorrect framing: "Log your medications."
- Patients on TID schedules (gabapentin in particular) may feel the app doesn't
  fully reflect their routine. Watch for this in demo feedback.
- If V1.1 adds a noon check-in, the history sparkline and report aggregation will
  need to handle days with 3 entries, not 2.
