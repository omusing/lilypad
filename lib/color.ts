// Darkens a hex color by the given amount (0–1). Used for rate chip selection borders.
export function darken(hex: string, amount = 0.2): string {
  const h = hex.replace('#', '');
  const num = parseInt(h.length === 3
    ? h.split('').map(c => c + c).join('')
    : h, 16);
  const r = Math.max(0, ((num >> 16) & 0xff) * (1 - amount));
  const g = Math.max(0, ((num >> 8) & 0xff) * (1 - amount));
  const b = Math.max(0, (num & 0xff) * (1 - amount));
  return `#${[r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
