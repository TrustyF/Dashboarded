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

  const series: Record<string, unknown>[] = [
    // Solid, card-colored area under the Temp curve - sits above the other
    // lines but below Temp's own (still translucent) fill, so anything
    // under the curve is fully hidden rather than just blended/dimmed.
    {
      name: "Temp mask",
      type: "line",
      z: 9,
      data: highs,
      showSymbol: false,
      smooth: 0.35,
      silent: true,
      tooltip: { show: false },
      lineStyle: { opacity: 0 },
      areaStyle: { color: "#16191d", opacity: 1 },
    },
    {
      name: "Temp",
      type: "line",
      z: 10,
      data: highs,
      showSymbol: false,
      smooth: 0.35,
      areaStyle: { opacity: 0.55 },
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
      type: "line",
      yAxisIndex: yAxis.length - 1,
      data: sunshineHours,
      showSymbol: false,
      smooth: 0.35,
      color: "#f2c94c",
      endLabel: { show: true, formatter: "{a}", color: "#f2c94c" },
    });
  }

  if (precipitation) {
    yAxis.push({
      type: "value",
      show: false,
    });
    series.push({
      name: "Precipitation",
      type: "line",
      yAxisIndex: yAxis.length - 1,
      data: precipitation,
      showSymbol: false,
      smooth: 0.35,
      color: "#3fb8af",
      endLabel: { show: true, formatter: "{a}", color: "#3fb8af" },
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
        xAxis: { type: "category", boundaryGap: false, data: times, axisLabel: { formatter: weekday } },
        yAxis,
        visualMap: {
          show: false,
          seriesIndex: 1,
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
