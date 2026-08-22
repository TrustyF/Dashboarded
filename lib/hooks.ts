"use client";

import { useRef, useState } from "react";
import useSWR from "swr";
import type { NowPlaying } from "@/lib/spotify";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Mirrors the refresh cadence of the old Pinia stores (weather_store.js polled
// every 60s client-side against a 30 min server cache; calendar_store.js
// polled every 60 min).

export function useWeather() {
  return useSWR("/api/weather", fetcher, { refreshInterval: 5 * 60_000 });
}

export function useCalendar(limit = 100) {
  return useSWR(`/api/calendar?limit=${limit}`, fetcher, { refreshInterval: 60 * 60_000 });
}

export function useSensorCurrent() {
  return useSWR("/api/sensors/current", fetcher, { refreshInterval: 10_000 });
}

export function useSensorHistory() {
  return useSWR("/api/sensors", fetcher, { refreshInterval: 10_000 });
}

export function useFitbit(timeDelta = 300) {
  return useSWR(`/api/fitbit?time_delta=${timeDelta}`, fetcher, { refreshInterval: 60 * 60_000 });
}

export function useVitals() {
  return useSWR("/api/vitals", fetcher, { refreshInterval: 10_000 });
}

export function useBrightness() {
  return useSWR("/api/settings/toggle-brightness?toggle=state", fetcher);
}

// Steady cadence while something's playing - frequent enough to notice a
// pause/skip reasonably promptly, infrequent enough not to hammer Spotify.
const SPOTIFY_BASELINE_INTERVAL_MS = 30_000;
// A track's first stretch is the most skip-prone moment (someone hits next
// almost immediately because it's not what they wanted) - poll tighter
// than the baseline for this long after a track starts so an early skip
// gets caught quickly instead of waiting up to a full baseline interval.
const SPOTIFY_START_WINDOW_MS = 30_000;
const SPOTIFY_START_INTERVAL_MS = 8_000;
// Added on top of the predicted remaining time so the "land right at the
// end" poll fires just *after* the track should actually be over, not
// slightly before it (clock skew/network latency would otherwise catch the
// still-finishing previous track instead of whatever's next).
const SPOTIFY_END_BUFFER_MS = 1_500;
// Floor so a poll scheduled right at a track boundary (remaining ~0) can't
// end up re-firing near-instantly.
const SPOTIFY_MIN_POLL_MS = 3_000;
const SPOTIFY_MAX_INTERVAL_MS = 240_000;
const SPOTIFY_IDLE_START_MS = 10_000;

// Poll scheduling while something's playing used to scale with how much of
// the track was left (remaining/20) - that made sense back when the
// progress bar's only source of motion WAS each poll's snap, so checking
// more often near the end hid how jumpy that looked. Now the bar animates
// continuously between polls on its own (see app/spotify/ProgressBar.tsx),
// so polling frequency has nothing to do with visual smoothness anymore.
// All that's actually left for polling to do is: notice a pause/skip
// (doesn't get more urgent as a track progresses in general, but IS more
// likely right after a track starts - see SPOTIFY_START_WINDOW_MS above)
// and catch the track actually changing (which wants tight timing, but
// only right at the boundary, not throughout the whole track).
// min(cadence, remaining+buffer) gets all three without over-polling the
// middle of a track for a benefit it doesn't need: early on, poll at the
// tighter start cadence; once past that window, drop to the steady
// baseline; as the end approaches, the next poll naturally lands right
// after it regardless of which cadence is currently active.
//
// (A parabola-shaped schedule - exactly N polls/track, denser at both
// ends via a quadratic weight curve - was tried here and reverted: with a
// small, practical poll count the discretization capped how much denser
// the edges could ever get almost immediately, so cranking the bias
// stopped doing anything past a fairly low ceiling. This simpler two-phase
// version doesn't have that problem.)
function nextSpotifyPollMs(elapsedMs: number, remainingMs: number): number {
  const cadence = elapsedMs < SPOTIFY_START_WINDOW_MS ? SPOTIFY_START_INTERVAL_MS : SPOTIFY_BASELINE_INTERVAL_MS;
  return Math.min(cadence, Math.max(remainingMs + SPOTIFY_END_BUFFER_MS, SPOTIFY_MIN_POLL_MS));
}

export function useSpotifyNowPlaying(): NowPlaying & { notches: number[] } {
  const idleIntervalRef = useRef(SPOTIFY_IDLE_START_MS);

  // The whole planned check schedule for the current track: baseline-spaced
  // ticks until less than one baseline interval remains, then one final
  // tick right at the end (the "catch the track change" poll) - recomputed
  // from the freshest known position each poll instead of locked in once,
  // since (unlike the old formula) there's no smoothness reason not to.
  const [notches, setNotches] = useState<number[]>([]);

  const { data } = useSWR<NowPlaying>("/api/spotify/now-playing", fetcher, {
    // Pure - just computes the next delay. setState belongs in onSuccess
    // below: SWR evaluates this more eagerly than "only on a timer", so a
    // setState call here (tried initially) causes it to re-run inside its
    // own update, i.e. a synchronous render loop ("Maximum update depth
    // exceeded") once it's no longer guarded to fire just once per track.
    refreshInterval: (latest) => {
      if (latest?.track) {
        idleIntervalRef.current = SPOTIFY_IDLE_START_MS;
        return nextSpotifyPollMs(latest.progressMs, latest.track.duration_ms - latest.progressMs);
      }
      idleIntervalRef.current = Math.min(idleIntervalRef.current * 4, SPOTIFY_MAX_INTERVAL_MS);
      return idleIntervalRef.current;
    },
    onSuccess: (latest) => {
      if (!latest?.track) {
        setNotches((prev) => (prev.length ? [] : prev));
        return;
      }
      // Simulates the same step-by-step scheduling nextSpotifyPollMs does
      // for real, rather than assuming a uniform interval, so the
      // visualization matches the actual (denser-at-the-start, baseline in
      // the middle, denser-at-the-end) cadence.
      const { duration_ms } = latest.track;
      const planned: number[] = [];
      let t = latest.progressMs;
      while (duration_ms - t > 0) {
        t += nextSpotifyPollMs(t, duration_ms - t);
        planned.push(Math.min((t / duration_ms) * 100, 100));
      }
      setNotches(planned);
    },
  });

  return { ...(data ?? { track: null, progressMs: 0 }), notches };
}
