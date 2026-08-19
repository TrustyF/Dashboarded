"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";

type Props = {
  times: string[];
  temps: number[];
  apparentTemps?: number[];
  precipitation?: number[];
};

// Open-Meteo's hourly.time is ISO "YYYY-MM-DDTHH:MM" - the chart only spans a
// few hours, so the date part is redundant clutter on the tick labels.
function timeOnly(isoString: string): string {
  const match = /T(\d{2}:\d{2})/.exec(isoString);
  return match ? match[1] : isoString;
}

// Replaces components/weather/graphs/DayTempGraph.vue / ForecastGraph.vue with
// a single reusable chart driven by plain arrays instead of Vue-specific props.
export default function HourlyTempChart({ times, temps, apparentTemps, precipitation }: Props) {
  // Right margin has to fit each line's endLabel text (near the last data
  // point) and the precipitation axis's own tick labels, which sit further out.
  const gridRight = 60 + (apparentTemps ? 30 : 0) + (precipitation ? 70 : 0);

  const series: Record<string, unknown>[] = [
    {
      name: "Temperature",
      type: "line",
      data: temps,
      showSymbol: false,
      smooth: 0.35,
      areaStyle: { opacity: 0.15 },
      color: "#5b9bd5",
      endLabel: { show: true, formatter: "{a}", color: "#5b9bd5" },
    },
  ];

  if (apparentTemps) {
    series.push({
      name: "Feels like",
      type: "line",
      data: apparentTemps,
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
        xAxis: { type: "category", boundaryGap: false, data: times, axisLabel: { formatter: timeOnly } },
        yAxis: [
          { type: "value", scale: true, axisLabel: { formatter: "{value}°" } },
          {
            type: "value",
            show: Boolean(precipitation),
            splitLine: { show: false },
            axisLabel: { show:false, formatter: "{value}mm" },
          },
        ],
        series,
      }}
    />
  );
}
