"use client";

import type { ECharts } from "echarts/core";
import ReactEChartsCore from "echarts-for-react/lib/core";
import { echarts, THEME_NAME } from "@/lib/echarts-setup";

type Props = {
  data: (number | null)[];
  color: string;
  min?: number;
  max?: number;
};

// echarts-for-react sizes the chart from the container's getBoundingClientRect
// at mount, then relies on a size-sensor (ResizeObserver) to catch later
// resizes - but it deliberately ignores that sensor's very first callback
// (see node_modules/echarts-for-react/lib/core.js's isInitialResize guard,
// there to avoid cancelling the initial mount animation). If the container
// never changes size again after that first callback - true here, since
// this card's flex/grid width comes from its siblings' layout ratios, not
// from data this chart itself loads - the chart is stuck at whatever size
// it measured at mount, forever. That mismeasurement only actually happens
// when the surrounding flex layout hasn't settled to its final size yet at
// mount time, which is timing-dependent enough to show up in a deployed
// build (single fast hydration pass) without showing up in dev (slower,
// naturally staggered rendering tends to mask it) - the kiosk display never
// fires a window resize afterward to correct it either. Calling resize()
// directly on the echarts instance (bypassing the wrapper's own resize(),
// which is what has the ignored-first-call guard) one frame after mount
// re-measures against the settled layout.
function handleReady(instance: ECharts) {
  requestAnimationFrame(() => instance.resize());
}

// Minimal axis-less trend line for a stat card - no grid, no tooltip, no
// interaction chrome, just the shape of the trend in the metric's color.
export default function Sparkline({ data, color, min, max }: Props) {
  return (
    <ReactEChartsCore
      echarts={echarts}
      theme={THEME_NAME}
      style={{ height: "2.2em", width: "100%" }}
      onChartReady={handleReady}
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
