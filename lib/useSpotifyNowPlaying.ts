"use client";

import { useEffect, useRef, useState } from "react";

// Port of spotify_store.js. The original never used the Spotify Web Playback
// SDK for actual audio streaming - it just polled the "currently playing"
// endpoint directly from the browser (using the token from /api/spotify/token)
// and displayed it. The polling interval adapts to roughly 1/20th of the
// remaining track time (capped at 240s) instead of a fixed interval, so the
// progress bar update rate is proportional to track length.

type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { images: { url: string }[] };
};

type NowPlaying = {
  track: SpotifyTrack | null;
  progressMs: number;
};

const MIN_INTERVAL_S = 5;
const MAX_INTERVAL_S = 240;

export function useSpotifyNowPlaying(): NowPlaying {
  const [state, setState] = useState<NowPlaying>({ track: null, progressMs: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previousTrackId = useRef<string | null>(null);
  const progressAtTrackStart = useRef(0);
  const intervalS = useRef(10);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const tokenRes = await fetch("/api/spotify/token");
        const { access_token } = await tokenRes.json();

        if (access_token) {
          const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
            headers: { Authorization: `Bearer ${access_token}` },
          });

          if (res.status === 204) {
            intervalS.current = Math.min(intervalS.current * 4, MAX_INTERVAL_S);
            if (!cancelled) setState({ track: null, progressMs: 0 });
          } else if (res.ok) {
            const data = await res.json();
            if (data?.item) {
              if (previousTrackId.current !== data.item.id) {
                previousTrackId.current = data.item.id;
                progressAtTrackStart.current = data.progress_ms;
              }
              intervalS.current = Math.max(
                MIN_INTERVAL_S,
                (data.item.duration_ms - progressAtTrackStart.current) / 20 / 1000 - 0.1
              );
              if (!cancelled) setState({ track: data.item, progressMs: data.progress_ms });
            }
          }
        }
      } catch {
        // network hiccup - just try again on the next tick
      }

      if (!cancelled) timeoutRef.current = setTimeout(tick, intervalS.current * 1000);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return state;
}
