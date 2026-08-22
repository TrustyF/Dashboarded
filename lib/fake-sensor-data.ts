// Only reached when SENSOR_DATA_PATH's read fails outside production - a dev
// machine has no DHT22/sensor_poller attached, so the real file never
// exists there. Prod behavior is untouched: a successful file read always
// wins, in prod or dev, and prod's own failure fallback (empty/null) is
// unchanged - this only fills the gap so the sensor UI (and its moving-
// average smoothing) has something to render locally.
//
// Mirrors sensor_poller/poll.py's real shape: HISTORY_LENGTH readings,
// POLL_INTERVAL_SECONDS apart.
const HISTORY_LENGTH = 100;
const POLL_INTERVAL_SECONDS = 10;

export function fakeSensorHistory(): { temp: (number | null)[]; humidity: (number | null)[]; time: string[] } {
  const now = Date.now();
  const temp: (number | null)[] = [];
  const humidity: (number | null)[] = [];
  const time: string[] = [];

  for (let i = 0; i < HISTORY_LENGTH; i++) {
    time.push(new Date(now - (HISTORY_LENGTH - 1 - i) * POLL_INTERVAL_SECONDS * 1000).toISOString());
    // A slow sine drift (one full cycle across the whole window) plus
    // per-reading jitter, with an occasional dropped reading - close enough
    // to real DHT22 noise/flakiness to make the smoothing visibly do
    // something, and to exercise the null-gap handling.
    const drift = Math.sin((i / HISTORY_LENGTH) * Math.PI * 2);
    const dropped = Math.random() < 0.05;
    temp.push(dropped ? null : Math.round((22 + drift * 1.5 + (Math.random() - 0.5) * 1.2) * 10) / 10);
    humidity.push(dropped ? null : Math.round((48 + drift * 4 + (Math.random() - 0.5) * 3) * 10) / 10);
  }

  return { temp, humidity, time };
}
