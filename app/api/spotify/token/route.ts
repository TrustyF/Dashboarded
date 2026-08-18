import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";

// Ported from dashboard_server/flask_blueprints/spotify_bp.py. spotipy has no
// direct Node equivalent, but this route only ever did an OAuth token
// refresh-and-cache dance, which is a handful of plain fetch calls.

const CACHE_PATH = process.env.SPOTIFY_TOKEN_CACHE_PATH ?? "/data/tokens/.spotify_cache";
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET ?? "";

type CachedToken = { access_token: string; refresh_token: string; expires_at: number };

async function readCache(): Promise<CachedToken> {
  return JSON.parse(await readFile(CACHE_PATH, "utf-8"));
}

async function writeCache(token: CachedToken) {
  await writeFile(CACHE_PATH, JSON.stringify(token));
}

export async function GET() {
  let cached = await readCache();

  if (!cached || Date.now() / 1000 >= cached.expires_at) {
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
    const refreshed = await res.json();

    cached = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? cached.refresh_token,
      expires_at: Date.now() / 1000 + refreshed.expires_in,
    };
    await writeCache(cached);
  }

  return NextResponse.json({ access_token: cached.access_token });
}
