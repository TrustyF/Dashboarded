"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";

type Props = {
  times: string[];
  highs: number[];
  sunshineHours?: number[];
  precipitation?: number[];
};

// Open-Meteo's daily.time is a plain "YYYY-MM-DD" - show the weekday instead
// of the full date, which is redundant clutter on a 7-day-wide axis.
function weekday(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString(undefined, { weekday: "short" });
}

// Daily counterpart to the old HourlyTempChart - same reusable chart shape,
// driven by per-day high/sunshine/precipitation arrays instead of hourly ones.
export default function DailyTempChart({ times, highs, sunshineHours, precipitation }: Props) {
  // Right margin has to fit each line's endLabel text (near the last data
  // point) and the extra axes' own tick labels, which sit further out.
  const gridRight = 60 + (sunshineHours ? 30 : 0) + (precipitation ? 70 : 0);

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

  if (precipitation) {
    yAxis.push({
      type: "value",
      show: false,
      min: 0,
    });
    series.push({
      name: "Precipitation",
      type: "bar",
      yAxisIndex: yAxis.length - 1,
      data: pad(precipitation),
      barMaxWidth: 14,
      itemStyle: { color: "#3fb8af", opacity: 0.55, borderRadius: [4, 4, 0, 0] },
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
        xAxis: {
          type: "category",
          boundaryGap: false,
          data: paddedTimes,
          min: times[0],
          max: times[times.length - 1],
          axisLabel: { formatter: weekday },
        },
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
