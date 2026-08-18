"use client";

import "@/lib/chart-setup";
import { Line } from "react-chartjs-2";

type Props = {
  times: string[];
  temps: number[];
  apparentTemps?: number[];
};

// Replaces components/weather/graphs/DayTempGraph.vue / ForecastGraph.vue with
// a single reusable chart driven by plain arrays instead of Vue-specific props.
export default function HourlyTempChart({ times, temps, apparentTemps }: Props) {
  const datasets = [
    {
      label: "Temperature",
      data: temps,
      borderColor: "#5b9bd5",
      backgroundColor: "rgba(91, 155, 213, 0.15)",
      fill: true,
      tension: 0.35,
      pointRadius: 0,
    },
  ];

  if (apparentTemps) {
    datasets.push({
      label: "Feels like",
      data: apparentTemps,
      borderColor: "#9aa0a6",
      backgroundColor: "transparent",
      fill: false,
      tension: 0.35,
      pointRadius: 0,
    });
  }

  return (
    <Line
      data={{ labels: times, datasets }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: "time", time: { unit: "hour" }, grid: { display: false } },
          y: { ticks: { callback: (v) => `${v}°` } },
        },
        plugins: { legend: { display: Boolean(apparentTemps) } },
      }}
    />
  );
}
