import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";

// Ported from dashboard_server/flask_blueprints/fitbit_bp.py.
// The one-time `make_token()` bootstrap step (exchanging an authorization code
// for the first refresh token) isn't included here on purpose - that's a manual,
// one-off step you run locally once per Fitbit app registration, not something
// that belongs in a server route. Do it with a short script or curl, then drop
// the resulting token JSON at FITBIT_TOKEN_PATH.

const TOKEN_PATH = process.env.FITBIT_TOKEN_PATH ?? "/data/tokens/fitbit_token.json";
const CLIENT_ID = process.env.FITBIT_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET ?? "";
const AUTH_HEADER = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

// Same "shared, time-boxed cache" approach as app/api/weather/route.ts's
// `next: { revalidate }`. Weight is logged at most a few times a day, and
// this is what stands between normal usage and Fitbit's 150 req/hour cap
// once a wide time_delta pages through several date chunks.
const REVALIDATE_SECONDS = 3600; // 1 hour

type Tokens = { access_token: string; refresh_token: string };

async function loadTokens(): Promise<Tokens> {
  return JSON.parse(await readFile(TOKEN_PATH, "utf-8"));
}

async function saveTokens(tokens: Tokens) {
  await writeFile(TOKEN_PATH, JSON.stringify(tokens));
}

async function refreshToken(): Promise<string | null> {
  const tokens = await loadTokens();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: tokens.refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });

  const res = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${AUTH_HEADER}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) return null;
  const newTokens = await res.json();
  await saveTokens(newTokens);
  return newTokens.access_token;
}

function fmt(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function authedFetch(url: string): Promise<Response> {
  const tokens = await loadTokens();
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (res.status === 401) {
    const accessToken = await refreshToken();
    if (accessToken) {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: REVALIDATE_SECONDS },
      });
    }
  }
  return res;
}

// Log endpoint only returns actual weigh-ins (sparse, real measurements) but
// caps each request at a 31-day range.
const LOG_ENDPOINT_MAX_DAYS = 31;

type LogEntry = { date: string; weight?: number; fat?: number; bmi?: number };

// Single log entry carries weight/fat/bmi together, so one request per chunk
// covers all three resources - calling this once per resource (as before)
// tripled the Fitbit API calls for identical data, which matters a lot given
// Fitbit's 150 req/hour cap once the range spans several 31-day chunks.
async function queryLogChunk(start: Date, end: Date): Promise<LogEntry[]> {
  const url = `https://api.fitbit.com/1/user/-/body/log/weight/date/${fmt(start)}/${fmt(end)}.json`;

  const res = await authedFetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error("rate-limited");
    return [];
  }

  const json = await res.json();
  return json.weight ?? [];
}

// Pages the log endpoint in <=31-day chunks so diffs (lastDiff/avgDiff in
// app/health/page.tsx) always compare real measurements, regardless of range.
// The alternative daily time-series endpoint forward-fills days without a new
// weigh-in with the last logged value, which silently zeroes those diffs out
// once the trailing window contains only padded duplicates.
async function queryLog(delta: number): Promise<LogEntry[]> {
  const now = new Date();
  const chunks: Array<{ start: Date; end: Date }> = [];

  for (let daysAgo = delta; daysAgo > 0; daysAgo -= LOG_ENDPOINT_MAX_DAYS) {
    const end = new Date(now.getTime() - (daysAgo - Math.min(daysAgo, LOG_ENDPOINT_MAX_DAYS)) * 86400000);
    const start = new Date(now.getTime() - daysAgo * 86400000);
    chunks.push({ start, end });
  }

  const results = await Promise.all(chunks.map((c) => queryLogChunk(c.start, c.end)));
  const entries = results.flat();

  const byDate = new Map(entries.map((e) => [e.date, e]));
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const STEPS_DAYS = 5;

// Unlike the weight log endpoint, activity time series (steps) genuinely
// reports a per-day total - including 0 for days with no data - rather than
// forward-filling gaps with a stale prior value, so the plain time-series
// endpoint (not the paginated log approach above) is fine here.
async function querySteps(days: number): Promise<Array<{ dateTime: string; value: number }>> {
  const now = new Date();
  const start = new Date(now.getTime() - (days - 1) * 86400000);
  const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${fmt(start)}/${fmt(now)}.json`;

  const res = await authedFetch(url);
  if (!res.ok) {
    if (res.status === 429) throw new Error("rate-limited");
    return [];
  }

  const json = await res.json();
  const series = (json["activities-steps"] ?? []) as Array<{ dateTime: string; value: string }>;
  return series.map((e) => ({ dateTime: e.dateTime, value: Number(e.value) }));
}

export async function GET(req: NextRequest) {
  const delta = Number(req.nextUrl.searchParams.get("time_delta") ?? 29);

  let entries: LogEntry[];
  let steps: Array<{ dateTime: string; value: number }>;
  try {
    [entries, steps] = await Promise.all([queryLog(delta), querySteps(STEPS_DAYS)]);
  } catch {
    // Surface rate-limiting distinctly so the UI can show "try again later"
    // instead of an indistinguishable-from-loading empty chart.
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const resources: Array<"weight" | "fat" | "bmi"> = ["weight", "fat", "bmi"];
  const out: Record<string, unknown> = {};
  for (const resource of resources) {
    out[resource] = entries.map((e) => ({ dateTime: e.date, value: e[resource] ?? null }));
  }
  out.steps = steps;

  return NextResponse.json(out);
}
