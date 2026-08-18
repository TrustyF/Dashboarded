"use client";

import { useWeather } from "@/lib/hooks";
import WeatherSummary from "@/components/weather/WeatherSummary";
import ForecastStrip from "@/components/weather/ForecastStrip";
// TODO: swap for a ported DayTempGraph (day-range chart) once the chart
// components move to ECharts - see components/weather/graphs/DayTempGraph.vue.
import HourlyTempChart from "@/components/charts/HourlyTempChart";

// Visual port of WeatherView.vue.

export default function WeatherPage() {
  const { data, isLoading } = useWeather();

  if (isLoading || !data) {
    return (
      <div className="weather_page_wrapper">
        <p>Loading weather…</p>
      </div>
    );
  }

  const { current, hourly, daily } = data;

  return (
    <div className="weather_page_wrapper">
      <div id="header">
        <WeatherSummary
          size={1}
          temperature={Math.round(current.temperature_2m)}
          weatherCode={current.weather_code}
        />
        <ForecastStrip maxTemps={daily.temperature_2m_max} weatherCodes={daily.weather_code} />
      </div>

      <div id="footer">
        <div className="weather_chart_card">
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
