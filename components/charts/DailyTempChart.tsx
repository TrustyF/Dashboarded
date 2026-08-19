"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";

type Props = {
  times: string[];
  highs: number[];
  lows?: number[];
  precipitation?: number[];
};

// Open-Meteo's daily.time is a plain "YYYY-MM-DD" - show the weekday instead
// of the full date, which is redundant clutter on a 7-day-wide axis.
function weekday(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00`);
  return Number.isNaN(date.getTime()) ? isoDate : date.toLocaleDateString(undefined, { weekday: "short" });
}

// Daily counterpart to the old HourlyTempChart - same reusable chart shape,
// driven by per-day high/low/precipitation arrays instead of hourly ones.
export default function DailyTempChart({ times, highs, lows, precipitation }: Props) {
  // Right margin has to fit each line's endLabel text (near the last data
  // point) and the precipitation axis's own tick labels, which sit further out.
  const gridRight = 60 + (lows ? 30 : 0) + (precipitation ? 70 : 0);

  const series: Record<string, unknown>[] = [
    {
      name: "High",
      type: "line",
      data: highs,
      showSymbol: false,
      smooth: 0.35,
      areaStyle: { opacity: 0.15 },
      color: "#5b9bd5",
      endLabel: { show: true, formatter: "{a}", color: "#5b9bd5" },
    },
  ];

  if (lows) {
    series.push({
      name: "Low",
      type: "line",
      data: lows,
      showSymbol: false,
      smooth: 0.35,
      color: "#9aa0a6",
      endLabel: { show: true, formatter: "{a}", color: "#9aa0a6" },
    });
  }

  if (precipitation) {
    series.push({
      name: "Precipitation",
      type: "line",
      yAxisIndex: 1,
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
        yAxis: [
          { type: "value", scale: true, axisLabel: { formatter: "{value}°" } },
          {
            type: "value",
            show: Boolean(precipitation),
            splitLine: { show: false },
            axisLabel: { show: false, formatter: "{value}mm" },
          },
        ],
        series,
      }}
    />
  );
}
