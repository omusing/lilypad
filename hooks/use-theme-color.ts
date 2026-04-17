// V1 is light mode only — this hook is a no-op stub kept for template compatibility.
// Remove when template files are replaced in app reset (step 5).
export function useThemeColor(
  _props: { light?: string; dark?: string },
  _colorName: string
): string {
  return '';
}
