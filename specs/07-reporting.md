# Reporting & PDF Export

This document specifies the PDF report feature for Lilypad — a patient-facing document
intended to be shared with or printed for a healthcare provider.

---

## Purpose

The report gives a provider a structured, printable summary of the patient's pain and
medication history over a configurable period. It is generated on-device from local
data and exported via the system share sheet.

---

## Report Structure

The PDF is US Letter portrait (8.5 x 11 in). Content flows top-to-bottom across as many pages as needed.

### 1. Header

Appears once at the top of the first page.

| Element | Source | Notes |
|---|---|---|
| Title | Static | "Pain & Medication Report" |
| Patient name | `app_settings.patient_name` | Omitted if not set |
| Brand | Static | "Lilypad · ThePainNP" |
| Generated date | System date at export time | e.g. "April 27, 2026" |
| Report period | Derived from date range selection | e.g. "March 28 – April 27, 2026" |

---

### 2. Active Medications Card

A card listing all medications where `is_active = 1`.

Each medication chip shows:
- Name + dose (bold, med green)
- Frequency · route (secondary, smaller)

Chips wrap horizontally. Card uses the `card` background with `border` outline.

If no active medications exist, the card reads: "No active medications on record."

---

### 3. Pain Trend Chart

A simple line chart rendered as inline SVG (not a screen capture).

| Property | Value |
|---|---|
| X axis | Report period in days (default 30) |
| Y axis | 0–10 pain scale |
| Data point | Daily peak pain level |
| Line | Single red (`#A84A42`) polyline, 2px stroke |
| Dots | Filled circles at each data point (r=2.4) |
| Gaps | Days with no pain entry have no dot; the line breaks |
| Grid | Horizontal gridlines at 0, 2, 4, 6, 8, 10 |
| X labels | Every 5 days + final day |
| Y labels | At each gridline |

Chart is wrapped in the `card`-background container with `border` outline.

**Fallback:** If the SVG render fails (e.g. Android WebView edge case), display
the text: "Chart unavailable on this device" and continue with the table.

---

### 4. Pain & Medication Timeline Table

The primary clinical content of the report. Lists all pain entries and medication
dose events in the report period, **sorted newest-first** (descending by date,
then time).

Newest-first is preferred because:
- The most clinically relevant data (recent episodes) is immediately visible
- Matches the History screen sort order the patient already uses
- Avoids burying current status on page 5

#### Column structure

| # | Column | Width | Pain rows | Med rows |
|---|---|---|---|---|
| 1 | Date & Time | 12% | Date (bold) + time | Date (lighter) + time |
| 2 | Level | 10% | Pain pill indicator (see below) | Empty |
| 3 | Region | 13% | Pain regions | Medication name + dose (colspan 3→4) |
| 4 | Quality | 11% | Pain qualities | *(spanned by col 3)* |
| 5 | Triggers | 17% | Triggers | Em dash |
| 6 | Mood | 9% | Mood score + label | Em dash |
| 7 | Sleep | 9% | Sleep score + label | Em dash |
| 8 | Notes | 19% | Free-text note | Free-text note |

- For **medication rows**, columns 3–4 are spanned and display `{med name} {dose}` + quantity.
- Columns 5–7 are empty (—) for medication rows.
- Long values in any cell wrap to additional lines within the same row.

#### Row visual treatment

**Pain rows:**
- Background: `painLight` (`#F6EAE8`) - prints as a distinct light gray on B&W laser
- Row separator: `#edd8d6`
- All text at standard weight and color

**Medication rows:**
- Background: white
- All text italic, `textSecondary` (`#6B7C73`) color — including the medication name
- No bold, no accent color; medication rows are intentionally subordinate to pain rows
- Row separator: `border` (`#D0DFDA`)

#### Date grouping

The date cell uses two lines:
- **Line 1:** Day + date label (e.g. "Mon, Apr 27") — shown only on the first row for that date; blank on subsequent rows in the same group.
- **Line 2:** Time in 12-hour AM/PM format (e.g. "2:00 PM") — always shown.

This keeps times visually anchored below their date without repeating the date on every row. A doctor scanning the printout can read the date once and track times downward.

Time format follows 12-hour AM/PM convention (US market).

#### Date group separator

The first row of each new date group receives a 1.5px top border (`#8a9c95`)
across all cells. This clearly delineates date boundaries, preventing a
medication row from appearing visually associated with the pain row above it
from the previous day.

#### Print header repeat

`<thead>` must be declared with `display: table-header-group` so it repeats on
every printed page. The header row uses `text` (`#1C2523`) background with
white text.

#### Page breaks

`page-break-inside: avoid` / `break-inside: avoid` on every `<tr>` to prevent
a single row from splitting across pages.

---

### 5. Pain Level Indicator ("Pain Pill")

Replaces the raw numeric pain score in the Level column with a visual fill indicator.

**Shape:** Rounded rectangle, 78 × 20 px, border-radius 3px.

**Fill logic:**
- Empty outline (white fill, `#A84A42` border, 1.5px) represents 0.
- Fill grows left-to-right: `fillWidth = (level / 10) x innerWidth`.
- Fill color is a single uniform `#A84A42` (pain red) for all levels - no per-level gradient.
  A single color is cleaner, more print-safe, and lets fill width alone carry the signal.
- A clip-path confines the fill to the rounded shape.

**Number placement:**
- `level = 0`: number at far-left inside the empty pill, dark text.
- `level 1–2`: number positioned just to the **right of the fill edge**, left-aligned.
  This visually attaches the number to the fill, making the low fill meaningful.
- `level ≥ 3`: white number centered over the filled area.
- Font: 10px, weight 700.

**B&W print:** Fill goes from no fill (level 0) to full dark fill (level 10),
which prints as a clear light-to-dark gray progression on any laser printer.

---

## Mood & Sleep Score Labels

Mood and sleep are stored as integers 1–5. The report renders them as
`{n} – {label}` (en-dash with thin spaces):

| Value | Mood label | Sleep label |
|---|---|---|
| 1 | Very Low | Very Poor |
| 2 | Low | Poor |
| 3 | Ok | Ok |
| 4 | Good | Good |
| 5 | Excellent | Excellent |

---

## Date Range Options

| Preset | Days |
|---|---|
| Last 7 days | 7 |
| Last 30 days | 30 |
| Last 90 days | 90 |

Default: 30 days. User selects from preset tabs on the Report screen before
exporting. The selected range controls which entries appear in the chart and table,
and what is shown in the "Report period" header line.

Custom date ranges are deferred to V1.1.

---

## Data Sources

| Section | Tables queried |
|---|---|
| Active medications | `medications` WHERE `is_active = 1` |
| Pain chart | `entries` (pain_level, entry_date) within period |
| Timeline — pain rows | `entries` within period |
| Timeline — med rows | `medication_doses` JOIN `medications` within period |

Entries are sorted by `entry_date` DESC, then `created_at` DESC.

`medication_doses` rows are interleaved with `entries` rows in the same sort order.

---

## PDF Generation

- Rendered as an HTML document in a hidden WebView.
- Chart is inline SVG (computed from data, never a screen capture).
- Font: Source Sans 3 (400-700) throughout. No secondary font.
- Print CSS: `@page { size: letter; margin: 0.5in 0.5in; }` (US Letter, 8.5 x 11 in).
- Exported via `react-native-print` or `expo-print` -> share sheet.
- File name: `lilypad-report-{YYYY-MM-DD}.pdf`.

**Print color handling:**
```css
-webkit-print-color-adjust: exact;
print-color-adjust: exact;
```
Applied to pain rows so the `painLight` background is preserved in PDF output.

---

## Footer

Appears at the bottom of every page (CSS `position: running(footer)` or equivalent).

Content: `"Lilypad is a personal logging tool, not a medical record. For clinical
use by {patient name}'s provider only."` on the left; `"{patient name} · {date}"` on
the right.

---

## Out of scope (V1)

- Custom date range picker (V1.1)
- Provider letterhead / logo (TBD — placeholder text used in V1)
- Medication schedule compliance summary
- Trigger correlation analysis
- Aggregate statistics block (average/peak/low pain, top triggers) — present on
  the in-app Report screen but not included in the PDF export in V1
