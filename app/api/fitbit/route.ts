import { NextRequest, NextResponse } from "next/server";
import { cachedFetch } from "@/lib/api-cache";
import { getAccessToken, toCivilDate, civilDateStr, startOfWeek, type CivilDate } from "@/lib/google-health";

// Replaces the legacy Fitbit Web API integration - Fitbit's API is being
// decommissioned by Google in favor of the Google Health API (same
// underlying device data, new cloud REST surface) by September 30, 2026.
// Route path/hook name (useFitbit, /api/fitbit) kept as-is to avoid touching
// every caller; only the upstream provider changed.
//
// Token bootstrap: `node scripts/bootstrap-tokens.mjs google-health` (reuses
// GOOGLE_CLIENT_ID/SECRET, but needs its own refresh token - the Health API
// rejects tokens that also carry other product scopes like Calendar's, so
// this can't share app/api/calendar's GOOGLE_TOKEN_PATH file).

// Same "shared, time-boxed cache" approach as the other API routes.
const REVALIDATE_SECONDS = 1800; // 30 minutes

// No BMI data type exists on this API (confirmed: `bmi` 400s with
// INVALID_ARGUMENT) - Fitbit's log endpoint used to bundle it in for free,
// but computing it here would need a hardcoded height nobody's tracking, so
// the BMI stat card was dropped from the health page instead.

type WeightPoint = {
  weight?: { sampleTime: { physicalTime: string; civilTime?: { date: CivilDate } }; weightGrams: number };
  bodyFat?: { sampleTime: { physicalTime: string; civilTime?: { date: CivilDate } }; percentage: number };
};

type StepsRollupPoint = {
  civilStartTime: { date: CivilDate };
  steps?: { countSum: string };
};

async function queryDataPoints<T>(dataType: string, accessToken: string, pageSize: number): Promise<T[]> {
  return cachedFetch(`fitbit:${dataType}`, REVALIDATE_SECONDS, async () => {
    const url = `https://health.googleapis.com/v4/users/me/dataTypes/${dataType}/dataPoints?pageSize=${pageSize}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!res.ok) {
      console.error(`[fitbit] ${dataType} dataPoints failed: ${res.status} ${await res.text()}`);
      if (res.status === 429) throw new Error("rate-limited");
      return [];
    }

    const json = await res.json();
    return (json.dataPoints ?? []) as T[];
  });
}

// Weight/body-fat are logged sporadically (a handful of scale weigh-ins a
// month), so unlike Fitbit's old 31-day-capped log endpoint, one generously
// sized page comfortably covers any time_delta the range selector offers -
// no chunked pagination needed. Response is already newest-first.
const MEASUREMENT_PAGE_SIZE = 200;

async function queryMeasurement(
  dataType: "weight" | "body-fat",
  accessToken: string,
  cutoff: Date
): Promise<Array<{ dateTime: string; value: number | null }>> {
  const points = await queryDataPoints<WeightPoint>(dataType, accessToken, MEASUREMENT_PAGE_SIZE);
  const out: Array<{ dateTime: string; value: number }> = [];

  for (const point of points) {
    const payload = dataType === "weight" ? point.weight : point.bodyFat;
    if (!payload) continue;

    const sampleTime = new Date(payload.sampleTime.physicalTime);
    if (sampleTime < cutoff) continue;

    const dateTime = civilDateStr(payload.sampleTime.civilTime?.date, payload.sampleTime.physicalTime);
    const value = "weightGrams" in payload ? payload.weightGrams / 1000 : payload.percentage;
    out.push({ dateTime, value: Math.round(value * 100) / 100 });
  }

  return out.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
}

type StepsWeek = Array<{ dateTime: string; value: number }>;

// The raw `steps` data type is per-minute intervals - up to 10,000 points for
// just a week, which blew past Next's fetch cache size limit. `dailyRollUp`
// (a POST method alongside list/get/create) does the civil-day bucketing
// server-side instead and hands back one small entry per day. Also: POST
// requests aren't eligible for Next's fetch Data Cache at all, so both
// callers below go through cachedFetch instead, each with its own key
// (chosen so the cache rotates on its own rather than growing unbounded -
// see the comment on each caller).
async function fetchStepsRollup(accessToken: string, start: Date, end: Date): Promise<Map<string, number>> {
  const res = await fetch("https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      range: { start: { date: toCivilDate(start) }, end: { date: toCivilDate(end) } },
      windowSizeDays: 1,
    }),
  });

  if (!res.ok) {
    console.error(`[fitbit] steps dailyRollUp failed: ${res.status} ${await res.text()}`);
    if (res.status === 429) throw new Error("rate-limited");
    return new Map();
  }

  const json = await res.json();
  const points = (json.rollupDataPoints ?? []) as StepsRollupPoint[];
  return new Map(points.map((p) => [civilDateStr(p.civilStartTime.date, ""), Number(p.steps?.countSum ?? 0)]));
}

// The API only returns rows for days it has data for, so gaps (including
// today, before it's finished) are just absent from `byDate` - pad out to
// every civil date in [start, end) so callers always get one entry per day.
function padDailySteps(start: Date, end: Date, byDate: Map<string, number>): StepsWeek {
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const dateTime = civilDateStr(toCivilDate(day), "");
    return { dateTime, value: byDate.get(dateTime) ?? 0 };
  });
}

// Mon..Sun of the current week, for the "Steps (this week)" stat card and
// its StepRings visual - both assume exactly 7 entries, so this stays fixed
// regardless of the range selector (unlike queryStepsHistory below).
async function querySteps(accessToken: string): Promise<StepsWeek> {
  const start = startOfWeek(new Date());
  const key = civilDateStr(toCivilDate(start), "");

  return cachedFetch(`fitbit:steps:${key}`, REVALIDATE_SECONDS, async () => {
    const end = new Date(start);
    end.setDate(start.getDate() + 7); // exclusive - covers Mon..Sun of this week
    const byDate = await fetchStepsRollup(accessToken, start, end);
    return padDailySteps(start, end, byDate);
  });
}

// Comfortably covers the range selector's longest option (1Y) - same
// "one generously sized window, no per-range refetching" approach as
// MEASUREMENT_PAGE_SIZE above, rather than a separate upstream call (and
// cache key) per range-selector button.
const STEPS_HISTORY_WINDOW_DAYS = 400;

// dailyRollUp hard-caps how much duration a single query can cover - a wider
// request 400s with INVALID_ROLLUP_QUERY_DURATION ("must not exceed 90 days
// for steps"). Split the full window into <=90-day chunks and fetch them in
// parallel instead.
const STEPS_ROLLUP_MAX_DAYS = 90;

function chunkRange(start: Date, end: Date, maxDays: number): Array<[Date, Date]> {
  const chunks: Array<[Date, Date]> = [];
  let chunkStart = new Date(start);
  while (chunkStart < end) {
    const chunkEnd = new Date(chunkStart);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    chunks.push([chunkStart, chunkEnd]);
    chunkStart = chunkEnd;
  }
  return chunks;
}

// Daily steps for the trend chart, filtered down to the same cutoff as
// weight/fat - so the range selector controls steps history too, instead of
// it being stuck on the current week like the stat card above.
async function queryStepsHistory(accessToken: string, cutoff: Date): Promise<StepsWeek> {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1); // exclusive - include today
  const start = new Date(end);
  start.setDate(start.getDate() - STEPS_HISTORY_WINDOW_DAYS);

  // Keyed by day rather than by cutoff: one cache entry that rotates once a
  // day regardless of which range-selector button is active, instead of a
  // separate stale entry per button.
  const key = civilDateStr(toCivilDate(end), "");

  const all = await cachedFetch(`fitbit:steps:history:${key}`, REVALIDATE_SECONDS, async () => {
    const chunks = chunkRange(start, end, STEPS_ROLLUP_MAX_DAYS);
    const maps = await Promise.all(chunks.map(([chunkStart, chunkEnd]) => fetchStepsRollup(accessToken, chunkStart, chunkEnd)));
    const byDate = new Map<string, number>();
    for (const map of maps) for (const [date, value] of map) byDate.set(date, value);
    return padDailySteps(start, end, byDate);
  });

  return all.filter((p) => new Date(`${p.dateTime}T00:00:00`) >= cutoff);
}

export async function GET(req: NextRequest) {
  const delta = Number(req.nextUrl.searchParams.get("time_delta") ?? 29);

  // Midnight-anchored rather than an exact "now minus N days" timestamp -
  // queryStepsHistory compares against each day's local midnight, so an
  // exact-timestamp cutoff (whatever time of day "now" happens to be) drifts
  // the two series' start dates apart by up to a day depending on when this
  // route runs. Anchoring both to the same calendar-day boundary keeps
  // weight/fat and steps plotted over an identical range.
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - delta);

  let weight: Array<{ dateTime: string; value: number | null }>;
  let fat: Array<{ dateTime: string; value: number | null }>;
  let steps: Array<{ dateTime: string; value: number }>;
  let stepsHistory: Array<{ dateTime: string; value: number }>;
  try {
    const accessToken = await getAccessToken();
    [weight, fat, steps, stepsHistory] = await Promise.all([
      queryMeasurement("weight", accessToken, cutoff),
      queryMeasurement("body-fat", accessToken, cutoff),
      querySteps(accessToken),
      queryStepsHistory(accessToken, cutoff),
    ]);
  } catch (err) {
    // Surface rate-limiting vs. invalid/expired credentials distinctly - both
    // used to collapse into "rate-limited", which made a bad client
    // id/secret or a revoked refresh token look identical to "try again
    // later" and impossible to diagnose from the UI alone.
    if (err instanceof Error && err.message === "invalid-credentials") {
      return NextResponse.json({ error: "invalid-credentials" }, { status: 401 });
    }
    if (!(err instanceof Error && err.message === "rate-limited")) {
      console.error("[fitbit] unexpected error, reporting as rate-limited:", err);
    }
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  return NextResponse.json({ weight, fat, steps, stepsHistory });
}
