import { preload } from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Warms the data + JS the other kiosk pages need, once the app has settled
// after boot (called once from components/AppPrefetch.tsx, mounted at the
// layout root) - so navigating there via Nav's swipe/tap lands on
// already-cached SWR data and an already-downloaded chart chunk instead of
// a "Loading…" flash and a blocking chunk fetch+parse.
//
// Deliberately narrow: the kiosk always boots to Home ("/"), and Weather/
// Sensors/System all share useSensorHistory() with Home (same key,
// `/api/sensors`), and Weather shares useWeather() too - see lib/hooks.ts.
// SWR's cache is global, so those are already warm by the time Home mounts;
// preloading them again here would just be a duplicate request. Only what
// Home's own hooks don't already cover is listed below.
export function prefetchOtherViews() {
  preload("/api/fitbit?time_delta=29", fetcher); // Health page's default range - Home's useFitbit() uses a different one (300)
  preload("/api/sensors/current", fetcher); // Sensors page
  preload("/api/vitals", fetcher); // System page
  preload("/api/settings/toggle-brightness?toggle=state", fetcher); // Settings page
  preload("/api/spotify/now-playing", fetcher); // Spotify page

  // Sparkline (in StatCard) is already loaded - Home renders it directly.
  // These three are the chart chunks Home never touches otherwise.
  import("@/components/charts/DailyTempChart");
  import("@/components/charts/SensorHistoryChart");
  import("@/components/charts/WeightChart");
}
