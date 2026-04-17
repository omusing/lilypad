# Design System

Tokens here are the canonical source of truth. All values flow into
`constants/theme.ts` — no hardcoded hex values anywhere else in the codebase.

---

## Color

### Semantic split

Two action colors carry distinct clinical meaning throughout the app:

| Token | Hex | Meaning |
|---|---|---|
| `pain` | `#9E5252` | Pain-related actions and data (Log Pain button, pain badges, sparkline, pain score) |
| `med` | `#2E7D5E` | Medication-related actions and data (Log Medication button, dose dots, med badges) |

**Why this split:** Red tones universally signal pain/discomfort; green signals safe/healing. These are categorically distinct — a user tapping quickly in pain should never confuse them. Both are desaturated enough to feel calm rather than alarming.

The app brand color (teal/aqua from the icon) is a background/ambient color, not a primary action color. It appears in the page background and on the web preview shell — not on interactive elements.

### Full palette

```ts
// Backgrounds
bg:              '#E2EEE7'   // Screen background — medium mint-green, gives widgets depth
card:            '#F4FAF6'   // Widget/card surface — lighter than bg, creates elevation

// Text
text:            '#1C2523'   // Primary text
textSecondary:   '#6B7C73'   // Labels, timestamps, secondary copy

// Borders & separators
border:          '#D0DFDA'

// Action: pain (red family, muted brick rose)
pain:            '#9E5252'
painLight:       '#F5EDED'   // Tinted bg for pain-related rows/chips

// Action: medication (green family, forest green)
med:             '#2E7D5E'
medLight:        '#E6F3ED'   // Tinted bg for med-related rows/chips

// Accent
mint:            '#8BCFAA'   // Sparkline dots, subtle accents

// UI chrome (tab bar active state, focus rings — uses med green as brand)
brand:           '#2E7D5E'   // Same as med; medication and brand are both green
```

### Pain scale gradient (0–10)

Used on the pain selector row badges. Runs from neutral gray at 0 through warm
yellows and ambers to the muted brick red at 10.

| Level | Background | Text |
|---|---|---|
| 0 | `#E8E8E4` | `#6B7C73` |
| 1 | `#EDE5C4` | `#7A6A30` |
| 2 | `#EDD898` | `#7A5A18` |
| 3 | `#E8C46C` | `#7A4A10` |
| 4 | `#E0A83C` | `#ffffff` |
| 5 | `#D08830` | `#ffffff` |
| 6 | `#C07040` | `#ffffff` |
| 7 | `#B85848` | `#ffffff` |
| 8 | `#AE4E4E` | `#ffffff` |
| 9 | `#A44848` | `#ffffff` |
| 10 | `#9E5252` | `#ffffff` |

---

## Typography

### Fonts

| Role | Family | Fallback |
|---|---|---|
| Headers / greeting | Fraunces (variable, opsz 9–144) | Georgia, serif |
| Body / UI | Instrument Sans | system-ui, sans-serif |

Both loaded via `expo-font` at app startup. No system font substitution in production.

### Scale

| Token | Size | Weight | Usage |
|---|---|---|---|
| `greeting` | 34px (`clamp(24px, 8vw, 34px)` on web) | 600 | "Hello, Sarah" home screen greeting |
| `sectionHeading` | 26px | 600 (Fraunces) | Wizard step headings |
| `bodyLarge` | 17px | 400 | Primary body copy, list labels |
| `body` | 16px | 400 | Secondary body, activity rows |
| `bodySmall` | 15px | 400 | Timestamps, subtitles |
| `label` | 12px | 600 | ALLCAPS card section labels (letter-spacing 0.8px) |
| `tabLabel` | 11px | 500/600 | Tab bar labels |

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

Minimum **48px** height on all interactive elements (exceeds iOS 44pt and
Material 48dp minimums). Primary action buttons are **56px** tall.

---

## Border radius

| Token | Value | Usage |
|---|---|---|
| `card` | 20px | All widget cards |
| `button` | 28px | Primary action buttons (pill shape) |
| `chip` | 12px | Selection chips (regions, triggers, qualities) |
| `badge` | 10px | Pain level badges in list rows |

---

## Shadows

```ts
card:  '0 4px 16px rgba(26,122,78,0.13), 0 1px 4px rgba(26,122,78,0.08)'
// Green-tinted shadow — cards feel like they belong on the green background
```

---

## Components

### Primary action buttons (Log Pain / Log Medication)

- Equal width, side by side, 50/50 grid
- Height: 100px, border-radius: 28px (pill)
- Log Pain: `pain` background, white label + icon
- Log Medication: `med` background, white label + icon
- Icon above label, centered

### Pain selector (wizard step 1)

- Vertical list, 11 rows (0–10)
- Row height: 48px (full-width tap target)
- Left: colored badge (34×34px, radius 10px) with number — gradient per table above
- Right: description label (16px)
- Selected: row background tinted, label bold, checkmark visible on right
- Next button disabled until a selection is made

### Emoji scale (mood + sleep quality, wizard steps 4–5)

- 5 options in a horizontal row
- Colored face icons, numbered 1–5 below each
- Same row-selection pattern as pain selector but horizontal
- Matches reference: `specs/references/Lilypad App UI Design System Image.png`

### Widget cards (Home screen)

- Background: `card` (`#F4FAF6`)
- Shadow: card shadow above
- Border-radius: 20px
- Section label: 12px, 600 weight, uppercase, `textSecondary` color, letter-spacing 0.8px
- Content padding: 16px

### Tab bar

- Background: `card`
- Border-top: 1px `border`
- Active icon + label: `brand` (`#2E7D5E`)
- Inactive: `textSecondary`
- 4 tabs: Home, History, Medications, Report

---

## Dark mode

V1 is light mode only. Dark mode deferred. Do not add dark mode variants to
`constants/theme.ts` in V1 — it adds maintenance surface with no current user value.

---

## Motion

Minimal. No celebration animations. Interaction feedback only:
- Button press: `scale(0.97)` + slight brightness reduction, 80ms ease
- List row select: badge scale(1.12), 120ms ease
- No spring physics, no particle effects, no confetti
