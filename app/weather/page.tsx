"use client";

import dynamic from "next/dynamic";
import { useSensorHistory, useWeather } from "@/lib/hooks";
import { netChange, uvCategory, uvIcon } from "@/lib/weather-metrics";
import { CODE_MAP } from "@/components/weather/WeatherSummary";
import ForecastStrip from "@/components/weather/ForecastStrip";
import StatCard from "@/components/stats/StatCard";
import styles from "./page.module.sass";

// ECharts is a ~650KB chunk - deferring it keeps the shell interactive (and
// the weather fetch that clears the "Loading…" state running) instead of
// blocking hydration behind that download+parse.
const DailyTempChart = dynamic(() => import("@/components/charts/DailyTempChart"), { ssr: false });

// Same Google Fit/Health Connect style overview as app/health/page.tsx:
// quick-glance stat tiles up top, the detailed trend chart underneath.
export default function WeatherPage() {
  const { data, isLoading } = useWeather();
  const { data: sensor } = useSensorHistory();

  if (isLoading || !data) {
    return (
      <div className={styles.wrapper}>
        <p>Loading weather…</p>
      </div>
    );
  }

  const { current, hourly, daily } = data;
  const testUvIndex = 5; // TEMP: fake value to preview the UV icon thresholds
  const [conditionTitle, conditionIcon] = CODE_MAP[current.weather_code] ?? CODE_MAP[999];
  const conditionIconSrc = conditionIcon !== "undefined" ? `/assets/weather/icons/v1/${conditionIcon}.png` : undefined;

  // hourly.* is forward-looking only (forecast, not history), so "last 2
  // hours" for the stat cards means the nearest 2 hours of forecast - the
  // first 3 points (now, +1h, +2h) - rather than the full 12h window used by
  // the trend chart below.
  const nextTwoHours = <T,>(arr: T[]) => arr.slice(0, 4);

  // Skip the precipitation line entirely when nothing meaningful is forecast -
  // a flat line hugging 0 (or lost in float noise) is just visual clutter.
  const hasPrecipitation = daily.precipitation_sum?.some((v: number | null) => v != null && v > 0.1);

  return (
    <div className={styles.wrapper}>

      <div className={styles.statGrid}>
        <StatCard
          label="Temperature"
          value={Math.round(current.temperature_2m)}
          unit="°"
          diff={netChange(nextTwoHours(hourly.temperature_2m))}
          color="#5b9bd5"
          sparkline={nextTwoHours(hourly.temperature_2m)}
          goodDirection="neutral"
          icon={conditionIconSrc}
          iconAlt={conditionTitle}
          iconLabel={conditionTitle}
        />
        <StatCard
          label="UV Index"
          value={Math.round(testUvIndex*10)/10}
          unit={uvCategory(testUvIndex) ?? ""}
          diffUnit=""
          diff={netChange(nextTwoHours(hourly.uv_index))}
          color="#f2c94c"
          sparkline={nextTwoHours(hourly.uv_index)}
          goodDirection="neutral"
          emoji={uvIcon(testUvIndex)}
          iconAlt={uvCategory(testUvIndex)}
        />
        <StatCard
          label="Precipitation"
          value={current.precipitation}
          unit="mm"
          diff={netChange(nextTwoHours(hourly.precipitation))}
          color="#3fb8af"
          sparkline={nextTwoHours(hourly.precipitation)}
          goodDirection="neutral"
        />
        <StatCard
          label="Indoor"
          value={sensor?.temp?.at(-1) ?? null}
          unit="°"
          diff={netChange(sensor?.temp)}
          color="#c38869"
          sparkline={sensor?.temp ?? []}
          goodDirection="neutral"
        />
      </div>

      <div className={styles.trendCard}>
        <div className={styles.trendHeader}>Daily forecast</div>
        <div className={styles.trendChart}>
          <DailyTempChart
            times={daily.time}
            highs={daily.temperature_2m_max}
            sunshineHours={(daily.sunshine_duration as number[] | undefined)?.map((s) => s / 3600)}
            precipitation={hasPrecipitation ? daily.precipitation_sum : undefined}
          />
        </div>
      </div>

      <div className={styles.forecastCard}>
        <div className={styles.trendHeader}>Next few days</div>
        <ForecastStrip maxTemps={daily.temperature_2m_max} weatherCodes={daily.weather_code} />
      </div>
    </div>
  );
}
