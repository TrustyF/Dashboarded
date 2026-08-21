import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { cachedFetch } from "@/lib/api-cache";

// Ported from dashboard_server/flask_blueprints/calendar_bp.py.
//
// IMPORTANT: the original Flask code had a live Google OAuth client_id/secret
// hardcoded in source. Those now come from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
// env vars instead - see .env.local.example. Rotate the old credentials if this repo
// was ever pushed anywhere with them inline.

const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH ?? "/data/tokens/google_refresh_token.json";
const REVALIDATE_SECONDS = 3600; // 1 hour

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
  // Cache key is the base URL only, not the full query - timeMin/timeMax are
  // millisecond-precision "now" timestamps that differ on every call, which
  // would otherwise bust the cache every single request.
  return cachedFetch(`calendar:events:${url}`, REVALIDATE_SECONDS, async () => {
    const query = new URLSearchParams(params);
    const res = await fetch(`${url}?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = await res.json();
    return (json.items ?? []) as CalendarEvent[];
  });
}

// Events only carry a `colorId` when the user overrides an individual
// event's color - most events instead just inherit their calendar's own
// color, which the events.list response doesn't include at all. Without
// this, every event without a per-event override rendered as a flat grey
// "no color" placeholder instead of the color it actually shows as in
// Google Calendar's UI.
async function getCalendarColor(calendarId: string, accessToken: string): Promise<string | undefined> {
  return cachedFetch(`calendar:color:${calendarId}`, REVALIDATE_SECONDS, async () => {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    return json.backgroundColor as string | undefined;
  });
}

export async function GET(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const now = new Date();
  const nowIso = now.toISOString();
  const maxFutureIso = new Date(now.getTime() + 50 * 86400000).toISOString();

  const accessToken = await getAccessToken();
  const primaryColor = await getCalendarColor("primary", accessToken);

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
      // Timed events convert to a real UTC instant. All-day events only have
      // a bare calendar date ("2026-08-22") with no timezone - running that
      // through `new Date(...).toISOString()` parses it as UTC midnight,
      // which rolls back to the previous day once the frontend re-zeroes it
      // in local time for any timezone behind UTC. Appending a bare time
      // (no "Z"/offset) makes the Date constructor parse it as local
      // midnight instead, matching what the frontend expects.
      date: e.start.dateTime ? new Date(dtString).toISOString() : `${dtString}T00:00:00`,
      // No dateTime means Google only gave us a calendar date (an all-day
      // event) - there's no real clock time to show for these.
      allDay: !e.start.dateTime,
      name: e.summary,
      recurring: isRecurring,
      colorId: e.colorId,
      // Holiday events already carry their own hardcoded colorId (see above)
      // and take priority over this on the frontend - only events without an
      // override fall back to it.
      calendarColor: primaryColor,
    });
  }

  return NextResponse.json(formatted);
}
