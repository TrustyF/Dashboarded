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
// requests aren't eligible for Next's fetch Data Cache at all, so this goes
// through cachedFetch like everything else here - keyed by the week it
// covers, which changes on its own once a new week starts, well before the
// 1h TTL would've expired it anyway.
async function querySteps(accessToken: string): Promise<StepsWeek> {
  const start = startOfWeek(new Date());
  const key = civilDateStr(toCivilDate(start), "");

  return cachedFetch(`fitbit:steps:${key}`, REVALIDATE_SECONDS, async () => {
    const end = new Date(start);
    end.setDate(start.getDate() + 7); // exclusive - covers Mon..Sun of this week

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
      return [];
    }

    const json = await res.json();
    const points = (json.rollupDataPoints ?? []) as StepsRollupPoint[];
    const byDate = new Map(points.map((p) => [civilDateStr(p.civilStartTime.date, ""), Number(p.steps?.countSum ?? 0)]));

    // The API only returns rows for days it has data for, so today's future
    // days (and any gaps) are just absent - pad out to all 7 civil dates of
    // the week so callers (StepRings) always get one entry per day, Mon..Sun.
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const dateTime = civilDateStr(toCivilDate(day), "");
      return { dateTime, value: byDate.get(dateTime) ?? 0 };
    });
  });
}

export async function GET(req: NextRequest) {
  const delta = Number(req.nextUrl.searchParams.get("time_delta") ?? 29);
  const cutoff = new Date(Date.now() - delta * 86400000);

  let weight: Array<{ dateTime: string; value: number | null }>;
  let fat: Array<{ dateTime: string; value: number | null }>;
  let steps: Array<{ dateTime: string; value: number }>;
  try {
    const accessToken = await getAccessToken();
    [weight, fat, steps] = await Promise.all([
      queryMeasurement("weight", accessToken, cutoff),
      queryMeasurement("body-fat", accessToken, cutoff),
      querySteps(accessToken),
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

  return NextResponse.json({ weight, fat, steps });
}
