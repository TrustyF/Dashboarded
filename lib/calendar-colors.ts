// Google Calendar's fixed event color palette, keyed by the `colorId`
// events.list returns for a per-event color override (see
// app/api/calendar/route.ts). Approximated by hand rather than fetched live
// from the Colors API - the palette is effectively static, so hardcoding it
// avoids an extra network dependency.
export const EVENT_COLORS: Record<string, string> = {
  "1": "#5266cc",
  "2": "#33B679",
  "3": "#9544ab",
  "4": "#e65245",
  "5": "#F6BF26",
  "6": "#F4511E",
  "7": "#039BE5",
  "8": "#616161",
  "9": "#3F51B5",
  "10": "#0B8043",
  "11": "#d62b2b",
};
