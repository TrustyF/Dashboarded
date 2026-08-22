"use client";

import { useEffect, useState } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

// Registered once, shared by every chart component (replaces
// lib/chart-setup.ts's Chart.js registration). Import this module (for its
// side effect) before rendering any <ReactECharts> chart.
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  CanvasRenderer,
]);

export const THEME_NAME = "dashboard-dark";

// Matches the old ChartJS.defaults palette (text #9aa0a6, gridlines #23272c)
// so the visual language stays the same across the framework swap.
echarts.registerTheme(THEME_NAME, {
  color: ["#81b29a", "#e07a5f", "#5b9bd5", "#9aa0a6"],
  backgroundColor: "transparent",
  textStyle: {
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  title: { textStyle: { color: "#f2f2f2" } },
  legend: { textStyle: { color: "#9aa0a6" } },
  tooltip: {
    backgroundColor: "#16191d",
    borderColor: "#23272c",
    textStyle: { color: "#f2f2f2" },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: "#23272c" } },
    axisTick: { show: false },
    axisLabel: { color: "#9aa0a6" },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "#9aa0a6" },
    splitLine: { lineStyle: { color: "#23272c" } },
  },
});

// Spread into every chart's `option` - kiosk touchscreen only, no mouse, and
// nothing here uses ECharts' own touch interactions (no dataZoom drag/pinch
// anywhere in the app) - so hover/tap-triggered tooltips have no upside and
// only risk fighting with Nav.tsx's document-level swipe gesture for
// switching pages.
//
// There's no single root-level "silent" chart option (a prior version of
// this tried `{ silent: true }` here - EChartsOption has no such field, it
// only exists per-series/per-element, so that was a silent no-op). Killing
// the tooltip and its axisPointer crosshair here covers the actual visible
// interaction; pair this with `silent: true` on each series (see
// withNoInteraction below) to also stop hover/click state on the shapes
// themselves.
//
// IMPORTANT: spread this FIRST in each chart's option object, and don't
// follow it with your own `tooltip`/`axisPointer` key - a later key of the
// same name in the same object literal overrides this one outright, it
// doesn't merge with it.
export const NO_INTERACTION = {
  tooltip: { show: false },
  axisPointer: { show: false },
};

// Spread into every animated chart's `option` (Sparkline.tsx,
// DailyTempChart.tsx, WeightChart.tsx, SensorHistoryChart.tsx) -
// "quadraticOut" is ECharts' own name for a decelerate-into-rest curve, the
// same shape CSS calls "ease-out".
export const EASE_OUT_ANIMATION = {
  animationEasing: "cubicOut",
};

// Marks every series in the array silent - stops hover/click state and
// cursor changes on the shapes themselves, on top of NO_INTERACTION's
// tooltip/axisPointer suppression above.
export function withNoInteraction<T extends Record<string, unknown>>(series: T[]): T[] {
  return series.map((s) => ({ ...s, silent: true }));
}

// Stamps EASE_OUT_ANIMATION onto every series directly. Traced through
// ECharts' own source (node_modules/echarts/dist/echarts.esm.js -
// getAnimationConfig, called from animateOrSetProps/initProps): the entrance
// animation's easing is read via `seriesModel.getShallow('animationEasing')`
// - i.e. off the *series* model specifically. Spreading EASE_OUT_ANIMATION
// only at the root option's top level relies on ECharts' own root-to-series
// option cascade actually populating that per-series read, which in
// practice wasn't producing any visible difference even with a drastically
// different curve (elasticOut) - setting it directly on each series is what
// getShallow is unambiguously guaranteed to see.
export function withEaseOutAnimation<T extends Record<string, unknown>>(series: T[]): T[] {
  return series.map((s) => ({ ...s, ...EASE_OUT_ANIMATION }));
}

// True once the browser has had a full extra frame after mount to settle
// layout. echarts-for-react measures its container's size once, at its own
// mount time (see node_modules/echarts-for-react/lib/core.js's
// initEchartsInstance) - if a flex-sized container (any .trendChart/
// .trend-style wrapper in this app) hasn't resolved its final size yet at
// that exact moment, the chart draws once at the wrong size, then a later
// ResizeObserver-driven correction redraws it at the right one. With
// animation on, that correction visibly replays the entrance animation from
// scratch (see components/charts/DailyTempChart.tsx's history for the two
// separate bugs this caused). Gating each chart's own mount behind this
// hook - instead of measuring wrong and correcting after the fact, per
// chart, with its own onChartReady hack - means echarts-for-react's mount-
// time measurement only ever runs once layout has already settled, so
// there's nothing to correct.
//
// Two rAFs, not one: the first lets whatever the *parent* just committed
// actually paint (that's when flex/grid actually resolves final sizes),
// the second is the frame the chart is finally allowed to mount on - one
// rAF risks the chart's own mount landing in the same paint as its
// container's, on a fast enough machine.
export function useChartMountSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(id);
  }, []);
  return settled;
}

export { echarts };
