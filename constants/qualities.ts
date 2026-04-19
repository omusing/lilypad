export const QUALITIES = [
  { key: 'aching',     label: 'Aching' },
  { key: 'burning',    label: 'Burning' },
  { key: 'dull',       label: 'Dull' },
  { key: 'numbness',   label: 'Numbness' },
  { key: 'pressure',   label: 'Pressure' },
  { key: 'sharp',      label: 'Sharp' },
  { key: 'shooting',   label: 'Shooting' },
  { key: 'stabbing',   label: 'Stabbing' },
  { key: 'throbbing',  label: 'Throbbing' },
  { key: 'tingling',   label: 'Tingling' },
] as const;

export type QualityKey = typeof QUALITIES[number]['key'];
