import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Entry<T> = { data: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const isDev = process.env.NODE_ENV === "development";

// Dev-only: persist the cache to disk so it survives `next dev` restarts and
// Turbopack's module reloads (which would otherwise reset the in-memory Map
// on every file save) - the whole point is to stop hammering rate-limited
// upstream APIs (Google Calendar/Health, Open-Meteo) while iterating.
// data/ is already gitignored (see .env.local's *_TOKEN_PATH comments).
const CACHE_FILE = path.join(process.cwd(), "data", "api-cache.json");

let loadFromDisk: Promise<void> | null = null;

async function loadOnce() {
  try {
    const raw = await readFile(CACHE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, Entry<unknown>>;
    const now = Date.now();
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry.expiresAt > now) store.set(key, entry);
    }
  } catch {
    // No cache file yet (first run) or it's unreadable - start empty.
  }
}

async function persist() {
  try {
    await mkdir(path.dirname(CACHE_FILE), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(store)));
  } catch (err) {
    console.error("[api-cache] failed to persist cache to disk:", err);
  }
}

// Hand-rolled TTL cache for upstream API calls (weather/calendar/fitbit
// routes), used instead of Next's fetch Data Cache (`next: { revalidate }`)
// so every route behaves the same way regardless of HTTP method - Next's
// cache silently ignores POST requests, which cost us an hour of caching on
// the fitbit steps endpoint before this existed - and so dev builds can log
// whether each upstream call was served from cache or actually hit the
// network.
export async function cachedFetch<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  if (isDev) {
    loadFromDisk ??= loadOnce();
    await loadFromDisk;
  }

  const cached = store.get(key) as Entry<T> | undefined;
  const now = Date.now();

  if (cached && now < cached.expiresAt) {
    if (isDev) console.log(`[api-cache] HIT   ${key}`);
    return cached.data;
  }

  const start = now;
  const data = await fetcher();
  if (isDev) console.log(`[api-cache] MISS  ${key} (${Date.now() - start}ms)`);

  store.set(key, { data, expiresAt: now + ttlSeconds * 1000 });
  if (isDev) await persist();
  return data;
}
