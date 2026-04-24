# Body Map — Pain Zone Coordinates

Reference for implementing the pain location selector in the check-in wizard (step 2).

## Source images

| File | Dimensions | View |
|---|---|---|
| `body-anatomy-front.png` | 381 × 917 px | Front |
| `body-anatomy-back.png` | 381 × 917 px | Back |

Both images have transparent backgrounds. Display them side by side at equal width.
Use the percentage columns for responsive layout — multiply by rendered image width/height
to get pixel hit-target positions.

---

## Zone definitions

Each zone is a circular hit target rendered as a semi-transparent overlay on tap.

**Active state:** `fill: rgba(168, 74, 66, 0.38)` · `stroke: rgba(168, 74, 66, 0.85)` · `stroke-width: 2px`
**Ghost state (always visible):** dashed ring `stroke: rgba(168, 74, 66, 0.22)` · `stroke-dasharray: 4 3`

Colors use `Colors.pain` (`#A84A42`) at reduced opacity. Do not use a different color
for hit targets — the pain color is the visual language for "this is where it hurts."

| Zone ID | Label | View | cx (px) | cy (px) | r (px) | cx % | cy % | r % |
|---|---|---|---|---|---|---|---|---|
| `head` | Head | both | 191 | 62 | 50 | 50.1% | 6.8% | 13.1% |
| `neck` | Neck | both | 191 | 138 | 22 | 50.1% | 15.1% | 5.8% |
| `shoulder-l` | Shoulders | both | 102 | 188 | 40 | 26.8% | 20.5% | 10.5% |
| `shoulder-r` | Shoulders | both | 280 | 188 | 40 | 73.5% | 20.5% | 10.5% |
| `chest` | Chest | front | 191 | 258 | 52 | 50.1% | 28.1% | 13.6% |
| `upper-back` | Upper Back | back | 191 | 252 | 58 | 50.1% | 27.5% | 15.2% |
| `arm-l` | Arms | both | 76 | 355 | 32 | 19.9% | 38.7% | 8.4% |
| `arm-r` | Arms | both | 305 | 355 | 32 | 80.1% | 38.7% | 8.4% |
| `abdomen` | Abdomen | front | 191 | 370 | 46 | 50.1% | 40.3% | 12.1% |
| `lower-back` | Lower Back | back | 191 | 382 | 50 | 50.1% | 41.7% | 13.1% |
| `hips` | Hips / Pelvis | both | 191 | 462 | 56 | 50.1% | 50.4% | 14.7% |
| `hand-l` | Hands | both | 50 | 488 | 30 | 13.1% | 53.2% | 7.9% |
| `hand-r` | Hands | both | 332 | 488 | 30 | 87.1% | 53.2% | 7.9% |
| `leg-l` | Legs | both | 155 | 650 | 40 | 40.7% | 70.9% | 10.5% |
| `leg-r` | Legs | both | 228 | 650 | 40 | 59.8% | 70.9% | 10.5% |
| `foot-l` | Feet | both | 148 | 872 | 28 | 38.8% | 95.1% | 7.3% |
| `foot-r` | Feet | both | 234 | 872 | 28 | 61.4% | 95.1% | 7.3% |

---

## Canonical regions (what the app toggles)

The 11 clinical regions map to zone IDs as follows. Selecting a region activates
all its zones simultaneously.

| Region ID | Display label | Zone IDs | Notes |
|---|---|---|---|
| `head` | Head / Face | `head` | Both views |
| `neck` | Neck | `neck` | Both views |
| `shoulders` | Shoulder(s) | `shoulder-l`, `shoulder-r` | Both views |
| `arms` | Arm(s) / Elbow(s) / Wrist(s) | `arm-l`, `arm-r` | Both views |
| `hands` | Hand(s) | `hand-l`, `hand-r` | Both views |
| `chest` | Chest | `chest` | Front only |
| `upper-back` | Upper Back | `upper-back` | Back only |
| `lower-back` | Lower Back | `lower-back` | Back only |
| `abdomen` | Abdomen | `abdomen` | Front only |
| `hips` | Hip(s) / Pelvis | `hips` | Both views |
| `legs` | Leg(s) / Knee(s) | `leg-l`, `leg-r` | Both views |
| `feet` | Feet | `foot-l`, `foot-r` | Both views |

**Total: 12 regions** (spec lists 11 — "Leg(s) / knee(s) / feet" has been split into
`legs` and `feet` for more precise location data; merge back to one region if clinical
guidance prefers).

---

## Implementation notes

### Layout
- Display front and back images side by side, equal width, inside a card
- Overlay an absolutely-positioned SVG (same dimensions as the image) on each
- SVG `viewBox="0 0 381 917"`, width/height 100% of the container
- Use `pointer-events: none` on the image; `pointer-events: all` on the SVG

### Hit targets
- Each zone renders two SVG `<circle>` elements:
  1. Ghost ring (always visible, dashed) — communicates "this is tappable"
  2. Active fill (visible only when selected)
- Minimum tap target: the rendered radius should be ≥ 22px at the displayed size.
  At 160px display width (smallest side-by-side on iPhone SE), r% × 160 gives the
  smallest zone (neck, r=5.8%) a 9px radius — borderline. Consider a minimum
  enforced radius of 22px display-pixels regardless of percentage.

### Selection state
- Selecting a region activates both its zones (left + right)
- Selected zone names are echoed as chips below the body map for accessibility
- Chips are listed alphabetically per spec

### Accessibility
- Each hit target should have an `accessibilityLabel` matching the region display label
- Consider a "Select all" chip and "Clear all" action for users who find the visual
  interaction difficult

### Reference implementation
See `design/body-map-zones.html` for a working interactive demo with all zones,
chips, and the coordinate table rendered live.
