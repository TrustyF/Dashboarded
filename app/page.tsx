"use client";

import { useCalendar, useFitbit, useSensorHistory, useWeather } from "@/lib/hooks";
import { netChange, uvCategory, uvIcon } from "@/lib/weather-metrics";
import { goalProgressPercent } from "@/lib/fitbit-metrics";
import { CODE_MAP } from "@/components/weather/WeatherSummary";
import Clock from "@/components/clock/Clock";
import CalendarTimeline from "@/components/calendar/CalendarTimeline";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import StatCard from "@/components/stats/StatCard";
import StatCardShell from "@/components/stats/StatCardShell";
import StepRings, { STEPS_GOAL } from "@/components/stats/StepRings";
import styles from "./page.module.sass";

// Home screen, restyled onto the same stat-tile/shell layout as
// app/weather/page.tsx instead of the original bespoke clock/weather/calendar
// arrangement.

export default function HomePage() {
  const { data: weather } = useWeather();
  const { data: events } = useCalendar();
  const { data: sensor } = useSensorHistory();
  const { data: fitbit } = useFitbit();

  const current = weather?.current;
  const hourly = weather?.hourly;

  // Same "nearest 2 hours of forecast" window as the weather page's stat
  // cards - see app/weather/page.tsx for why this isn't a history window.
  const nextTwoHours = <T,>(arr: T[] | undefined) => (arr ?? []).slice(0, 4);

  const [conditionTitle, conditionIcon] = CODE_MAP[current?.weather_code ?? 999] ?? CODE_MAP[999];
  const conditionIconSrc = conditionIcon !== "undefined" ? `/assets/weather/icons/v1/${conditionIcon}.png` : undefined;

  const uvIndex = current?.uv_index != null ? Math.round(current.uv_index) : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.statGrid}>
        <StatCardShell label="Time" className={styles.clockCard}>
          <Clock size={1.6} />
        </StatCardShell>

        <StatCard
          label="Temperature"
          value={current?.temperature_2m != null ? Math.round(current.temperature_2m) : null}
          unit="°"
          diff={netChange(nextTwoHours(hourly?.temperature_2m))}
          color="#5b9bd5"
          sparkline={nextTwoHours(hourly?.temperature_2m)}
          goodDirection="neutral"
          icon={conditionIconSrc}
          iconAlt={conditionTitle}
          iconLabel={conditionTitle}
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

      <div className={styles.footer}>
        <div className={styles.leftColumn}>
          <StatCard
            label="Steps"
            value={goalProgressPercent(fitbit?.steps, STEPS_GOAL)}
            unit="%"
            diff={null}
            color="#f2cc8f"
            sparkline={fitbit?.steps?.map((p: { value: number | null }) => p.value) ?? []}
            goodDirection="up"
            visual={fitbit?.steps && <StepRings days={fitbit.steps} color="#f2cc8f" />}
          />

          <div className={styles.subGrid}>
            <StatCard
              label="UV Index"
              value={uvIndex}
              unit={uvCategory(uvIndex) ?? ""}
              diffUnit=""
              diff={netChange(nextTwoHours(hourly?.uv_index))}
              color="#f2c94c"
              sparkline={nextTwoHours(hourly?.uv_index)}
              goodDirection="neutral"
              icon={uvIcon(uvIndex)}
              iconAlt={uvCategory(uvIndex)}
            />

            <StatCard
              label="Precipitation"
              value={current?.precipitation ?? null}
              unit="mm"
              diff={netChange(nextTwoHours(hourly?.precipitation))}
              color="#3fb8af"
              sparkline={nextTwoHours(hourly?.precipitation)}
              goodDirection="neutral"
            />
          </div>
        </div>

        <StatCardShell label="Calendar">
          <div className={styles.calendarContent}>
            <CalendarGrid events={events ?? []} />
            {/*<CalendarTimeline events={events ?? []} />*/}
          </div>
        </StatCardShell>
      </div>
    </div>
  );
}
