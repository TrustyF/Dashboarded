"use client";

import "@/lib/chart-setup";
import { Line } from "react-chartjs-2";

type Point = { dateTime: string; value: number | null };

type Props = {
  weight: Point[];
};

// Replaces components/fitbit/WeightGraph.vue. Left fat%/BMI out of the chart
// itself (they were fetched but not actually charted in the original either -
// see fitbit_store presumably just holding them for the summary numbers);
// add extra datasets here if you want them plotted too.
export default function WeightChart({ weight }: Props) {
  return (
    <Line
      data={{
        labels: weight.map((p) => p.dateTime),
        datasets: [
          {
            label: "Weight",
            data: weight.map((p) => p.value),
            borderColor: "#81b29a",
            backgroundColor: "rgba(129, 178, 154, 0.15)",
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            spanGaps: true,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: "time", time: { unit: "day" }, grid: { display: false } },
          y: {},
        },
        plugins: { legend: { display: false } },
      }}
    />
  );
}
