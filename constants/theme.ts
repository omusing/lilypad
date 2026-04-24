// Design tokens — canonical source of truth.
// All values derived from specs/04-design-system.md.
// Never hardcode hex/px values in components — import from here.

export const Colors = {
  // Backgrounds
  bg:            '#E2EEE7',
  card:          '#F4FAF6',

  // Text
  text:          '#1C2523',
  textSecondary: '#6B7C73',

  // Borders
  border:        '#D0DFDA',

  // Action: pain (muted brick rose — red family)
  pain:          '#9E5252',
  painLight:     '#F5EDED',

  // Action: medication (forest green)
  med:           '#2E7D5E',
  medLight:      '#E6F3ED',

  // Accent
  mint:          '#8BCFAA',

  // UI chrome (tab bar active, focus rings)
  brand:         '#2E7D5E',

  // Dividers / separators
  divider:       '#C8D9D3',

  // Toast
  toastBg:       '#1C2523',
  toastText:     '#F4FAF6',
} as const;

// Pain scale badge colors (0–10).
// Index = pain level. Used by the pain selector and history badges.
export const PainScale = [
  { bg: '#E8E8E4', text: '#6B7C73' }, // 0
  { bg: '#EDE5C4', text: '#7A6A30' }, // 1
  { bg: '#EDD898', text: '#7A5A18' }, // 2
  { bg: '#E8C46C', text: '#7A4A10' }, // 3
  { bg: '#E0A83C', text: '#ffffff' }, // 4
  { bg: '#D08830', text: '#ffffff' }, // 5
  { bg: '#C07040', text: '#ffffff' }, // 6
  { bg: '#B85848', text: '#ffffff' }, // 7
  { bg: '#AE4E4E', text: '#ffffff' }, // 8
  { bg: '#A44848', text: '#ffffff' }, // 9
  { bg: '#9E5252', text: '#ffffff' }, // 10
] as const;

export const FontFamily = {
  serif: 'Fraunces',
  sans:  'InstrumentSans',
} as const;

export const FontSize = {
  greeting:       34,
  sectionHeading: 26,
  bodyLarge:      17,
  body:           16,
  bodySmall:      15,
  label:          12,
  tabLabel:       11,
} as const;

export const FontWeight = {
  regular: '400',
  medium:  '500',
  semibold:'600',
  bold:    '700',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  card:   20,
  button: 28,
  chip:   12,
  badge:  10,
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
    shadowOpacity: 0.13,
    shadowRadius:  16,
    elevation:     4,   // Android
  },
} as const;
