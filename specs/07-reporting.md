# Reporting & PDF Export

This document specifies the PDF report feature for Lilypad - a patient-facing document
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
| Report period | Derived from date range selection | e.g. "March 28 - April 27, 2026" |

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
| Y axis | 0-10 pain scale |
| Data point | Daily peak pain level |
| Line | Single red (`#A84A42`) polyline, 1.8px stroke |
| Dots | Filled circles at each data point (r=2) |
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
| 1 | Date & Time | 14% | Time in 12-hour AM/PM format | Time (lighter) |
| 2 | Level | 8% | Pain pill indicator (see below) | Empty |
| 3 | Region | 13% | Pain regions | Medication name + dose (colspan 3+4) |
| 4 | Quality | 10% | Pain qualities | *(spanned by col 3)* |
| 5 | Triggers | 16% | Triggers | - |
| 6 | Mood | 9% | Mood score + label | - |
| 7 | Sleep | 9% | Sleep score + label | - |
| 8 | Notes | 21% | Free-text note | Free-text note |

- For **medication rows**, columns 3-4 are spanned and display `{med name} {dose}` + quantity (e.g. `×2`).
- Columns 5-7 are empty (-) for medication rows.
- Long values in any cell wrap to additional lines within the same row.

#### Row visual treatment

**Pain rows:**
- Background: `painLight` (`#F6EAE8`) - prints as a distinct light gray on B&W laser
- Row separator: `#EDD8D6`
- All text at standard weight and color

**Medication rows:**
- Background: white
- All text italic, `textSecondary` (`#4A5C55`) color - including the medication name
- No bold, no accent color; medication rows are intentionally subordinate to pain rows
- Row separator: `border` (`#D0DFDA`)

#### Date grouping

All entries for the same calendar date are grouped into a single `<tbody>` block. Each
group begins with a **date separator row** - a zero-height row whose sole purpose is to
draw the date label and the horizontal rule between groups. The rows themselves contain
only the time (no date column).

**Date separator row:**
- A full-width `<td colspan="8">` with `border-top: 1.5px solid #8a9c95`
- The row has `height: 0; line-height: 0` so it takes no vertical space in the layout
- A `<span class="date-sep-label">` is positioned absolutely at `top: -0.6em`
  so it straddles the border line vertically
- Label text: full date in "Month D, YYYY" format (e.g. "April 27, 2026"), bold black
- Label uses `text-shadow` (±2px in all 8 directions, white) as an outline to cut through
  the border line - no opaque background behind the text
- The `<td>` has `padding: 0 6pt` (horizontal only) so the border line does not run
  all the way to the table edge
- Label `left` aligns to `5pt` - the same left padding as all data cells, so the date
  reads in the same column as the times below it

**Row spacing around separators:**
- Last row of each date group: `padding-bottom: 7pt` (so the row background fills down to meet the separator)
- First row after each separator: `padding-top: 7pt` (so the row background starts with
  space below the separator line)
- This ensures row background colors (pink/white) bleed up to and away from the separator
  without a gap

**Per-date `<tbody>` approach:**
- Each date group is wrapped in its own `<tbody class="date-group">`
- `break-inside: avoid` on `tbody.date-group` keeps all rows for a day on the same page
  when possible; large groups can still break naturally if too tall
- The shared `<colgroup>` ensures column widths are identical across all groups

#### Table header

- Single `<thead>` at the top of the table - appears once, not repeated on subsequent pages
- Transparent background, bold black (`#1C2523`) text, 7.5pt
- Bottom border: `1.5px solid #1C2523`
- No dark background block

#### Print header repeat

A single `<thead>` is rendered at the top of the table. WKWebView does not reliably
repeat `<thead>` across printed pages (webkit bug #34218), so no header repetition is
implemented in V1. The date separator rows give sufficient orientation context within
each page.

#### Page breaks

`break-inside: avoid` / `page-break-inside: avoid` applied at two levels:
- `tbody.date-group` - tries to keep a full date's rows together
- Individual `<tr>` - prevents a single row from splitting mid-row

---

### 5. Pain Level Indicator ("Pain Pill")

Replaces the raw numeric pain score in the Level column with a visual fill indicator.

**Shape:** Rounded rectangle, 52 × 14 px, border-radius 2px.
(Sized to fit the 8% Level column at standard print width; the visual proportion matches the spec intent.)

**Fill logic:**
- Empty outline (white fill, `#A84A42` border, 1.5px) represents 0.
- Fill grows left-to-right: `fillWidth = (level / 10) x innerWidth`.
- Fill color is a single uniform `#A84A42` (pain red) for all levels - no per-level gradient.
  A single color is cleaner, more print-safe, and lets fill width alone carry the signal.
- A clip-path confines the fill to the rounded shape.

**Number placement:**
- `level = 0`: number at far-left inside the empty pill, dark text (`#5F3A00`).
- `level 1-2`: number positioned just to the **right of the fill edge**, left-aligned, dark text.
  This visually attaches the number to the fill, making the low fill meaningful.
- `level ≥ 3`: white number centered over the filled area.
- Font: 8px, weight 700.

**B&W print:** Fill goes from no fill (level 0) to full dark fill (level 10),
which prints as a clear light-to-dark gray progression on any laser printer.

---

## Mood & Sleep Score Labels

Mood and sleep are stored as integers 1-5. The report renders them as
`{n} - {label}`:

| Value | Mood label | Sleep label |
|---|---|---|
| 1 | Bad | Bad |
| 2 | Low | Poor |
| 3 | Ok | Ok |
| 4 | Good | Good |
| 5 | Great | Great |

---

## Date Range

The report always covers the last 30 days. Custom date range selection is deferred to V1.1.

---

## Export CTA

The export trigger is a prominent button in the top-right of the Report screen header.

- **Label:** "Export PDF" with a share icon (SF Symbols `square.and.arrow.up` / Material equivalent)
- **Style:** `med` background, white text, pill shape - matches the primary action button system
- **Loading state:** spinner replaces the icon while the PDF is being generated; button is disabled
- **On tap:** generates the PDF for the last 30 days and opens the system share sheet

---

## Data Sources

| Section | Tables queried |
|---|---|
| Active medications | `medications` WHERE `is_active = 1` |
| Pain chart | `entries` (pain_level, entry_date) within period |
| Timeline - pain rows | `entries` within period |
| Timeline - med rows | `medication_doses` JOIN `medications` within period |

The timeline follows the same data pattern as the in-app Timeline screen: pain entries
and dose rows are fetched separately then merged and sorted by date/time before rendering.
Sort order: `entry_date` DESC, then `created_at` DESC (for entries) / `taken_at` DESC (for doses).

---

## PDF Generation

- Rendered as an HTML document in a hidden WebView.
- Chart is inline SVG (computed from data, never a screen capture).
- Font: Source Sans 3 (400-700) for body text; Lora (500-600) for the report title and section headings. Both already loaded at app startup per the design system.
- Print CSS: `@page { size: letter portrait; margin: 0.5in; }` (US Letter, 8.5 x 11 in).
- Exported via expo-print -> expo-file-system rename -> share sheet.
- File name: `{patient_name} - Pain and Medication Journal - ThePainNP.pdf`
  - `{patient_name}` comes from `app_settings.patient_name`; falls back to `"Patient"` if not set.
  - Characters invalid in filenames (`/ \ : * ? " < > |`) are replaced with `_`.

**Print color handling:**
```css
-webkit-print-color-adjust: exact;
print-color-adjust: exact;
```
Applied to pain rows and date separator rows so backgrounds are preserved in PDF output.

---

## Footer

Appears at the bottom of the last page, after all timeline content. Content: `"Lilypad is a personal
logging tool, not a medical record. For clinical use by {patient name}'s provider only."`
on the left; `"{patient name} · {date}"` on the right.

Implementation: rendered as a normal in-flow `<div>` below the table, so it naturally
appears at the end of the last page.

Page numbering (`Page N of M`) is deferred to V1.1.

---

## Out of scope (V1)

- Date range selector UI (V1.1 - report is fixed at last 30 days for V1)
- Custom date range picker (V1.1)
- Provider letterhead / logo (TBD - placeholder text used in V1)
- Medication schedule compliance summary
- Trigger correlation analysis
- Aggregate statistics block (average/peak/low pain, top triggers) - present on
  the in-app Report screen but not included in the PDF export in V1
- Repeating table header on pages 2+ (V1.1 - WKWebView thead repeat is a known webkit bug)
- Page N of M footer (V1.1)
