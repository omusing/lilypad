export const REGIONS = [
  { key: 'head',        label: 'Head' },
  { key: 'neck',        label: 'Neck' },
  { key: 'shoulders',   label: 'Shoulders' },
  { key: 'upper_back',  label: 'Upper back' },
  { key: 'lower_back',  label: 'Lower back' },
  { key: 'hips',        label: 'Hips' },
  { key: 'abdomen',     label: 'Abdomen' },
  { key: 'arms',        label: 'Arms' },
  { key: 'hands',       label: 'Hands' },
  { key: 'legs',        label: 'Legs' },
  { key: 'knees',       label: 'Knees / feet' },
] as const;

export type RegionKey = typeof REGIONS[number]['key'];
