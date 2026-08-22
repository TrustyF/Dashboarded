import { NextResponse } from "next/server";
import { cachedFetch } from "@/lib/api-cache";
import { fetchSpotifyNowPlaying } from "@/lib/spotify";

// 3s TTL - deliberately shorter than the client hook's own 5s floor
// interval (see lib/hooks.ts's useSpotifyNowPlaying), so a single tab's own
// polling never reads back a stale entry it just populated a tick ago. Its
// only job is collapsing a burst of near-simultaneous requests (multiple
// tabs, or a revalidation racing a scheduled poll) into one upstream
// Spotify call - not stretching freshness, unlike weather/calendar/fitbit's
// much longer TTLs. This also makes token refresh-at-expiry safe from a
// thundering herd for free: only one fetchSpotifyNowPlaying() (and so one
// getSpotifyAccessToken()) runs per 3s window process-wide, so lib/spotify.ts
// itself needs no locking of its own.
const REVALIDATE_SECONDS = 3;

export async function GET() {
  try {
    const data = await cachedFetch("spotify:now-playing", REVALIDATE_SECONDS, fetchSpotifyNowPlaying);
    return NextResponse.json(data);
  } catch (err) {
    // Upstream/refresh failure (missing/invalid credentials, cache file
    // missing, Spotify 401/429/5xx, network hiccup) - still returns a
    // well-formed NowPlaying shape (so the SWR hook/page never crash on an
    // unexpected response), but surfaces `error` instead of silently
    // reporting "nothing playing", which was masking real deploy issues
    // (bad env vars, stale token cache) as an empty player.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[spotify] now-playing failed:", message);
    return NextResponse.json({ track: null, progressMs: 0, error: message });
  }
}
