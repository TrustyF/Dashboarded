import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { cacheSnapshot } from "@/lib/api-cache";
import { getAccessToken, toCivilDate, civilDateStr, startOfWeek, TOKEN_PATH } from "@/lib/google-health";

// Diagnostic-only route for tracking down the steps graph showing up empty.
// Deliberately bypasses cachedFetch for the live probe (unlike the real
// /api/fitbit route) so it reflects what upstream returns right now, not
// whatever's sitting in the TTL cache - and reports each stage (clock/TZ,
// token file, token exchange, upstream call) separately so a failure in one
// doesn't hide whether the others are fine.
//
// ?probe_days=N adds a second live probe against a full N-day dailyRollUp
// range - this is what caught dailyRollUp's undocumented-in-app 90-day
// window cap (INVALID_ROLLUP_QUERY_DURATION) that queryStepsHistory's
// chunking now works around.

async function tokenFileStatus() {
  try {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      path: TOKEN_PATH,
      readable: true,
      hasRefreshToken: typeof parsed.refresh_token === "string" && parsed.refresh_token.length > 0,
    };
  } catch (err) {
    return { path: TOKEN_PATH, readable: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: Request) {
  const probeDays = Number(new URL(req.url).searchParams.get("probe_days") ?? 0);

  const now = new Date();
  const start = startOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return civilDateStr(toCivilDate(day), "");
  });

  const time = {
    nowIso: now.toISOString(),
    nowLocalString: now.toString(),
    processEnvTZ: process.env.TZ ?? null,
    resolvedTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const week = {
    startLocal: start.toString(),
    endLocal: end.toString(),
    startCivilDate: toCivilDate(start),
    endCivilDate: toCivilDate(end),
    civilDatesQueried: weekDates,
    cacheKey: `fitbit:steps:${civilDateStr(toCivilDate(start), "")}`,
  };

  const cache = { steps: cacheSnapshot("fitbit:steps:") };

  const tokenFile = await tokenFileStatus();

  let accessToken: string | null = null;
  let accessTokenError: string | null = null;
  try {
    accessToken = await getAccessToken();
  } catch (err) {
    accessTokenError = err instanceof Error ? err.message : String(err);
  }

  // Live, uncached probe against the same dailyRollUp call querySteps()
  // makes, for the same computed week - shows exactly what Google Health
  // hands back right now, independent of anything cached.
  let liveProbe: Record<string, unknown> = { ran: false };
  if (accessToken) {
    try {
      const res = await fetch("https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          range: { start: { date: toCivilDate(start) }, end: { date: toCivilDate(end) } },
          windowSizeDays: 1,
        }),
      });
      const bodyText = await res.text();
      liveProbe = {
        ran: true,
        status: res.status,
        ok: res.ok,
        body: (() => {
          try {
            return JSON.parse(bodyText);
          } catch {
            return bodyText.slice(0, 2000);
          }
        })(),
      };
    } catch (err) {
      liveProbe = { ran: true, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  let longProbe: Record<string, unknown> = { ran: false };
  if (accessToken && probeDays > 0) {
    const longEnd = new Date();
    longEnd.setHours(0, 0, 0, 0);
    longEnd.setDate(longEnd.getDate() + 1);
    const longStart = new Date(longEnd);
    longStart.setDate(longStart.getDate() - probeDays);

    try {
      const res = await fetch("https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          range: { start: { date: toCivilDate(longStart) }, end: { date: toCivilDate(longEnd) } },
          windowSizeDays: 1,
        }),
      });
      const bodyText = await res.text();
      longProbe = {
        ran: true,
        requestedRange: { start: toCivilDate(longStart), end: toCivilDate(longEnd) },
        status: res.status,
        ok: res.ok,
        body: (() => {
          try {
            return JSON.parse(bodyText);
          } catch {
            return bodyText.slice(0, 2000);
          }
        })(),
      };
    } catch (err) {
      longProbe = { ran: true, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({
    time,
    week,
    cache,
    tokenFile,
    accessToken: { ok: accessToken !== null, error: accessTokenError },
    liveStepsProbe: liveProbe,
    longProbe,
  });
}
