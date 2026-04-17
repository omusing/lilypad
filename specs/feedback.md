# Product Feedback

Ongoing notes and observations. Each entry has a date, the screen or area it affects, and the feedback. Status tracks whether it has been applied, deferred, or is pending.

---

## Open

| Date       | Area              | Feedback                                                                                                                          | Status  |
|------------|-------------------|-----------------------------------------------------------------------------------------------------------------------------------|---------|
| 2026-04-17 | Log Pain — Step 1 | Remove the "0 = no pain / 10 = worst imaginable" helper text above the pain score list. Each row already labels 0 and 10 explicitly. Removing it reduces scrolling and pulls the choices up. | Pending |
| 2026-04-17 | History / Entry Detail | No way to edit an existing entry. The Entry Detail screen currently shows fields read-only with only a delete option. Users need to be able to correct mistakes or fill in details they missed. | Pending |
| 2026-04-17 | Medications — Toast | The success toast appears at the bottom of the screen, overlapping the green "+" add button. Both share the same green background color (`Colors.med`), so they visually collide. Toast needs a distinct position, style, or color to stand apart from the button. | Pending |
| 2026-04-17 | Log Pain — Medication step confusion | The medication selection at the end of the pain wizard is ambiguous. Users may not understand that checking a medication there does not create a dose log — it only annotates the pain entry. This creates a false sense that the medication was logged. Proposal: remove the medication step from the pain wizard entirely. Instead, the final step (mood/sleep or note) should offer two exit actions: "Save pain log" and "Save and log medication" — the second continuing into the medication wizard flow. This makes the two systems explicit and avoids the false coupling. | Pending |
| 2026-04-17 | Log Pain / Log Medication — Visual identity | The two core logging flows (pain and medication) need a clearer visual language so the user always knows which wizard they are in. Currently both share the same layout chrome and progress bar style. Consider distinct header colors, progress bar colors, or background tints — pain in the red family (`#9E5252`), medication in the green family (`#2E7D5E`) — applied consistently across the wizard header, progress bar, and primary action button. The goal is that a glance at any step immediately tells you which flow you are in. | Pending |
| 2026-04-17 | Log Pain — Remember previous selections | When logging pain, the user's previously recorded choices (body regions, pain quality, triggers) should be surfaced as a convenience. For example, if "lower back" and "stabbing" were selected in the last entry, those could appear pre-highlighted or shown as "last time" suggestions. Reduces re-entry friction for users with chronic, consistent pain patterns. Exact interaction TBD — could be subtle highlighting, a "same as last time" shortcut, or a soft pre-selection the user can override. | Pending |
| 2026-04-17 | Log Pain — Remove "optional" section labels | The header text "both sections are optional" on step screens is unnecessary. The UI should communicate this through behavior — the Next button should be enabled/disabled based on whether required choices have been made, and optional steps should allow advancing without any selection. Remove explicit "optional" copy and let the controls speak for themselves. | Pending |
| 2026-04-17 | Log Pain — Alphabetical ordering | Body region chips and pain quality chips should be listed in alphabetical order. Makes it easier to scan and locate a specific item, especially as the user becomes familiar with the list. | Pending |
| 2026-04-17 | Log Pain — Mood/sleep emoji style | The current emoji icons for mood and sleep (😞😕😐🙂😊 etc.) feel generic and clash with the app's calm, clinical tone. Replace with a custom or simplified smiley style consistent with the uploaded design reference — fewer colors, more graphic, less "emoji keyboard". The goal is a uniform UI element that feels designed for this app rather than borrowed from a chat interface. Style TBD pending design pass. | Pending |
| 2026-04-17 | About — Privacy copy tone | The current "your data stays on your device" section uses technical language (SQLite, "transmitted", "synced") and a defensive tone that reads like a legal disclaimer. Revisit the copy to feel warm and reassuring instead — the goal is to make the user feel safe, not to enumerate what we don't do. Avoid jargon entirely. Something closer to "Your notes are yours. They live on your phone and go nowhere." Exact copy TBD but the principle is: positive framing, plain language, human tone. | Pending |
| 2026-04-17 | Medications — "+" icon collision | The Medications tab has a green "+" button in the top-right header for adding a new medication, but the tab bar also has a center "+" button for logging pain or medication. Two "+" buttons with the same color and similar position creates confusion about what each one does. Replace the header "+" with a clearly labelled action — e.g. an "Add medication" text button or a "Manage" link — so the two actions are visually and semantically distinct. | Pending |
| 2026-04-17 | Log Medication — Single dose only | The current log medication screen only lets the user select one medication and logs exactly one dose. Two improvements needed: (1) allow selecting multiple medications in a single session (e.g. took Ibuprofen and Tylenol together); (2) allow incrementing the dose count per medication — a stepper (− / +) so the user can record "2 tablets of Ibuprofen" as two doses without logging separately. Each tap of + should insert an additional `medication_doses` row for that medication. | Pending |
| 2026-04-17 | History — Medication doses missing | Medication doses are not shown in the History tab — only pain log entries appear. Proposal: a two-column scrollable history layout where pain entries appear in the left column and medication doses in the right column, both aligned to the existing color scheme (pain = red family `#9E5252`, medication = green family `#2E7D5E`). Rows should be roughly time-aligned so the user can see the relationship between doses and pain levels. | Pending |

---

## Applied

_Feedback that has been implemented in code._

---

## Deferred

_Feedback captured but intentionally pushed to a later version._
