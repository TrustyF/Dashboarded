"use client";

import {useCalendar, useFitbit, useSensorHistory, useWeather} from "@/lib/hooks";
import {netChange, uvCategory, uvIcon} from "@/lib/weather-metrics";
import {goalProgressPercent} from "@/lib/fitbit-metrics";
import {CODE_MAP} from "@/components/weather/WeatherSummary";
import Clock from "@/components/clock/Clock";
import WeatherSummary from "@/components/weather/WeatherSummary";
import CalendarTimeline from "@/components/calendar/CalendarTimeline";
import CalendarGrid from "@/components/calendar/CalendarGrid";
import StatCard from "@/components/stats/StatCard";
import StatCardShell from "@/components/stats/StatCardShell";
import StepRings, {STEPS_GOAL} from "@/components/stats/StepRings";
import {STAT_COLORS} from "@/lib/stat-colors";
import {movingAverageNullable} from "@/lib/moving-average";
import styles from "./HomeView.module.sass";

// Same 5-reading window as SensorHistoryChart.tsx (50s either side of noise
// without smearing out real swings, at poll.py's 10s poll interval).
const SENSOR_SMOOTHING_WINDOW_READINGS = 10;

// Home screen, restyled onto the same stat-tile/shell layout as
// app/weather/WeatherView.tsx instead of the original bespoke clock/weather/calendar
// arrangement.

export default function HomeView() {
    const {data: weather} = useWeather();
    const {data: events} = useCalendar();
    const {data: sensor} = useSensorHistory();
    const {data: fitbit} = useFitbit();

    const smoothIndoorTemp = movingAverageNullable(sensor?.temp ?? [], SENSOR_SMOOTHING_WINDOW_READINGS);
    const smoothIndoorTempLatest = smoothIndoorTemp.at(-1);
    // Averaging readings that are already rounded to 1 decimal can produce a
    // long trailing decimal (e.g. 22.343333) - round back down for display.
    const indoorTempValue = smoothIndoorTempLatest != null ? Math.round(smoothIndoorTempLatest * 10) / 10 : null;

    const current = weather?.current;
    const hourly = weather?.hourly;
    const daily = weather?.daily;

    // Same "nearest 4 hours of forecast" window as the weather page's stat
    // cards - see app/weather/WeatherView.tsx for why this isn't a history window.
    const nextFourHours = <T, >(arr: T[] | undefined) => (arr ?? []).slice(0, 5);

    const [conditionTitle, conditionIcon] = CODE_MAP[current?.weather_code ?? 999] ?? CODE_MAP[999];
    const conditionIconSrc = conditionIcon !== "undefined" ? `/assets/weather/icons/v1/${conditionIcon}.png` : undefined;

    const uvIndex = current?.uv_index != null ? Math.round(current.uv_index) : null;

    // Same "negligible" threshold as WeatherView's daily-chart precipitation
    // line - below this it's float noise, not weather. When nothing's
    // falling now or in the next 4h, the precipitation card is dead space,
    // so show cloud cover instead.
    const upcomingPrecipitation = nextFourHours<number | null>(hourly?.precipitation);
    const hasPrecipitation =
        (current?.precipitation ?? 0) > 0.1 ||
        upcomingPrecipitation.some((v: number | null) => v != null && v > 0.1);

    // daily.* is index-0-is-today, same convention app/weather/WeatherView.tsx's
    // DailyTempChart relies on.
    const todayHigh = daily?.temperature_2m_max?.[0];
    const todayCode = daily?.weather_code?.[0];

    return (
        <div className={styles.wrapper}>
            <div className={styles.statGrid}>

                <StatCardShell className={styles.clockCard}>
                    <Clock size={1}/>
                </StatCardShell>

                <StatCardShell className={styles.weatherCard}>
                    <WeatherSummary
                        size={0.9}
                        temperature={todayHigh != null ? Math.round(todayHigh) : 0}
                        weatherCode={todayCode}
                    />
                </StatCardShell>

                <StatCard

                    className={styles.stepsCard}
                    label="Steps"
                    value={null}
                    valueSize={1}
                    unit="%"
                    diff={null}
                    color={STAT_COLORS.steps}
                    sparkline={fitbit?.steps?.map((p: { value: number | null }) => p.value) ?? []}
                    goodDirection="up"
                    visual={fitbit?.steps && <StepRings days={fitbit.steps} color={STAT_COLORS.stepsRing}/>}
                />
            </div>

            <div className={styles.footer}>
                <div className={styles.subGrid}>
                    <StatCard
                        label="Temperature"
                        value={current?.temperature_2m != null ? Math.round(current.temperature_2m) : null}
                        valueSize={1.5}
                        unit="°"
                        diff={netChange(nextFourHours(hourly?.temperature_2m))}
                        color={STAT_COLORS.temperature}
                        sparkline={nextFourHours(hourly?.temperature_2m)}
                        goodDirection="neutral"
                    />

                    <StatCard
                        label="Indoor"
                        value={indoorTempValue}
                        valueSize={1.5}
                        unit="°"
                        diff={netChange(smoothIndoorTemp)}
                        color={STAT_COLORS.indoor}
                        sparkline={smoothIndoorTemp}
                        goodDirection="neutral"
                    />
                    <StatCard
                        label="UV Index"
                        value={uvIndex}
                        valueSize={1.5}
                        diffUnit=""
                        diff={netChange(nextFourHours(hourly?.uv_index))}
                        color={STAT_COLORS.uvIndex}
                        sparkline={nextFourHours(hourly?.uv_index)}
                        goodDirection="neutral"
                        icon={uvIcon(uvIndex)}
                        iconAlt={uvCategory(uvIndex)}
                    />

                    {hasPrecipitation ? (
                        <StatCard
                            label="Precipitation"
                            value={current?.precipitation ?? null}
                            valueSize={1.5}
                            unit="mm"
                            diff={netChange(upcomingPrecipitation)}
                            color={STAT_COLORS.precipitation}
                            sparkline={upcomingPrecipitation}
                            goodDirection="neutral"
                        />
                    ) : (
                        <StatCard
                            label="Cloud Cover"
                            value={current?.cloud_cover != null ? Math.round(current.cloud_cover) : null}
                            valueSize={1.5}
                            unit="%"
                            diff={netChange(nextFourHours(hourly?.cloud_cover))}
                            color={STAT_COLORS.cloudCover}
                            sparkline={nextFourHours(hourly?.cloud_cover)}
                            goodDirection="neutral"
                        />
                    )}
                </div>

                <StatCardShell label="Calendar" className={styles.calendarShell}>
                    <div className={styles.calendarContent}>
                        <CalendarGrid events={events ?? []}/>
                        <CalendarTimeline events={events ?? []}/>
                    </div>
                </StatCardShell>
            </div>
        </div>
    );
}
