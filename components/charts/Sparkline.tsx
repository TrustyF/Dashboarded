"use client";

import ReactEChartsCore from "echarts-for-react/lib/core";
import {
  EASE_OUT_ANIMATION,
  echarts,
  NO_INTERACTION,
  THEME_NAME,
  useChartMountSettled,
  withEaseOutAnimation,
  withNoInteraction,
} from "@/lib/echarts-setup";

type Props = {
  data: (number | null)[];
  color: string;
  min?: number;
  max?: number;
};

// Minimal axis-less trend line for a stat card - no grid, no tooltip, no
// interaction chrome, just the shape of the trend in the metric's color.
export default function Sparkline({ data, color, min, max }: Props) {
  // The wrapper reserves the chart's footprint immediately, so gating the
  // chart itself behind useChartMountSettled (see lib/echarts-setup.ts)
  // doesn't cause a layout shift once it mounts a couple frames later.
  const settled = useChartMountSettled();
  return (
    <div style={{ height: "2.2em", width: "100%" }}>
      {settled && (
        <ReactEChartsCore
          echarts={echarts}
          theme={THEME_NAME}
          style={{ height: "100%", width: "100%" }}
          option={{
            ...NO_INTERACTION,
            ...EASE_OUT_ANIMATION,
            // Entrance animation on, same as DailyTempChart.tsx - the
            // container-resize race that used to make that unsafe is fixed
            // at the source by useChartMountSettled above, confirmed against
            // a real build.
            grid: { left: 0, right: 0, top: 4, bottom: 0 },
            xAxis: { type: "category", show: false, boundaryGap: false, data: data.map((_, i) => i) },
            yAxis: { type: "value", show: false, scale: min == null, min, max },
            series: withEaseOutAnimation(
              withNoInteraction([
                {
                  type: "line",
                  data,
                  showSymbol: false,
                  smooth: 0.3,
                  connectNulls: true,
                  lineStyle: { width: 2, color },
                  areaStyle: { color, opacity: 0.15 },
                },
              ])
            ),
          }}
        />
      )}
    </div>
  );
}
