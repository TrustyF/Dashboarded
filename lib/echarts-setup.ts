import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
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

export { echarts };
