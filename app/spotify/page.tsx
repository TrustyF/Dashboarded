"use client";

import { useSpotifyNowPlaying } from "@/lib/hooks";
import ProgressBar from "./ProgressBar";
import { useDeferredImageUrl } from "./useDeferredImageUrl";
import { useCrossfadeLayers } from "./useCrossfadeLayers";
import styles from "./page.module.sass";

// Visual port of SpotifyView.vue. The original used the Spotify Web Playback
// SDK's *name* but not its actual playback features - it only ever polled
// "currently playing" and displayed it (see lib/useSpotifyNowPlaying.ts), so
// this is a straight port, not a stub. Note `get_time()` in the original
// showed the track's total duration, not time remaining - kept as-is here.

// Flip to true locally to see the poll-schedule tick marks on the progress
// bar (see lib/hooks.ts's useSpotifyNowPlaying notches) - a debugging aid,
// not something the deployed kiosk should ever show, so it's a manual
// switch rather than tied to NODE_ENV.
const SHOW_POLL_NOTCHES = false;

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SpotifyPage() {
  const { track, progressMs, error, notches } = useSpotifyNowPlaying();

  const rawArtUrl = track?.album.images[1]?.url ?? track?.album.images[0]?.url;
  // Only fires the crossfade once the new art has actually finished loading
  // (useDeferredImageUrl), then keeps the previous one visible underneath
  // while it fades in instead of swapping straight to it (useCrossfadeLayers).
  const loadedArtUrl = useDeferredImageUrl(rawArtUrl);
  const artLayers = useCrossfadeLayers(loadedArtUrl);

  return (
    <div className={styles.wrapper}>
      <div className={styles.background}>
        {artLayers.map((layer, i) => (
          <div key={layer.key} className={styles.bgImg} style={{ backgroundImage: `url(${layer.url})`, zIndex: i }} />
        ))}
        <div className={styles.backgroundScrim} />
      </div>

      <div className={styles.playerCont}>
        {track ? (
          <div className={styles.track}>
            <div className={styles.poster}>
              {artLayers.map((layer, i) => (
                <img key={layer.key} src={layer.url} alt="" style={{ zIndex: i }} />
              ))}
            </div>

            <div className={styles.header}>
              <div className={styles.title}>
                <h1>{track.name}</h1>
                <h2>{track.artists[0]?.name}</h2>
              </div>

              <div className={styles.headerProg}>
                <div className={styles.times}>
                  <h1>{formatDuration(track.duration_ms)}</h1>
                </div>

                <ProgressBar
                  progressMs={progressMs}
                  durationMs={track.duration_ms}
                  trackId={track.id}
                  notches={SHOW_POLL_NOTCHES ? notches : []}
                />
              </div>
            </div>
          </div>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : (
          <p className={styles.idle}>Nothing playing</p>
        )}
      </div>
    </div>
  );
}
