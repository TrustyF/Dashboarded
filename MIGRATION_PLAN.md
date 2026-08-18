# Dashboard migration plan: Vue+Vite / Flask → Next.js + Docker

Target hardware: Raspberry Pi 4/5, 4-8GB RAM. Goal: one deployable unit instead of a
separate SPA + Flask API, and a Docker-based deploy instead of manual setup.

## 1. Target architecture

```
dashboard_next/                  # Next.js 15, App Router, TypeScript
  app/
    layout.tsx
    page.tsx                     # Home
    weather/page.tsx
    spotify/page.tsx
    health/page.tsx
    sensors/page.tsx
    api/
      weather/route.ts
      calendar/route.ts
      fitbit/route.ts
      spotify/token/route.ts
      sensors/route.ts
      sensors/current/route.ts
      vitals/route.ts
      settings/toggle-brightness/route.ts
  lib/
  Dockerfile
  docker-compose.yml
  .env.example

sensor_poller/                   # tiny standalone Python process (GPIO only)
  poll.py
  requirements.txt
```

One Node process serves both the UI and the API (Next.js Route Handlers replace the
Flask blueprints). A second, much smaller Python process stays alive only because DHT22
sensor reads need Raspberry Pi GPIO libraries that have no Node equivalent. Everything
else that was Python (weather, calendar, fitbit, spotify, vitals, settings) moves into
Next.js.

## 2. Route mapping

| Flask blueprint | Route | Next.js route handler | Notes |
|---|---|---|---|
| `weather_bp` | `/weather/get` | `app/api/weather/route.ts` | Open-Meteo fetch, no secrets. Use Next's `fetch(..., { next: { revalidate: 1800 } })` instead of `flask_caching` — same 30 min cache semantics, built in. |
| `calendar_bp` | `/calendar/get` | `app/api/calendar/route.ts` | Google Calendar OAuth. **Hardcoded client_id/secret in `calendar_bp.py` move to env vars** (see §5). |
| `fitbit_bp` | `/fitbit/get` | `app/api/fitbit/route.ts` | Token refresh logic ports 1:1. Token file → env-configured path on a volume. |
| `spotify_bp` | `/spotify/get_token` | `app/api/spotify/token/route.ts` | `spotipy` has no Node equivalent, but the route only proxies OAuth token exchange — plain `fetch` calls to Spotify's token endpoint replace it. |
| `sensors_bp` | `/sensors/get`, `/sensors/get_current` | `app/api/sensors/route.ts` | Reads latest reading from a JSON file written by `sensor_poller/poll.py` (see §4) instead of calling `adafruit_dht` in-process. |
| `vitals_bp` | `/vitals/get` | `app/api/vitals/route.ts` | `fs.readFileSync('/sys/class/thermal/thermal_zone0/temp')` and `child_process.execFile('vcgencmd', ...)` — both trivial in Node, no Python needed. |
| `settings_bp` (brightness) | `/settings/toggle_brightness` | `app/api/settings/toggle-brightness/route.ts` | `child_process.execFile('brightnessctl', ...)` — trivial in Node. |
| `notification_bp` | *(currently unregistered/dormant in app.py)* | Skipped for now | The Kick.com live-check + SQLite notification model isn't wired into `app.py` today. Revive later with `better-sqlite3` if you want it back; not part of this pass. |

## 3. Frontend mapping (Vue → React)

Pinia stores → simple hooks (`useSWR` or a small custom fetch-and-poll hook); the fetch
intervals in the existing stores (weather 60s local poll but 30 min server cache,
calendar 60 min, etc.) carry over as `useSWR(url, fetcher, { refreshInterval })`.

Vue Router → Next.js App Router file-based routes (`app/weather/page.tsx` etc.),
already reflected in the tree above — `page_index` transition logic can be reimplemented
with a small client-side layout wrapper using `usePathname()`.

**Scope note:** this pass ports the *entire backend* (all API routes) and scaffolds the
app shell + one fully working page (Home) end-to-end, proving the pattern. The other
views (Weather, Spotify, Health, Sensors) and ~25 custom Vue components (clock,
backgrounds, chart wrappers, nav overlay, etc.) are cosmetic/animation-heavy and are
intentionally left for you to port incrementally, component by component, against the
now-working API layer — auto-porting dozens of hand-tuned CSS animations without visual
review risks silently breaking the look you built. Chart.js usage carries over almost
unchanged via `react-chartjs-2`, since the underlying `chart.js` config objects don't
need to change.

## 4. Hardware access strategy

- **DHT22 (GPIO)**: kept as a standalone Python script (`sensor_poller/poll.py`), no
  Flask, no HTTP server — it just loops, reads the sensor, and writes
  `{ temp, humidity, time }` to a JSON file on a shared Docker volume every ~2s. The
  Next.js `sensors` route reads that file. This is *smaller* than what you have today
  (no web framework needed for a background loop) and removes GPIO access from the
  container that's rebuilt/redeployed most often.
- **CPU temp / voltage**: native to Node (`fs` + `vcgencmd` via `child_process`), no
  Python needed. Container needs `/sys/class/thermal` mounted read-only and
  `/opt/vc/bin/vcgencmd` (or equivalent) plus `/dev/vchiq` available — see Dockerfile/
  compose notes in §6.
- **Screen brightness**: same pattern, `brightnessctl` via `child_process`, needs
  `/sys/class/backlight` accessible in the container.

## 5. Secrets cleanup (do this regardless of framework)

`calendar_bp.py` currently has a **literal Google OAuth client_id and client_secret
hardcoded in source** (not read from `.env` like the Fitbit/Spotify ones), and
`fitbit_bp.py`'s `make_token()` has a hardcoded one-time auth `code`. Both should move
to environment variables before this code goes into a Docker image or a public repo:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — replaces the hardcoded values in
  `calendar_bp.py`.
- Existing `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, `SPOTIFY_CLIENT_ID`,
  `SPOTIFY_CLIENT_SECRET` carry over unchanged.
- Token files (`google_refresh_token.json`, `fitbit_token.json`, `.spotify_cache`) and
  `creds/` stay out of the Docker image entirely — mounted as a volume at runtime, never
  `COPY`'d in the Dockerfile, and already covered by `.gitignore`.

## 6. Docker

- **Dockerfile**: multi-stage — `deps` (npm ci) → `build` (`next build`, uses
  `output: 'standalone'` so the final image only needs the pruned server bundle, not
  the full `node_modules`) → `runtime` (`node:22-bookworm-slim`, which has arm64
  images — avoid `alpine` on the Pi; musl has caused native-module friction with some
  Next.js/sharp builds on arm64, bookworm-slim avoids that whole class of problem).
- **docker-compose.yml**: two services —
  - `app` (Next.js), env_file for secrets, volumes for token files + the shared sensor
    JSON, `/sys/class/thermal` and `/sys/class/backlight` bind-mounted read-only,
    `restart: unless-stopped`.
  - `sensor-poller` (Python), needs `privileged: true` or specific `/dev/gpiomem`
    device access for GPIO, writes to the same shared volume the `app` service reads.
- **Build strategy**: build the image with `docker buildx build --platform linux/arm64`
  from your dev machine (or CI) rather than building on the Pi itself — this is the
  actual fix for "poorly deployed with a lot of manual setup": `docker compose pull &&
  docker compose up -d` on the Pi becomes the entire deploy step. Building on-device
  works too but is slower and briefly spikes RAM/CPU during `next build`.

## 7. Rollout order (lowest risk first)

1. Stand up the Next.js API routes; verify each against curl/Postman while the existing
   Vue frontend keeps running unchanged (point nothing at it yet — just prove parity).
2. Point the *existing* Vue app's `VITE_API_BASE` at the new Next.js API instead of
   Flask, keep using the Vue frontend for a few days to validate the backend swap in
   isolation.
3. Once the API is trusted, port views into `dashboard_next` one at a time, starting
   with Home (done in this pass), in whatever order matches how often you look at each
   screen.
4. Retire `dashboard_client` / `dashboard_server` once `dashboard_next` covers
   everything you use day to day.
5. Switch the Pi's systemd unit (or whatever starts the app on boot) to
   `docker compose up -d`; delete the manual venv/npm-run setup.
