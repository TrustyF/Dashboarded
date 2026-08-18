"use client";

import { useCalendar, useWeather } from "@/lib/hooks";
import Clock from "@/components/clock/Clock";
import WeatherSummary from "@/components/weather/WeatherSummary";
import SensorTempSummary from "@/components/sensors/SensorTempSummary";
import CalendarTimeline from "@/components/calendar/CalendarTimeline";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import styles from "./page.module.sass";

// Visual port of HomeView.vue, wired to the real API routes.

export default function HomePage() {
  const { data: weather } = useWeather();
  const { data: events } = useCalendar();

  const currentTemp = weather?.current?.temperature_2m;

  return (
    <div className={styles.wrapper}>
      <div className={styles.top}>
        <WeatherSummary
          size={0.8}
          temperature={currentTemp != null ? Math.round(currentTemp) : 0}
          weatherCode={weather?.current?.weather_code}
        />
        <Clock size={1} />
        <SensorTempSummary size={0.8} />
      </div>

      <div className={styles.footer}>
        <CalendarTimeline events={events ?? []} />
        <CalendarGrid events={events ?? []} />
      </div>
    </div>
  );
}
