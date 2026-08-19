"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";

type Props = {
  data: (number | null)[];
  color: string;
  min?: number;
  max?: number;
};

// Minimal axis-less trend line for a stat card - no grid, no tooltip, no
// interaction chrome, just the shape of the trend in the metric's color.
export default function Sparkline({ data, color, min, max }: Props) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      theme={THEME_NAME}
      style={{ height: "2.2em", width: "100%" }}
      option={{
        animation: false,
        grid: { left: 0, right: 0, top: 4, bottom: 0 },
        xAxis: { type: "category", show: false, boundaryGap: false, data: data.map((_, i) => i) },
        yAxis: { type: "value", show: false, scale: min == null, min, max },
        series: [
          {
            type: "line",
            data,
            showSymbol: false,
            smooth: 0.3,
            connectNulls: true,
            lineStyle: { width: 2, color },
            areaStyle: { color, opacity: 0.15 },
          },
        ],
      }}
    />
  );
}
