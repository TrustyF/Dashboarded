import { NextResponse } from "next/server";

// Ported from dashboard_server/flask_blueprints/weather_bp.py.
// Flask used @cache.cached(timeout=1800) via flask_caching; Next's fetch cache
// with `next: { revalidate }` gives the same "shared, time-boxed cache" behavior
// without an extra dependency.

const LAT = process.env.WEATHER_LAT ?? "49.2497";
const LON = process.env.WEATHER_LON ?? "-123.1193";
const REVALIDATE_SECONDS = 1800; // 30 min, same as the Flask cache timeout

type DailyBlock = {
  temperature_2m_min: number[];
  temperature_2m_max: number[];
  temperature_2m?: number[];
  temperature_day_range?: number[];
  temperature_day_range_times?: string[];
  [key: string]: unknown;
};

export async function GET() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=auto&forecast_days=7` +
    `&current=temperature_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,cloud_cover,` +
    `sunshine_duration,precipitation,uv_index,shortwave_radiation&forecast_hours=12` +
    `&daily=weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_mean,` +
    `uv_index_max,sunset,sunrise,shortwave_radiation_sum,sunshine_duration,daylight_duration`;

  const dayRangeUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=auto` +
    `&hourly=temperature_2m&start_date=${today}&end_date=${tomorrow}` +
    `&start_hour=${today}T00:00&end_hour=${tomorrow}T09:00`;

  const [forecastRes, dayRangeRes] = await Promise.all([
    fetch(forecastUrl, { next: { revalidate: REVALIDATE_SECONDS } }),
    fetch(dayRangeUrl, { next: { revalidate: REVALIDATE_SECONDS } }),
  ]);

  const forecast = await forecastRes.json();
  const dayRange = await dayRangeRes.json();

  const daily: DailyBlock = forecast.daily;

  daily.temperature_2m = daily.temperature_2m_min.map(
    (min: number, i: number) => (min + daily.temperature_2m_max[i]) / 2
  );
  daily.temperature_day_range = dayRange.hourly?.temperature_2m;
  daily.temperature_day_range_times = dayRange.hourly?.time;

  return NextResponse.json({
    current: forecast.current,
    hourly: forecast.hourly,
    daily,
  });
}
