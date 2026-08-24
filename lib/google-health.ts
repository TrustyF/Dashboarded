import { readFile } from "node:fs/promises";

// Shared between app/api/fitbit/route.ts and app/api/fitbit/debug/route.ts -
// pulled out so the debug route exercises the exact same token/date logic
// the real route uses, instead of a second copy that can drift out of sync.

export const TOKEN_PATH = process.env.GOOGLE_HEALTH_TOKEN_PATH ?? "/data/tokens/google_health_token.json";
export const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

export type CivilDate = { year: number; month: number; day: number };

export async function getAccessToken(): Promise<string> {
  let refresh_token: string;
  try {
    const raw = await readFile(TOKEN_PATH, "utf-8");
    ({ refresh_token } = JSON.parse(raw));
  } catch {
    // Missing/unparseable token file - same "needs re-bootstrapping" bucket
    // as a rejected refresh token, not a transient rate-limit.
    throw new Error("invalid-credentials");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) throw new Error("invalid-credentials");
  const json = await res.json();
  return json.access_token;
}

export function toCivilDate(date: Date): CivilDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function civilDateStr(date: CivilDate | undefined, fallbackIso: string): string {
  if (!date) return fallbackIso.slice(0, 10);
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

// Monday 00:00 of the week containing `date` (local time) - matches the
// Monday-first week CalendarGrid.tsx uses for its month grid.
export function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}
