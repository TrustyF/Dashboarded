"use client";

import { useSpotifyNowPlaying } from "@/lib/useSpotifyNowPlaying";
import styles from "./page.module.sass";

// Visual port of SpotifyView.vue. The original used the Spotify Web Playback
// SDK's *name* but not its actual playback features - it only ever polled
// "currently playing" and displayed it (see lib/useSpotifyNowPlaying.ts), so
// this is a straight port, not a stub. Note `get_time()` in the original
// showed the track's total duration, not time remaining - kept as-is here.

function formatDuration(ms: number) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function SpotifyPage() {
  const { track, progressMs } = useSpotifyNowPlaying();

  const artUrl = track?.album.images[1]?.url ?? track?.album.images[0]?.url;
  const progress = track ? Math.round((progressMs / track.duration_ms) * 100) : 0;

  return (
    <div className={styles.wrapper}>
      <div className={styles.background}>
        {artUrl && (
          <div className={styles.bgImg} key={`${track!.id}+bg`} style={{ backgroundImage: `url(${artUrl})` }} />
        )}
      </div>

      <div className={styles.playerCont}>
        {track ? (
          <div className={styles.track}>
            <div className={styles.poster}>{artUrl && <img key={`${track.id}+poster`} src={artUrl} alt="" />}</div>

            <div className={styles.header}>
              <div className={styles.title}>
                <h1>{track.name}</h1>
                <h2>{track.artists[0]?.name}</h2>
              </div>

              <div className={styles.headerProg}>
                <div className={styles.times}>
                  <h1>{formatDuration(track.duration_ms)}</h1>
                </div>

                <div className={styles.progBar}>
                  <div className={styles.bgProg} />
                  <div className={styles.fgProg} style={{ width: `${progress}%` }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.idle}>Nothing playing</p>
        )}
      </div>
    </div>
  );
}
