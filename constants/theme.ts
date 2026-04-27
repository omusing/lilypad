// Design tokens — canonical source of truth.
// All values derived from specs/04-design-system.md.
// Never hardcode hex values anywhere else in the codebase — import from here.

export const Colors = {
  // Backgrounds
  bg:            '#E4EFE8',
  card:          '#F5FAF6',
  cardAlt:       '#EEF5F0',

  // Text
  text:          '#1C2523',
  textSecondary: '#6B7C73',
  textFaint:     '#9AA8A0',

  // Borders & separators
  border:        '#CFDED8',
  divider:       '#DDE8E2',

  // Action: pain (clinical red family)
  pain:          '#A84A42',
  painDeep:      '#8F3830',
  painLight:     '#F6EAE8',

  // Action: medication (forest green)
  med:           '#2E7D5E',
  medDeep:       '#1F5D46',
  medLight:      '#E6F3ED',
  brand:         '#2E7D5E',

  // Accent
  mint:          '#8BCFAA',

  // Toast — neutral dark, never green (green would be misread as medication-related)
  toastBg:       '#2C3532',
  toastText:     '#F5FAF6',
} as const;

// Pain scale (0–10). Chroma lifted ~15% from original spec.
export const PainScale = [
  { bg: '#E9EBE6', text: '#5F6E64', label: 'No pain'          }, // 0
  { bg: '#F2E8B8', text: '#7A6A30', label: 'Very mild'         }, // 1
  { bg: '#F2D888', text: '#6F5418', label: 'Mild'              }, // 2
  { bg: '#EFC252', text: '#5F3A00', label: 'Noticeable'        }, // 3
  { bg: '#E5A020', text: '#ffffff', label: 'Moderate'          }, // 4
  { bg: '#D77A18', text: '#ffffff', label: 'Affects tasks'     }, // 5
  { bg: '#C85A22', text: '#ffffff', label: 'Severe'            }, // 6
  { bg: '#BC4428', text: '#ffffff', label: 'Very severe'       }, // 7
  { bg: '#B0372C', text: '#ffffff', label: 'Intense'           }, // 8
  { bg: '#A02E2E', text: '#ffffff', label: 'Excruciating'      }, // 9
  { bg: '#8F2A30', text: '#ffffff', label: 'Worst imaginable'  }, // 10
] as const;

// Mood scale (1–5). Red (bad) → green (good). Index 0 unused; mood values are 1–5.
export const MoodScale = [
  null, // unused
  { bg: '#C84A3F', text: '#ffffff', label: 'Terrible' }, // 1
  { bg: '#E08A36', text: '#ffffff', label: 'Low'      }, // 2
  { bg: '#E5BE3A', text: '#3A3530', label: 'OK'       }, // 3
  { bg: '#7AB552', text: '#ffffff', label: 'Good'     }, // 4
  { bg: '#3F8F4A', text: '#ffffff', label: 'Great'    }, // 5
] as const;

// Sleep quality scale (1–5). Same red→green axis as mood.
export const SleepScale = [
  null, // unused
  { bg: '#C84A3F', text: '#ffffff', label: 'Terrible' }, // 1
  { bg: '#E08A36', text: '#ffffff', label: 'Poor'     }, // 2
  { bg: '#E5BE3A', text: '#3A3530', label: 'OK'       }, // 3
  { bg: '#7AB552', text: '#ffffff', label: 'Good'     }, // 4
  { bg: '#3F8F4A', text: '#ffffff', label: 'Rested'   }, // 5
] as const;

// Single font system. Source Sans 3 for all in-app UI.
// Lora used only in PDF report headers and About display copy.
export const FontFamily = {
  sans:  'SourceSans3',
  serif: 'Lora',  // PDF / About only — not loaded at app startup
} as const;

export const FontSize = {
  greeting:       30,
  sectionHeading: 24,
  bodyLarge:      17,
  body:           15,
  bodySmall:      14,
  label:          13,
  tabLabel:       12,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium:  '500' as const,
  semibold:'600' as const,
  bold:    '700' as const,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  card:     20,
  button:   28,
  chip:     12,
  rateChip: 10,
} as const;

// Minimum touch target height — meets iOS 44pt and Material 48dp.
export const TouchTarget = {
  min:     48,
  primary: 56,
} as const;

export const Shadow = {
  card: {
    shadowColor:   '#1A7A4E',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius:  16,
    elevation:     4,
  },
  cardSoft: {
    shadowColor:   '#1A7A4E',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation:     2,
  },
} as const;
