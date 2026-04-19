export const TRIGGERS = [
  { key: 'emotion',      label: 'Emotional stress' },
  { key: 'food',         label: 'Food or drink' },
  { key: 'medication',   label: 'Missed medication' },
  { key: 'unknown',      label: 'Not sure' },
  { key: 'activity',     label: 'Physical activity' },
  { key: 'poor_sleep',   label: 'Poor sleep' },
  { key: 'posture',      label: 'Posture' },
  { key: 'stress',       label: 'Stress' },
  { key: 'inactivity',   label: 'Too much sitting/lying' },
  { key: 'travel',       label: 'Travel' },
  { key: 'weather',      label: 'Weather change' },
  { key: 'work',         label: 'Work / screen time' },
] as const;

export type TriggerKey = typeof TRIGGERS[number]['key'];
