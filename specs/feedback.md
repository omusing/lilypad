# Product Feedback

Ongoing notes and observations. Each entry has a date, the screen or area it affects, and the feedback. Status tracks whether it has been applied, deferred, or is pending.

---

## Open

Items still pending implementation in code.

| Date       | Area              | Feedback                                                                                                                          | Status  |
|------------|-------------------|-----------------------------------------------------------------------------------------------------------------------------------|---------|
| 2026-04-24 | Global — Font sizes | Body text is too small across the app. See `specs/references/text_to_small (1).png` (Timeline) and `(2).png` (Medications). Medication names, dose/route lines, and status text ("1 dose today", "Last: Apr 14") are all undersized. The type scale should be increased to align with iOS/Android default readability expectations — primary labels closer to 17px, secondary/meta text no smaller than 14px. Plenty of whitespace available to absorb the increase without crowding. | Pending |
| 2026-04-17 | History / Entry Detail | No way to edit an existing entry. The Entry Detail screen currently shows fields read-only with only a delete option. Spec says editable — this is an implementation gap. | Pending |
| 2026-04-17 | Medications — Toast | The success toast appears at the bottom of the screen, overlapping the green "+" add button. Both share the same green background color (`Colors.med`). Toast needs a distinct position, style, or color to stand apart from the button. | Pending |
| 2026-04-17 | Log Pain — Mood/sleep emoji style | The current Unicode emoji icons feel generic and clash with the app's calm tone. Replace with a simplified graphic smiley style — fewer colors, more designed. Style TBD pending design pass against the uploaded reference image. | Pending |
| 2026-04-17 | About — Privacy copy tone | Current copy uses technical language and a defensive tone. Rewrite to be warm and plain — "Your notes are yours. They live on your phone and go nowhere." Exact copy TBD. Direction is now in specs. | Pending |

---

## Developer Tools

Features needed in a developer/debug mode section of the Settings screen. Visible in development builds only.

| # | Feature | Description |
|---|---------|-------------|
| 1 | Reset all data | Flush the entire DB (all entries, medications, doses, settings) and redirect the user to the onboarding/intro screen. Full clean slate. |
| 2 | Back to intro | Navigate to the onboarding/intro screen without touching the DB. Useful for re-testing the onboarding flow while keeping real records intact. |
| 3 | Load "Client A" | Seed the DB with a predefined demo user. Clears any existing data first, then inserts: one medication (Ibuprofen 200mg, oral), 20 pain entries spanning the past 30 days (pain level 3–6, region: head, timestamps roughly random but covering the full 30-day window, from 30 days ago through yesterday), and 20 corresponding medication dose logs for Ibuprofen at roughly the same time as each pain entry (within minutes). Events are not evenly spaced — randomised across the 30-day window. No entries for today. |
| 4 | Load "Jerry" | Mild, consistent pain tracker. Daily entries, pain 0–3, regions: legs or feet (varies). One medication (e.g. Naproxen 220mg, oral). Dose logged same day as pain entry, roughly consistent timing. 30 days of data, one entry per day, no gaps. Steady and predictable — good for testing the sparkline and report averages with clean data. |
| 5 | Load "Micky" | Irregular, high-variance pain tracker. Pain ranges 3–7 with occasional 0s (logs when he remembers, not when pain is worst). Region: abdomen. Records every 2–3 days — roughly 12–15 entries over 30 days, unevenly spaced. Medications are sporadic and varied: pick randomly from 5 medications with different dosages (e.g. Tramadol 50mg, Gabapentin 300mg, Ibuprofen 400mg, Diclofenac 25mg gel topical, Cyclobenzaprine 5mg oral). Dose logs present for only about half the pain entries, and sometimes logged for days with no pain entry. Good for testing spiky sparklines, gap handling, and multi-medication reports. |
| 6 | Load "Donny" | Medication-focused, minimal pain tracker. Primarily logs drug intake rather than pain. Two medications taken in the AM (e.g. Methotrexate 2.5mg oral + Folic Acid 1mg oral), one different medication in the PM (e.g. Hydroxychloroquine 200mg oral). Dose logs span 30 days, roughly daily for AM pair and every 1–2 days for PM. Occasional headache pain entry (pain 2–4, region: head) — maybe 5–6 times over the 30 days, not always paired with a dose log. Good for testing the medication-heavy usage pattern and the two-column history layout. |

---

## Moved to Specs

Items whose direction was clear enough to incorporate into `02-features.md` or `04-design-system.md`.

| Date       | Area | Summary | Spec location |
|------------|------|---------|---------------|
| 2026-04-17 | Log Pain — Step 1 | Remove "0 = no pain / 10 = worst imaginable" helper text | `02-features.md` — Pain Log Entry, UI rules |
| 2026-04-17 | Log Pain — Medication step confusion | Remove medication step from pain wizard; add "Save and log medication" dual exit on final step | `02-features.md` — Pain Log Entry steps |
| 2026-04-17 | Log Pain / Log Medication — Visual identity | Pain wizard uses red family, medication wizard uses green family, applied to header/progress/button | `02-features.md` — Pain Log Entry, Log Medication; `04-design-system.md` — Wizard visual identity |
| 2026-04-17 | Log Pain — Remember previous selections | Soft-pre-select regions, qualities, triggers from most recent entry on wizard open | `02-features.md` — Pain Log Entry |
| 2026-04-17 | Log Pain — Remove "optional" labels | No "optional" section text; Next button state communicates requirements | `02-features.md` — UI rules; `04-design-system.md` — UI copy rules |
| 2026-04-17 | Log Pain — Alphabetical ordering | Region and quality chips listed alphabetically | `02-features.md` — UI rules |
| 2026-04-17 | Log Medication — Single dose only | Multi-select medications + stepper per medication for dose count | `02-features.md` — Log Medication |
| 2026-04-17 | History — Medication doses missing | Two-column history layout: pain left, medication right, color-coded, time-aligned by day | `02-features.md` — History / Records |
| 2026-04-17 | Medications — "+" icon collision | Replace header "+" with labelled "Add medication" button | `02-features.md` — Medications |
| 2026-04-17 | Settings — Reminder time picker buggy | Replace green text + floating picker with a tappable filled pill (white on green) | `02-features.md` — Settings; `04-design-system.md` — Filled pill |
| 2026-04-17 | Settings — Remove inline hint text | Remove self-evident hints; only show hints for genuinely non-obvious content | `02-features.md` — Settings; `04-design-system.md` — UI copy rules |
| 2026-04-17 | About — Privacy copy tone | Direction set: warm, plain language, positive framing. Exact copy TBD. | `02-features.md` — About + Contact |

---

## Deferred

_Feedback captured but intentionally pushed to a later version._
