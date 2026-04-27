# Design System

Tokens here are the canonical source of truth. All values flow into
`constants/theme.ts` — no hardcoded hex values anywhere else in the codebase.

---

## Color

### Philosophy: two registers

The app has two visual registers that must never bleed into each other:

- **Ground** — backgrounds, cards, chrome, tab bar. Always muted. Reduces fatigue
  for a user tracking something unpleasant day after day.
- **Signal** — pain ramp, glyph colors, sparkline dots, history rate chips. Signal
  carries chroma. When a user sees warm color, it means pain data. That categorical
  clarity is the app's most important perceptual contract.

### Semantic split

Two action colors carry distinct clinical meaning throughout the app:

| Token | Hex | Meaning |
|---|---|---|
| `pain` | `#A84A42` | Pain-related actions and data |
| `med` | `#2E7D5E` | Medication-related actions and data; also the brand color |

**Why this split:** Red tones universally signal pain/discomfort; green signals
safe/healing. Both are desaturated enough to feel calm rather than alarming, but
pushed far enough to read instantly at a glance.

**Note on `pain`:** The original spec used `#9E5252` (dusty rose). This has been
updated to `#A84A42` — a more clinical red that reads unambiguously at level 10 of
the pain ramp. A doctor scanning History should read severity before they read any
numbers. See `decisions/007-visual-language.md`.

The app brand color (teal/aqua from the icon) is a background/ambient color only.
It appears in the page background — not on interactive elements.

### Full palette

```ts
// Backgrounds
bg:              '#E4EFE8'   // Screen background — mint-sage, slightly warmer than original
card:            '#F5FAF6'   // Widget/card surface — lighter than bg, creates elevation
cardAlt:         '#EEF5F0'   // Secondary surfaces, unselected chip backgrounds

// Text
text:            '#1C2523'   // Primary text
textSecondary:   '#6B7C73'   // Labels, timestamps, secondary copy
textFaint:       '#9AA8A0'   // Placeholder text, empty state copy

// Borders & separators
border:          '#CFDED8'
divider:         '#DDE8E2'   // Intra-card row separators

// Action: pain (clinical red family)
pain:            '#A84A42'
painDeep:        '#8F3830'   // Pressed state, active borders
painLight:       '#F6EAE8'   // Wizard background, pain row tints

// Action: medication (forest green)
med:             '#2E7D5E'
medDeep:         '#1F5D46'   // Pressed state
medLight:        '#E6F3ED'   // Wizard background, med row tints
brand:           '#2E7D5E'   // Same as med

// Accent
mint:            '#8BCFAA'   // Sparkline fill, subtle accents

// Toast — neutral dark, never green (green would be misread as medication-related)
toastBg:         '#2C3532'
toastText:       '#F5FAF6'
```

### Pain scale gradient (0–10)

Chroma lifted ~15% from the original spec. Level 10 ends in a true clinical red,
not muted brick rose. Used on pain selector rate chips, history row rate chips, sparkline dots.

| Level | Background | Text | Label |
|---|---|---|---|
| 0 | `#E9EBE6` | `#5F6E64` | No pain |
| 1 | `#F2E8B8` | `#7A6A30` | Very mild |
| 2 | `#F2D888` | `#6F5418` | Mild |
| 3 | `#EFC252` | `#5F3A00` | Noticeable |
| 4 | `#E5A020` | `#ffffff` | Moderate |
| 5 | `#D77A18` | `#ffffff` | Affects tasks |
| 6 | `#C85A22` | `#ffffff` | Severe |
| 7 | `#BC4428` | `#ffffff` | Very severe |
| 8 | `#B0372C` | `#ffffff` | Intense |
| 9 | `#A02E2E` | `#ffffff` | Excruciating |
| 10 | `#8F2A30` | `#ffffff` | Worst imaginable |

### Mood scale (1–5)

Red (bad) → green (good). Replaces the original cool-gray axis with a clinically
intuitive mapping: any red rate chip = bad, any green rate chip = good, across all scales.

| Level | Background | Text | Label |
|---|---|---|---|
| 1 | `#C84A3F` | `#ffffff` | Terrible |
| 2 | `#E08A36` | `#ffffff` | Low |
| 3 | `#E5BE3A` | `#3A3530` | OK |
| 4 | `#7AB552` | `#ffffff` | Good |
| 5 | `#3F8F4A` | `#ffffff` | Great |

### Sleep quality scale (1–5)

Same red→green axis as mood for visual consistency.

| Level | Background | Text | Label |
|---|---|---|---|
| 1 | `#C84A3F` | `#ffffff` | Terrible |
| 2 | `#E08A36` | `#ffffff` | Poor |
| 3 | `#E5BE3A` | `#3A3530` | OK |
| 4 | `#7AB552` | `#ffffff` | Good |
| 5 | `#3F8F4A` | `#ffffff` | Rested |

---

## Typography

### Fonts

Single-font system. See `decisions/007-visual-language.md` for rationale.

| Role | Family | Source |
|---|---|---|
| All in-app UI | Source Sans 3 (variable, 400–700) | Google Fonts — free |
| PDF report header + About display | Lora (500–600) | Google Fonts — free |

**Fraunces and Instrument Sans are removed.** Source Sans 3 is a humanist sans
designed for legibility at all sizes — critical for a 40–70+ audience who may be
logging while in pain. Lora preserves editorial warmth on the two surfaces where
it earns its place (the clinical document and the brand story).

Both loaded via `expo-font` at app startup.

### Scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `greeting` | 30px | 600 | "Hello, Sarah" home screen greeting |
| `sectionHeading` | 24px | 700 | Wizard step headings |
| `bodyLarge` | 17px | 600 | Primary labels: medication names, pain card regions, list primary text |
| `body` | 15px | 500 | Secondary body: dose/route lines, activity rows, card subtitles |
| `bodySmall` | 14px | 400 | Timestamps, status lines ("1 dose today", "Last: Apr 14") — minimum readable size |
| `label` | 13px | 600 | Section labels (sentence case, `text` color, no letter-spacing, no ALL CAPS) |
| `tabLabel` | 12px | 500 | Tab bar labels |

---

## Spacing

8px base unit. All spacing values are multiples.

| Token | Value |
|---|---|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |

---

## Touch targets

Minimum **48px** height on all interactive elements. Primary action buttons are
**54–56px** tall. Stepper buttons (medication dose) are **34×34px** minimum.

---

## Border radius

| Token | Value | Usage |
|---|---|---|
| `card` | 20px | All widget cards |
| `button` | 28px | Primary action buttons (pill shape) |
| `chip` | 12px | Selection chips (regions, triggers, qualities) |
| `rateChip` | 10px | Pain/mood/sleep rate chips in list rows and selectors |

---

## Shadows

```ts
card:     '0 4px 16px rgba(26,122,78,0.10), 0 1px 4px rgba(26,122,78,0.06)'
cardSoft: '0 2px 8px rgba(26,122,78,0.06)'
// Green-tinted shadow — cards feel like they belong on the green background
```

---

## Components

### Primary action buttons (Log Pain / Log Medication)

- Equal width, side by side, 50/50 grid
- Height: 100px, border-radius: 28px (pill)
- Log Pain: `pain` background, white label + waveform icon
- Log Medication: `med` background, white label + capsule icon
- Icon above label, centered
- Label font: `bodyLarge` (17px, weight 600)

### Rate chip (universal — pain / mood / sleep)

One shell, three payloads. A user who learns the pain rate chip has learned mood and sleep.

- **Size:** 34×34px in list/history rows; 50×50px in wizard selection rows
- **Shape:** 10px border-radius (`rateChip` token) rounded square
- **Pain rate chip:** numeral centered, color from pain ramp above
- **Mood rate chip:** smiley-face glyph (see Glyph system below), color from mood ramp
- **Sleep rate chip:** sleepy-face glyph (see Glyph system below), color from sleep ramp
- **Selected state:** 3px solid border, color = the chip's own ramp background darkened by ~20% (each ramp level defines its own selection border — not a shared token). Render a 3px transparent border on all unselected chips at all times so layout is stable and no content shifts on selection. No padding increase. The scale animation (see Motion) applies via transform on the chip element only — the surrounding container does not resize.

### Glyph system (mood + sleep)

Unicode emoji are replaced by a custom glyph family. See `decisions/007-visual-language.md`.

**Mood glyphs (1–5):** Full smiley face — circle outline, dot eyes, expressive brows
(angled down for 1–2, neutral for 3, lifted for 4–5), mouth curve (deep frown → flat
→ broad smile). Rendered at 28px inside the 50×50 wizard rate chip; 22px inside the
34×34 history rate chip.

**Sleep glyphs (1–5):** Same face family. Closed eyes for levels 3–5 (drowsy/rested),
open distressed eyes for 1–2. Small "z" in the top-right corner distinguishes sleep
from mood at a glance.

Both glyph colors use their rate chip's `fg` value (white on dark, dark on mid-tone).

### Pain selector (wizard step 1)

- Vertical list, 11 rows (0–10)
- Row height: 48px (full-width tap target)
- Left: pain rate chip (34×34px, `rateChip` radius 10px) with numeral — per ramp above
- Right: description label (`bodyLarge`)
- Selected: row background tinted `painLight`, label bold, checkmark right
- Next disabled until a selection is made
- Do not show "0 = no pain / 10 = worst imaginable" header text — each row already labels 0 and 10

### Body map (wizard step 2)

Location selection uses real anatomical silhouette images with circular hit targets
overlaid as an SVG layer. See `body-map-coordinates.md` for the full coordinate
reference and implementation notes.

**Images:**
- `body-anatomy-front.png` — 381 × 917 px, transparent background
- `body-anatomy-back.png` — 381 × 917 px, transparent background
- Displayed side by side at equal width inside the step card

**Hit targets:**
- Circular SVG overlays positioned per the coordinate table in `body-map-coordinates.md`
- Ghost ring always visible (dashed, `Colors.pain` at low opacity) — communicates tappability
- Active fill: `rgba(168, 74, 66, 0.38)` with `rgba(168, 74, 66, 0.85)` stroke
- Selected zone names echoed as chips below the map (alphabetical)

**Regions (12):** Head / Face, Neck, Shoulders, Arms / Elbows / Wrists, Hands,
Chest (front), Upper Back (back), Lower Back (back), Abdomen (front),
Hips / Pelvis, Legs / Knees, Feet

**Side-by-side is the default layout.** A stacked single-view with Front/Back toggle
should be validated in prototype testing on iPhone SE (smallest supported device).

### Widget cards (Home screen)

- Background: `card`
- Shadow: card shadow
- Border-radius: 20px
- Section label: `label` token (13px, 600 weight, sentence case, `text` color)
- Content padding: 16px

### Wizard visual identity

Each wizard is chromatically distinct so the user always knows which flow they are in.
Applied to the **entire wizard background** (not just the header), progress bar fill,
and primary action button.

| Flow | Background | Progress | Button |
|---|---|---|---|
| Pain wizard | `painLight` (#F6EAE8) | `pain` fill | `pain` bg |
| Medication wizard | `medLight` (#E6F3ED) | `med` fill | `med` bg |

**Note:** Painting only the header in `painLight` while leaving the body in `bg`
(green) creates a harsh collision at the boundary. Full-background identity resolves
this and reinforces the categorical split.

**Wizard button typography:** `bodyLarge` (17px, weight 600), white text. All wizard
action buttons (primary and secondary/outline) use this size - do not use a smaller
token.

### Filled pill (tappable value display)

Used for settings values that are readable and tappable (e.g. reminder time).

- Background: `med`
- Text: `#ffffff`, Source Sans 3, `bodySmall`, weight 600
- Border-radius: 28px (full pill)
- Padding: 6px vertical, 14px horizontal
- Disabled (toggle off): background `border`, text `textSecondary`
- Tap opens relevant picker inline

### Stepper (medication dose count)

- Two 34×34px circle buttons (− / +), count label between
- − button: `border` bg when count = 0; `med` bg when count > 0
- + button: always `med` bg
- All text and symbols vertically centered with flexbox

### Toast

- Background: `toastBg` (#2C3532), text: `toastText` (#F5FAF6)
- Pill shape, 28px border-radius, leading checkmark icon
- Positioned above tab bar — never overlaps any button
- Never green — `med` green is a categorical action color; a green toast would be
  misread as medication-related

### Close / dismiss button

Applies to all modals, bottom sheets, and wizard overlays (Log Medication, Add Medication, any future sheet).

- **Position: top-left, always.** Never top-right.
- Icon: "X" or chevron-left, 24px, `textSecondary` color
- Touch target: 44x44px minimum
- Consistent across every surface in the app - no exceptions

### UI copy rules

- All button labels use **Title Case**: "Save Pain Log", "Next", "Log Doses", "Add Medication"
- No ampersand — use "and" in full: "Save and Log Medication"
- No inline hint text under self-evident fields (name, date, toggle labels)
- No "optional" labels on wizard step headings — Next button state communicates requirements

### Tab bar

- Background: `card`
- Border-top: 1px `border`
- Active icon + label: `brand` (`#2E7D5E`)
- Inactive: `textSecondary`
- **4 tabs: Home, Timeline, Medications, Report**
- No floating "+" center tab — the two primary CTAs on Home are the logging entry points

**Tab icons (24px, 1.75px stroke, rounded joins):**

| Tab | Icon |
|---|---|
| Home | House outline |
| Timeline | Clock with tick |
| Medications | Pharmacy cross (circle + plus) |
| Report | Bar chart |

---

## Dark mode

V1 is light mode only. Deferred. Do not add dark mode variants to `constants/theme.ts`.

---

## Motion

Minimal. Interaction feedback only.

- Button press: `scale(0.97)` + slight brightness reduction, 80ms ease
- Rate chip select: `scale(1.08)` transform on the chip element only, 120ms ease.
  The chip's container does not resize — use `transform` not layout properties so
  surrounding content never shifts.
- No spring physics, no particle effects, no confetti
