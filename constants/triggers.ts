export const TRIGGERS = [
  { key: 'poor_sleep',   label: 'Poor sleep' },
  { key: 'stress',       label: 'Stress' },
  { key: 'activity',     label: 'Physical activity' },
  { key: 'inactivity',   label: 'Too much sitting/lying' },
  { key: 'weather',      label: 'Weather change' },
  { key: 'food',         label: 'Food or drink' },
  { key: 'posture',      label: 'Posture' },
  { key: 'travel',       label: 'Travel' },
  { key: 'work',         label: 'Work / screen time' },
  { key: 'emotion',      label: 'Emotional stress' },
  { key: 'medication',   label: 'Missed medication' },
  { key: 'unknown',      label: 'Not sure' },
] as const;

export type TriggerKey = typeof TRIGGERS[number]['key'];
