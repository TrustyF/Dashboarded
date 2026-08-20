"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";

type Props = {
  times: string[];
  highs: number[];
  sunshineHours?: number[];
  // Hourly precipitation covering the same week as `times`, used to draw
  // one rain band per rainy hour instead of one per rainy day.
  hourlyPrecipitation?: number[];
  hourlyPrecipitationTimes?: string[];
};

// Open-Meteo's daily.time is a plain "YYYY-MM-DD" - show the weekday instead
// of the full date, which is redundant clutter on a 7-day-wide axis.
function weekday(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString(undefined, { weekday: "short" });
}

// Maps an hour's precipitation to a wash opacity - heavier rain reads as a
// more saturated band. 4mm/h is already a heavy-rain hour, so that's where
// the ramp tops out instead of scaling to whatever the wettest hour in the
// forecast happens to be.
const RAIN_MIN_ALPHA = 0.08;
const RAIN_MAX_ALPHA = 0.42;
const RAIN_MAX_MM_PER_HOUR = 4;
function rainAlpha(mm: number): number {
  const t = Math.min(mm / RAIN_MAX_MM_PER_HOUR, 1);
  return RAIN_MIN_ALPHA + t * (RAIN_MAX_ALPHA - RAIN_MIN_ALPHA);
}

// Daily counterpart to the old HourlyTempChart - same reusable chart shape,
// driven by per-day high/sunshine arrays (rain bands are the exception -
// those come from the hourly precipitation series so each day's band can be
// split into per-hour intensity instead of one flat wash for the whole day).
export default function DailyTempChart({
  times,
  highs,
  sunshineHours,
  hourlyPrecipitation,
  hourlyPrecipitationTimes,
}: Props) {
  // Right margin has to fit each line's endLabel text (near the last data
  // point) and the extra axes' own tick labels, which sit further out.
  const gridRight = 60 + (sunshineHours ? 30 : 0);

  // Pad the category axis with a blank slot on each side, and extrapolate the
  // Temp line one step past the real first/last high (via the edge slope) so
  // it visibly runs past the plotted week instead of stopping dead at it.
  // xAxis.min/max then window the axis back down to the real range, pushing
  // those padding points - and the line between them - outside the grid.
  const paddedTimes = ["", ...times, ""];
  const leftSlope = highs.length > 1 ? highs[1] - highs[0] : 0;
  const rightSlope = highs.length > 1 ? highs[highs.length - 1] - highs[highs.length - 2] : 0;
  const paddedHighs = [highs[0] - leftSlope, ...highs, highs[highs.length - 1] + rightSlope];
  const pad = <T,>(arr?: T[]) => (arr ? [null, ...arr, null] : undefined);

  // Bucket the hourly precipitation series by calendar day, so each day's
  // rain (if any) can be drawn as its own run of hour-wide bands rather than
  // one flat wash for the whole day.
  const hoursByDay = new Map<string, number[]>();
  hourlyPrecipitationTimes?.forEach((t, i) => {
    const date = t.slice(0, 10);
    if (!hoursByDay.has(date)) hoursByDay.set(date, []);
    hoursByDay.get(date)!.push(hourlyPrecipitation?.[i] ?? 0);
  });

  // Rain bands live on a second, hidden value axis (below) rather than the
  // main category axis - ECharts markArea on a category axis only accepts
  // its exact tick values (label or integer index), so the fractional
  // "partway through day N" coordinates an hour-band needs would silently
  // fail to render there. A value axis has no such restriction. Day dayIdx
  // spans value-axis units [dayIdx, dayIdx+1), matching that axis's
  // min/max below 1:1 with the category axis's visible day range.
  const rainSegments: [Record<string, unknown>, Record<string, unknown>][] = [];
  times.forEach((date, dayIdx) => {
    const hours = hoursByDay.get(date);
    if (!hours?.length) return;
    hours.forEach((mm, h) => {
      if (mm == null || mm <= 0.1) return;
      const x0 = dayIdx + h / hours.length;
      const x1 = dayIdx + (h + 1) / hours.length;
      rainSegments.push([
        { xAxis: x0, itemStyle: { color: `rgba(91, 155, 213, ${rainAlpha(mm)})` } },
        { xAxis: x1 },
      ]);
    });
  });

  const series: Record<string, unknown>[] = [
    {
      name: "Temp",
      type: "line",
      data: paddedHighs,
      showSymbol: false,
      smooth: 0.35,
      clip: false,
      // areaStyle: { color: "#5b9bd5", opacity: 0.55 },
      endLabel: { show: true, formatter: "{a}", color: "#5b9bd5" },
    },
    {
      name: "RainBands",
      type: "line",
      xAxisIndex: 1,
      data: [],
      silent: true,
      showSymbol: false,
      markArea: rainSegments.length ? { data: rainSegments } : undefined,
    },
  ];

  const yAxis: Record<string, unknown>[] = [
    { type: "value", scale: true, axisLabel: { formatter: "{value}°" } },
  ];

  if (sunshineHours) {
    yAxis.push({
      type: "value",
      show: false,
      min: 0,
    });
    series.push({
      name: "Sunshine",
      type: "bar",
      yAxisIndex: yAxis.length - 1,
      data: pad(sunshineHours),
      barMaxWidth: 14,
      itemStyle: { color: "#f2c94c", opacity: 0.55, borderRadius: [4, 4, 0, 0] },
    });
  }

  return (
    <ReactEChartsCore
      echarts={echarts}
      theme={THEME_NAME}
      style={{ height: "100%", width: "100%" }}
      option={{
        tooltip: { trigger: "axis" },
        grid: { left: 50, right: gridRight, top: 16, bottom: 30 },
        xAxis: [
          {
            type: "category",
            boundaryGap: false,
            data: paddedTimes,
            min: times[0],
            max: times[times.length - 1],
            axisLabel: { formatter: weekday },
          },
          { type: "value", show: false, min: 0, max: times.length - 1 },
        ],
        yAxis,
        visualMap: {
          show: false,
          seriesIndex: 0,
          dimension: 1,
          min: Math.min(...highs),
          max: Math.max(...highs),
          inRange: { color: ["#5b9bd5", "#3fb8af", "#e8c15a", "#e0703f"] },
        },
        series,
      }}
    />
  );
}
