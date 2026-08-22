"use client";

import { useEffect, useRef } from "react";
import styles from "./page.module.sass";

type Props = {
  progressMs: number;
  durationMs: number;
  trackId: string;
  notches: number[];
};

// How long the fill visibly travels backward when a new track starts,
// before the normal forward glide (toward 100%, timed to the new track's
// end) picks up.
const TRACK_CHANGE_WIPE_MS = 700;

// CSS-driven smoothing instead of a React-state/rAF loop re-rendering every
// frame: each time a poll lands (this effect re-runs on progressMs/trackId
// changing - see lib/hooks.ts's useSpotifyNowPlaying), the fill is snapped
// instantly to the real known position (transition disabled for that one
// frame), then a single linear transition toward 100% is kicked off, timed
// to land exactly at the track's end. The browser's own compositor animates
// that continuously between polls - no JS ticking needed - and the next
// poll simply re-snaps/re-aims it, correcting for whatever drifted (network
// latency, clock skew, a seek/skip) instead of the bar visibly holding
// still until then.
//
// The one case that's NOT an instant snap: when the track itself changes,
// the fill visibly wipes backward from wherever it was to the new track's
// start position instead of teleporting there.
export default function ProgressBar({ progressMs, durationMs, trackId, notches }: Props) {
  const fillRef = useRef<HTMLDivElement>(null);
  const prevTrackId = useRef<string | null>(null);

  useEffect(() => {
    const el = fillRef.current;
    if (!el) return;

    const startPct = Math.min((progressMs / durationMs) * 100, 100);
    const remainingMs = Math.max(durationMs - progressMs, 0);
    const isNewTrack = prevTrackId.current !== null && prevTrackId.current !== trackId;
    prevTrackId.current = trackId;

    if (isNewTrack) {
      el.style.transition = `width ${TRACK_CHANGE_WIPE_MS}ms ease-in-out`;
      el.style.width = `${startPct}%`;

      const timer = setTimeout(() => {
        el.style.transition = `width ${remainingMs}ms linear`;
        el.style.width = "100%";
      }, TRACK_CHANGE_WIPE_MS);
      return () => clearTimeout(timer);
    }

    el.style.transition = "none";
    el.style.width = `${startPct}%`;
    void el.offsetWidth; // flush the transition:none before re-enabling it below
    el.style.transition = `width ${remainingMs}ms linear`;
    el.style.width = "100%";
  }, [trackId, progressMs, durationMs]);

  return (
    <div className={styles.progBar}>
      <div className={styles.bgProg} />
      <div ref={fillRef} className={styles.fgProg} />
      {notches.map((pct, i) => (
        <div key={i} className={styles.notch} style={{ left: `${pct}%` }} />
      ))}
    </div>
  );
}
