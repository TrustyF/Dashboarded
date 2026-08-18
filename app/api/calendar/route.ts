import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

// Ported from dashboard_server/flask_blueprints/calendar_bp.py.
//
// IMPORTANT: the original Flask code had a live Google OAuth client_id/secret
// hardcoded in source. Those now come from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
// env vars instead - see .env.local.example. Rotate the old credentials if this repo
// was ever pushed anywhere with them inline.

const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH ?? "/data/tokens/google_refresh_token.json";
const REVALIDATE_SECONDS = 1800;

type CalendarEvent = {
  id: string;
  created: string;
  start: { dateTime?: string; date?: string };
  summary: string;
  recurringEventId?: string;
  colorId?: string | number;
};

async function getAccessToken(): Promise<string> {
  const raw = await readFile(TOKEN_PATH, "utf-8");
  const { refresh_token } = JSON.parse(raw);

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = await res.json();
  return json.access_token;
}

async function getEvents(url: string, params: Record<string, string>, accessToken: string) {
  const query = new URLSearchParams(params);
  const res = await fetch(`${url}?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  const json = await res.json();
  return (json.items ?? []) as CalendarEvent[];
}

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const now = new Date();
  const nowIso = now.toISOString();
  const maxFutureIso = new Date(now.getTime() + 50 * 86400000).toISOString();

  const accessToken = await getAccessToken();

  const primaryEvents = await getEvents(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      calendarId: "primary",
      maxResults: String(limit),
      singleEvents: "true",
      timeMin: nowIso,
      timeMax: maxFutureIso,
      orderBy: "startTime",
    },
    accessToken
  );

  const holidayEvents = (
    await getEvents(
      "https://www.googleapis.com/calendar/v3/calendars/en.canadian%23holiday@group.v.calendar.google.com/events",
      { maxResults: String(limit), timeMin: nowIso, timeMax: maxFutureIso },
      accessToken
    )
  ).map((e) => ({ ...e, colorId: 7 }));

  const events = [...primaryEvents, ...holidayEvents].sort((a, b) => {
    const da = a.start.dateTime ?? a.start.date ?? "";
    const db = b.start.dateTime ?? b.start.date ?? "";
    return da.localeCompare(db);
  });

  const seenRecurring = new Set<string>();
  const formatted = [];

  for (const e of events) {
    const dtString = e.start.dateTime ?? e.start.date!;
    const isRecurring = Boolean(e.recurringEventId);

    if (isRecurring) {
      if (seenRecurring.has(e.recurringEventId!)) continue;
      seenRecurring.add(e.recurringEventId!);
    }

    formatted.push({
      id: e.id,
      created: e.created,
      date: new Date(dtString).toISOString(),
      name: e.summary,
      recurring: isRecurring,
      colorId: e.colorId,
    });
  }

  return NextResponse.json(formatted);
}
