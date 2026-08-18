"use client";

import "@/lib/chart-setup";
import { Line } from "react-chartjs-2";

type Props = {
  times: string[];
  temp: (number | null)[];
  humidity: (number | null)[];
};

// Replaces components/sensors/SensorTempGraph.vue - dual-axis temp/humidity
// line chart over the poller's rolling history.
export default function SensorHistoryChart({ times, temp, humidity }: Props) {
  return (
    <Line
      data={{
        labels: times,
        datasets: [
          {
            label: "Temp (°C)",
            data: temp,
            borderColor: "#e07a5f",
            backgroundColor: "transparent",
            yAxisID: "temp",
            tension: 0.3,
            pointRadius: 0,
          },
          {
            label: "Humidity (%)",
            data: humidity,
            borderColor: "#5b9bd5",
            backgroundColor: "transparent",
            yAxisID: "humidity",
            tension: 0.3,
            pointRadius: 0,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { type: "time", time: { unit: "minute" }, grid: { display: false } },
          temp: { position: "left", ticks: { callback: (v) => `${v}°` } },
          humidity: { position: "right", ticks: { callback: (v) => `${v}%` }, grid: { display: false } },
        },
      }}
    />
  );
}
