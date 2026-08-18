"use client";

import { useWeather } from "@/lib/hooks";
import WeatherSummary from "@/components/weather/WeatherSummary";
import ForecastStrip from "@/components/weather/ForecastStrip";
// TODO: swap for a ported DayTempGraph (day-range chart) once the chart
// components move to ECharts - see components/weather/graphs/DayTempGraph.vue.
import HourlyTempChart from "@/components/charts/HourlyTempChart";
import styles from "./page.module.sass";

// Visual port of WeatherView.vue.

export default function WeatherPage() {
  const { data, isLoading } = useWeather();

  if (isLoading || !data) {
    return (
      <div className={styles.wrapper}>
        <p>Loading weather…</p>
      </div>
    );
  }

  const { current, hourly, daily } = data;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <WeatherSummary
          size={1}
          temperature={Math.round(current.temperature_2m)}
          weatherCode={current.weather_code}
        />
        <ForecastStrip maxTemps={daily.temperature_2m_max} weatherCodes={daily.weather_code} />
      </div>

      <div className={styles.footer}>
        <div className={styles.chartCard}>
          <HourlyTempChart
            times={hourly.time}
            temps={hourly.temperature_2m}
            apparentTemps={hourly.apparent_temperature}
          />
        </div>
      </div>
    </div>
  );
}
