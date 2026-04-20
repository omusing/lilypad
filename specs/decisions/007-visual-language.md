# 007 — Visual language: typography, glyph system, and color philosophy

**Status:** Decided
**Date:** 2026-04-19

## Context

The original design system specified two fonts (Fraunces + Instrument Sans), Unicode
emoji for mood and sleep scales, and a muted brick-rose pain color (`#9E5252`).
During the graphic standards exploration phase, all three of these choices were
revisited against the actual user profile: adults 40–70+ with chronic pain, often
logging while in pain, on a device with a small screen.

## Options considered

### Typography

#### Option A — Fraunces + Instrument Sans (original spec)
Fraunces is a variable serif with strong editorial warmth. Instrument Sans is a
clean geometric sans. Together they create a warm/clinical contrast.

**Tradeoffs:** Fraunces reads literary and editorial — appropriate for a magazine,
less appropriate for a health utility used under duress. Two font loads add startup
cost. At 11–14px (label, timestamp sizes), Fraunces' optical qualities become a
liability rather than an asset for an older audience.

#### Option B — Source Sans 3 only (selected)
Source Sans 3 is Adobe's humanist sans, free on Google Fonts, variable weight 400–700.
Designed specifically for legibility at all sizes, with enough warmth to avoid the
sterile feel of Inter or Roboto.

Lora (Google Fonts, free) is reserved exclusively for the PDF report header and the
About screen display text — the two surfaces where editorial warmth earns its place
(a clinical document the provider reads, and the brand story page).

**Tradeoffs:** Loses some display warmth on the home greeting. Gained: consistent
legibility across all sizes, single font load for the core UI, cleaner implementation.

#### Option C — Lora only (serif throughout)
More distinctive, preserves editorial feel everywhere.

**Tradeoff:** Serif body text at 13–15px on a mobile screen is harder to scan quickly.
Not appropriate for a utility app with dense clinical data rows.

**Decision: Option B.** Single font for the UI; Lora reserved for PDF/About.

---

### Glyph system (mood + sleep scales)

#### Option A — Unicode emoji (original spec, TBD style)
Fast to implement, universally understood.

**Tradeoff:** Platform-rendered emoji vary by OS version and can't be tinted to the
app's signal-color ramps. They clash with the app's clinical tone. A custom glyph
system makes mood and sleep feel like one system, not two bolt-ons.

#### Option B — Custom colored glyphs (selected)
Full smiley-face glyphs with circle outline, dot eyes, expressive brows, and mouth
curves (deep frown → flat → broad smile for mood; same face with closed eyes + "z"
marker for sleep). Rendered as inline SVG, tinted with the badge color.

One badge shell, three payloads (pain numeral, mood face, sleep face). A user who
learns the pain badge has learned mood and sleep.

**Decision: Option B.** Custom glyphs replace emoji throughout.

---

### Pain color and ramp

#### Option A — Original spec (`#9E5252`, dusty rose at level 10)
Calm, clinical, unalarming.

**Tradeoff:** At level 10, the badge reads as muted rose — not immediately legible
as "severe pain" to a doctor scanning a History screen for the first time.

#### Option B — Pushed chroma (`#A84A42`, clinical red at top) (selected)
The ground palette stays muted (this is not a gamification app). Only the signal
layer gets pushed chroma. The pain ramp ends at `#8F2A30` — unambiguously red. A
provider scanning History reads severity before they read any numbers.

**Decision: Option B.** Muted ground, pushed signal. The pain ramp is the app's
loudest surface, and it should be.

---

### Mood and sleep color axis

#### Option A — Original cool-gray-warm axis
Slate (bad) → warm gray (mid) → forest green (good). Visually interesting but
requires learning the axis direction.

#### Option B — Red → green (selected)
Same intuitive mapping as pain: red = bad, green = good, across all scales. Users
carry this mental model from traffic lights, health indicators, and the pain/med
split itself.

**Decision: Option B.** Consistent red→green across mood, sleep, and pain. The only
difference is hue range — mood/sleep use a brighter red and a softer green than the
pain ramp, so they don't visually collide with pain data in History.

## Consequences

- `constants/theme.ts` pain color changes from `#9E5252` to `#A84A42`. All surfaces
  using `Colors.pain` will shift slightly warmer/darker. QA against History rows,
  wizard header, Log Pain button.
- Fraunces and Instrument Sans font loads can be removed from `expo-font` configuration.
  Source Sans 3 and Lora replace them.
- Mood and sleep emoji in wizard step 4 are replaced by the custom SVG glyph components.
  The `moodRamp` and `sleepRamp` token tables replace any previous color values.
- The badge component becomes universal: same 34×34 shell for pain (numeral), mood
  (face glyph), and sleep (sleepy face glyph). Simplifies the component tree.
