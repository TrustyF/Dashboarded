import { hslToHex } from "@/lib/color";

// Stat-card/sparkline accent colors, previously hand-picked hex literals
// duplicated across app/page.tsx, app/health/page.tsx and app/weather/page.tsx
// (e.g. "#f2cc8f" appeared in two files, "#5b9bd5"/"#f2c94c"/"#3fb8af"/"#c38869"
// in all three) with saturation/lightness ranging 24-86% / 47-75% - same
// inconsistency as the calendar palette, see lib/calendar-colors.ts. Only the
// hue of each is kept below; saturation/lightness are shared constants so
// overall intensity is one number to tune instead of eight hand-picked values.
const STAT_SATURATION = 0.9;
const STAT_LIGHTNESS = 0.6;

const STAT_HUES = {
  weight: 152, // was #81b29a
  bodyFat: 13, // was #e07a5f
  steps: 37, // was #f2cc8f
  stepsRing: 82, // was #8bbf30
  temperature: 209, // was #5b9bd5
  uvIndex: 45, // was #f2c94c
  precipitation: 176, // was #3fb8af
  indoor: 21, // was #c38869
} as const;

export const STAT_COLORS: Record<keyof typeof STAT_HUES, string> = Object.fromEntries(
  Object.entries(STAT_HUES).map(([name, hue]) => [name, hslToHex(hue, STAT_SATURATION, STAT_LIGHTNESS)]),
) as Record<keyof typeof STAT_HUES, string>;
