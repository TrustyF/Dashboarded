import { hslToHex } from "@/lib/color";

// Google Calendar's fixed event color palette, keyed by the `colorId`
// events.list returns for a per-event color override (see
// app/api/calendar/route.ts). Approximated by hand rather than fetched live
// from the Colors API - the palette is effectively static, so hardcoding it
// avoids an extra network dependency.
//
// Google's real values span wildly different saturation/lightness per color
// (e.g. Peacock #039BE5 at 97% saturation next to Grape #9544ab at 43%),
// which reads as inconsistent when used as flat dots/accents here. Only the
// hue of each is kept below; saturation/lightness are shared constants so
// overall intensity is one number to tune instead of eleven hand-picked hex
// values.
const EVENT_SATURATION = 0.90;
const EVENT_LIGHTNESS = 0.5;

// Hue (0-360) per colorId, in Google's naming order.
const EVENT_HUES: Record<string, number> = {
  "1": 230, // Lavender
  "2": 152, // Sage
  "3": 287, // Grape
  "4": 5, // Flamingo
  "5": 44, // Banana
  "6": 14, // Tangerine
  "7": 200, // Peacock
  "9": 231, // Blueberry
  "10": 149, // Basil
  "11": 0, // Tomato
};

export const EVENT_COLORS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(EVENT_HUES).map(([id, hue]) => [id, hslToHex(hue, EVENT_SATURATION, EVENT_LIGHTNESS)]),
  ),
  // Graphite: a true neutral gray, not a hue - excluded from EVENT_HUES so
  // EVENT_SATURATION doesn't invent a tint for it.
  "8": "#616161",
};
