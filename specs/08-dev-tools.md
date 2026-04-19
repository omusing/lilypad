# Developer Tools

A hidden section of the app for development and QA use only. Visible exclusively
when `__DEV__` is true (Expo development builds). Never shown in production.

Accessible via a "Developer tools" row at the bottom of the Settings screen.
Navigates to a dedicated `app/dev-tools.tsx` screen.

---

## Actions

### Reset all data
Clears all user-generated data and returns the app to its initial state.

- Deletes all rows from `entries`, `medication_doses`, `medications`
- Resets `app_settings`: `patient_name = NULL`, `onboarding_done = 0`,
  `morning_reminder = 0`, `evening_reminder = 0`
- Navigates to `/onboarding`
- Confirmation required before executing

### Back to intro
Navigates to `/onboarding` without touching the database.
Useful for re-testing the onboarding flow while keeping real records.
No confirmation needed.

---

## Seed Personas

Each persona button clears all existing data first, then seeds the DB with a
deterministic dataset. Timestamps are calculated relative to the current date
at seed time so the data always looks recent. No entries for today — all events
end yesterday or earlier.

All personas include named patient in `app_settings.patient_name`.

---

### Client A
**Profile:** Head pain, consistent, 30 days, Ibuprofen only.

- `patient_name`: "Alex"
- **Medications:** Ibuprofen 200mg, oral
- **Pain entries:** 20 entries, pain 3–6, region: head
  - Spread across the past 30 days using fixed offsets (not evenly spaced)
  - Times: mid-morning to evening (09:00–20:00)
- **Dose logs:** 20 doses of Ibuprofen, each within 10–30 minutes after the
  corresponding pain entry

---

### Jerry
**Profile:** Mild chronic pain, daily logger, consistent.

- `patient_name`: "Jerry"
- **Medications:** Naproxen 220mg, oral
- **Pain entries:** 30 entries (one per day for the past 30 days), pain 0–3,
  regions: legs or knees/feet (alternates), morning times (07:30–09:00)
- **Dose logs:** 30 doses of Naproxen, same day as each pain entry, within
  30–60 minutes of the pain entry

---

### Micky
**Profile:** High-variance abdominal pain, irregular logger, multi-medication.

- `patient_name`: "Micky"
- **Medications:** 5 drugs — Tramadol 50mg oral, Gabapentin 300mg oral,
  Ibuprofen 400mg oral, Diclofenac 25mg topical, Cyclobenzaprine 5mg oral
- **Pain entries:** 13 entries over 30 days, unevenly spaced (every 2–3 days),
  pain levels: [5,7,3,0,6,4,7,3,5,6,0,4,7], region: abdomen
  - Includes 0s (logs when he remembers, not only when it's bad)
- **Dose logs:** ~7 doses, distributed across about half the pain entries,
  picking medications via fixed assignment from the 5 above. A few dose logs on
  days with no pain entry.

---

### Donny
**Profile:** Medication-first, minimal pain logger.

- `patient_name`: "Donny"
- **Medications:** 3 drugs — Methotrexate 2.5mg oral (AM),
  Folic Acid 1mg oral (AM), Hydroxychloroquine 200mg oral (PM)
- **Pain entries:** 5 entries, pain 2–4, region: head,
  scattered across the 30-day window (not correlated with dose days)
- **Dose logs:**
  - Methotrexate: ~27 doses over 30 days (near-daily AM, 07:00–08:30)
  - Folic Acid: same days and times as Methotrexate (taken together)
  - Hydroxychloroquine: ~20 doses over 30 days (PM, 18:00–20:00, every 1–2 days)

---

## Implementation notes

- All seed functions live in `db/seed.ts`
- Timestamps are computed as `new Date(now - offsetDays * 86400000)` with a fixed
  hour/minute per entry — fully deterministic, no `Math.random()`
- Each seed function calls `resetDatabase()` first, then inserts via the existing
  `insertMedication`, `insertEntry`, `logDoseNow` DB functions
- `resetDatabase()` is the only function that executes raw multi-table DELETEs
- Dev tools screen is `app/dev-tools.tsx`, registered in `app/_layout.tsx`
  as `presentation: 'card'`
- The Settings row linking to it is wrapped in `{ __DEV__ && ... }`
