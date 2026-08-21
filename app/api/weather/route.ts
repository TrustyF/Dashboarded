import { NextResponse } from "next/server";

// Ported from dashboard_server/flask_blueprints/weather_bp.py.
// Flask used @cache.cached(timeout=1800) via flask_caching; Next's fetch cache
// with `next: { revalidate }` gives the same "shared, time-boxed cache" behavior
// without an extra dependency.

const LAT = process.env.WEATHER_LAT ?? "49.2497";
const LON = process.env.WEATHER_LON ?? "-123.1193";
const REVALIDATE_SECONDS = 10 * 60; // 10 mins
// Days of forecast shown in the daily chart (Open-Meteo caps this at 16).
const FORECAST_DAYS = 4;

type DailyBlock = {
  time: string[];
  temperature_2m_min: number[];
  temperature_2m_max: number[];
  temperature_2m?: number[];
  temperature_day_range?: number[];
  temperature_day_range_times?: string[];
  precipitation_sum?: number[];
  precipitation_hourly?: number[];
  precipitation_hourly_times?: string[];
  temperature_hourly?: number[];
  [key: string]: unknown;
};

export async function GET() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  const forecastUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=auto&forecast_days=${FORECAST_DAYS}` +
    `&current=temperature_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,uv_index` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,cloud_cover,` +
    `sunshine_duration,precipitation,uv_index,shortwave_radiation&forecast_hours=12` +
    `&daily=weather_code,precipitation_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_mean,` +
    `uv_index_max,sunset,sunrise,shortwave_radiation_sum,sunshine_duration,daylight_duration`;

  const dayRangeUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=auto` +
    `&hourly=temperature_2m&start_date=${today}&end_date=${tomorrow}` +
    `&start_hour=${today}T00:00&end_hour=${tomorrow}T09:00`;

  // Separate request (rather than widening the main `hourly` block's
  // forecast_hours=12 window) so the daily chart's hour-by-hour rain bands
  // and temp line can cover the full 7-day forecast without inflating every
  // other hourly series the rest of the app only ever reads the next 12h of.
  const weekPrecipUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&timezone=auto` +
    `&forecast_days=${FORECAST_DAYS}&hourly=precipitation,temperature_2m`;

  const [forecastRes, dayRangeRes, weekPrecipRes] = await Promise.all([
    fetch(forecastUrl, { next: { revalidate: REVALIDATE_SECONDS } }),
    fetch(dayRangeUrl, { next: { revalidate: REVALIDATE_SECONDS } }),
    fetch(weekPrecipUrl, { next: { revalidate: REVALIDATE_SECONDS } }),
  ]);

  const forecast = await forecastRes.json();
  const dayRange = await dayRangeRes.json();
  const weekPrecip = await weekPrecipRes.json();

  const daily: DailyBlock = forecast.daily;

  daily.temperature_2m = daily.temperature_2m_min.map(
    (min: number, i: number) => (min + daily.temperature_2m_max[i]) / 2
  );
  daily.temperature_day_range = dayRange.hourly?.temperature_2m;
  daily.temperature_day_range_times = dayRange.hourly?.time;
  daily.precipitation_hourly = weekPrecip.hourly?.precipitation;
  daily.precipitation_hourly_times = weekPrecip.hourly?.time;
  daily.temperature_hourly = weekPrecip.hourly?.temperature_2m;

  return NextResponse.json({
    current: forecast.current,
    hourly: forecast.hourly,
    daily,
  });
}
