export const QUALITIES = [
  { key: 'aching',     label: 'Aching' },
  { key: 'burning',    label: 'Burning' },
  { key: 'stabbing',   label: 'Stabbing' },
  { key: 'throbbing',  label: 'Throbbing' },
  { key: 'shooting',   label: 'Shooting' },
  { key: 'sharp',      label: 'Sharp' },
  { key: 'dull',       label: 'Dull' },
  { key: 'pressure',   label: 'Pressure' },
  { key: 'tingling',   label: 'Tingling' },
  { key: 'numbness',   label: 'Numbness' },
] as const;

export type QualityKey = typeof QUALITIES[number]['key'];
