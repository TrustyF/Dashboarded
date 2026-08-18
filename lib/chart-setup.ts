import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import "chartjs-adapter-date-fns";

// Registered once, shared by every chart component (replaces
// scripts/chartjs_defaults.js). Import this module (for its side effect)
// before rendering any <Line> chart.
ChartJS.register(
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  ChartDataLabels
);
// Datalabels is opt-in per chart (individual charts that don't set
// `plugins.datalabels` won't render any), so registering it globally here is
// safe - it doesn't turn labels on everywhere.
ChartJS.defaults.set("plugins.datalabels", { display: false });

ChartJS.defaults.color = "#9aa0a6";
ChartJS.defaults.borderColor = "#23272c";
ChartJS.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', sans-serif";
