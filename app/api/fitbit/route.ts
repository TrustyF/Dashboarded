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
  });

  if (res.status === 401) {
    const accessToken = await refreshToken();
    if (accessToken) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    }
  }
  return res;
}

async function queryWeight(resource: "weight" | "fat" | "bmi", delta: number) {
  const start = fmt(new Date());
  const end = fmt(new Date(Date.now() - delta * 86400000));
  const url = `https://api.fitbit.com/1/user/-/body/log/weight/date/${end}/${start}.json`;

  const res = await authedFetch(url);
  if (!res.ok) return [];

  const json = await res.json();
  return (json.weight ?? []).map((x: { date: string; [k: string]: unknown }) => ({
    dateTime: x.date,
    value: x[resource] ?? null,
  }));
}

async function queryTimeSeries(resource: "weight" | "fat" | "bmi", delta: number) {
  const start = fmt(new Date());
  const end = fmt(new Date(Date.now() - delta * 86400000));
  const url = `https://api.fitbit.com/1/user/-/body/${resource}/date/${start}/${end}.json`;

  const res = await authedFetch(url);
  if (!res.ok) return [];

  const json = await res.json();
  const values = Object.values(json) as unknown[];
  return values[0] ?? [];
}

export async function GET(req: NextRequest) {
  const delta = Number(req.nextUrl.searchParams.get("time_delta") ?? 29);

  const resources: Array<"weight" | "fat" | "bmi"> = ["weight", "fat", "bmi"];
  const out: Record<string, unknown> = {};

  for (const resource of resources) {
    out[resource] = delta > 29 ? await queryTimeSeries(resource, delta) : await queryWeight(resource, delta);
  }

  return NextResponse.json(out);
}
