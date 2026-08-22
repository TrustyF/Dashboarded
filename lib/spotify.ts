import { readFile, writeFile } from "node:fs/promises";

// Ported from dashboard_server/flask_blueprints/spotify_bp.py (via the old
// app/api/spotify/token/route.ts, now folded in here). spotipy has no direct
// Node equivalent, but this only ever did an OAuth token refresh-and-cache
// dance, which is a handful of plain fetch calls.
//
// Server-only: the access token used to be handed straight to the browser
// (the old token route's whole job), which meant it - and every other
// integration in this app proxies its upstream credentials through a server
// route instead. now-playing/route.ts is the only caller of this module.

const CACHE_PATH = process.env.SPOTIFY_TOKEN_CACHE_PATH ?? "/data/tokens/.spotify_cache";
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? "";

// expires_at is epoch-ms (Date.now()) - the old route stored Unix seconds
// (Date.now() / 1000) instead. A cache file written under the old format
// reads back as already-expired here (a huge stale ms value looks past-due
// against Date.now()), which just triggers one harmless immediate refresh
// that rewrites it in the new format - no migration step needed.
type CachedToken = { access_token: string; refresh_token: string; expires_at: number };

async function readCache(): Promise<CachedToken> {
  let raw: string;
  try {
    raw = await readFile(CACHE_PATH, "utf-8");
  } catch (err) {
    throw new Error(`Spotify token cache unreadable at ${CACHE_PATH}: ${err instanceof Error ? err.message : err}`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Spotify token cache at ${CACHE_PATH} is not valid JSON`);
  }
}

async function writeCache(token: CachedToken) {
  await writeFile(CACHE_PATH, JSON.stringify(token));
}

export async function getSpotifyAccessToken(): Promise<string> {
  let cached = await readCache();

  if (!cached || Date.now() >= cached.expires_at) {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cached.refresh_token,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      // Most common real-world cause: SPOTIFY_CLIENT_ID/SECRET missing or
      // wrong in the deployed env, or the cached refresh_token was revoked.
      throw new Error(`Spotify token refresh failed (${res.status}): ${await res.text()}`);
    }

    const refreshed = await res.json();

    cached = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? cached.refresh_token,
      expires_at: Date.now() + refreshed.expires_in * 1000,
    };
    await writeCache(cached);
  }

  return cached.access_token;
}

export type SpotifyTrack = {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { images: { url: string }[] };
};

export type NowPlaying = {
  track: SpotifyTrack | null;
  progressMs: number;
  // Set only when the fetch itself succeeded but something about the
  // response was off (e.g. an authenticated-but-empty edge case) - actual
  // fetch/auth failures are thrown instead, see now-playing/route.ts.
  error?: string;
};

export async function fetchSpotifyNowPlaying(): Promise<NowPlaying> {
  const accessToken = await getSpotifyAccessToken();

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 404 shows up instead of 204 on some accounts with no active device -
  // both mean the same thing here: nothing playing.
  if (res.status === 204 || res.status === 404) {
    return { track: null, progressMs: 0 };
  }

  if (!res.ok) {
    // Most common real-world cause: the access token was rejected (401 -
    // e.g. missing/wrong scopes on the credentials the token was issued
    // for) or Spotify itself is rate-limiting/down (429/5xx).
    throw new Error(`Spotify now-playing request failed (${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  if (!data?.item) {
    return { track: null, progressMs: 0 };
  }

  return { track: data.item, progressMs: data.progress_ms ?? 0 };
}
