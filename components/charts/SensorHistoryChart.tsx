"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";

type Props = {
  times: string[];
  temp: (number | null)[];
  humidity: (number | null)[];
};

// Replaces components/sensors/SensorTempGraph.vue - dual-axis temp/humidity
// line chart over the poller's rolling history.
export default function SensorHistoryChart({ times, temp, humidity }: Props) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      theme={THEME_NAME}
      style={{ height: "100%", width: "100%" }}
      option={{
        legend: { show: true },
        tooltip: { trigger: "axis" },
        grid: { left: 50, right: 50, top: 16, bottom: 30 },
        xAxis: { type: "category", data: times },
        yAxis: [
          { type: "value", position: "left", axisLabel: { formatter: "{value}°" } },
          {
            type: "value",
            position: "right",
            splitLine: { show: false },
            axisLabel: { formatter: "{value}%" },
          },
        ],
        series: [
          {
            name: "Temp (°C)",
            type: "line",
            yAxisIndex: 0,
            data: temp,
            showSymbol: false,
            smooth: 0.3,
            connectNulls: true,
            color: "#e07a5f",
          },
          {
            name: "Humidity (%)",
            type: "line",
            yAxisIndex: 1,
            data: humidity,
            showSymbol: false,
            smooth: 0.3,
            connectNulls: true,
            color: "#5b9bd5",
          },
        ],
      }}
    />
  );
}
